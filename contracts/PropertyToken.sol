// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {AccessControlDefaultAdminRules} from "@openzeppelin/contracts/access/extensions/AccessControlDefaultAdminRules.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title PropertyToken
/// @notice Fixed-supply, permissioned property shares with pull-based ETH yield.
/// @dev The token represents an off-chain asset interest; it does not itself create
///      legal title, custody, an SPV, or enforceable investor rights.
contract PropertyToken is ERC20, ERC20Pausable, AccessControlDefaultAdminRules, ReentrancyGuard {
    uint256 public constant TOTAL_SUPPLY = 10_000 ether;
    uint256 public constant MAGNITUDE = 1 << 128;
    uint48 public constant DEFAULT_ADMIN_TRANSFER_DELAY = 48 hours;

    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant DIVIDEND_DISTRIBUTOR_ROLE = keccak256("DIVIDEND_DISTRIBUTOR_ROLE");
    bytes32 public constant VALUATION_ROLE = keccak256("VALUATION_ROLE");
    bytes32 public constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    error ZeroAddress();
    error NotWhitelisted(address account);
    error ZeroYieldDeposit();
    error NoYieldToClaim();
    error EtherTransferFailed();
    error InvalidValuation();
    error InvalidValuationEffectiveAt(uint256 effectiveAt);
    error InvalidValuationReportHash();
    error InvalidOracleMaxAge();
    error UnsupportedOracleDecimals(uint8 decimals);
    error InvalidOracleAnswer(int256 answer);
    error InvalidOracleTimestamp(uint256 updatedAt);
    error StaleOraclePrice(uint256 updatedAt, uint256 maxAge);
    error IncompleteOracleRound(uint80 roundId, uint80 answeredInRound);

    event WhitelistStatusChanged(address indexed account, bool isWhitelisted, address indexed operator);
    event YieldDeposited(
        address indexed distributor,
        uint256 amount,
        uint256 magnifiedDividendPerShare,
        uint256 remainder
    );
    event YieldClaimed(address indexed account, uint256 amount);
    event RealWorldValuationUpdated(
        uint256 valuationUsd,
        uint64 effectiveAt,
        uint64 recordedAt,
        bytes32 indexed reportHash
    );
    event EthUsdOracleUpdated(address indexed oracle, uint8 decimals, uint256 maxAge);

    mapping(address account => bool allowed) public isWhitelisted;

    uint256 public magnifiedDividendPerShare;
    uint256 public magnifiedDividendRemainder;
    mapping(address account => int256 correction) public magnifiedDividendCorrections;
    mapping(address account => uint256 amount) public withdrawnYield;
    uint256 public totalYieldDeposited;
    uint256 public totalYieldClaimed;

    uint256 private _realWorldValuationUsd;
    uint64 public valuationEffectiveAt;
    uint64 public valuationRecordedAt;
    bytes32 public valuationReportHash;

    AggregatorV3Interface public ethUsdOracle;
    uint8 public oracleDecimals;
    uint256 public oracleMaxAge;

    constructor(address initialAdmin, address treasury, address initialOracle, uint256 initialOracleMaxAge)
        ERC20("Prime Real Estate Share", "PRES")
        AccessControlDefaultAdminRules(DEFAULT_ADMIN_TRANSFER_DELAY, initialAdmin)
    {
        if (treasury == address(0)) revert ZeroAddress();

        isWhitelisted[initialAdmin] = true;
        emit WhitelistStatusChanged(initialAdmin, true, initialAdmin);
        if (treasury != initialAdmin) {
            isWhitelisted[treasury] = true;
            emit WhitelistStatusChanged(treasury, true, initialAdmin);
        }

        _grantRole(COMPLIANCE_ROLE, initialAdmin);
        _grantRole(DIVIDEND_DISTRIBUTOR_ROLE, initialAdmin);
        _grantRole(VALUATION_ROLE, initialAdmin);
        _grantRole(ORACLE_MANAGER_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialAdmin);

        _setEthUsdOracle(initialOracle, initialOracleMaxAge);
        _mint(treasury, TOTAL_SUPPLY);
    }

    /// @notice Adds or removes an address from the transfer and claim allowlist.
    /// @dev Removing an address never erases its accrued or withdrawn-yield accounting.
    function setWhitelisted(address account, bool allowed) external onlyRole(COMPLIANCE_ROLE) {
        if (account == address(0)) revert ZeroAddress();
        isWhitelisted[account] = allowed;
        emit WhitelistStatusChanged(account, allowed, _msgSender());
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Deposits ETH yield for all token holders at the current balances.
    /// @dev Constant-time magnified-dividend accounting with carry-forward remainder.
    function depositYield()
        external
        payable
        onlyRole(DIVIDEND_DISTRIBUTOR_ROLE)
        whenNotPaused
        nonReentrant
    {
        if (msg.value == 0) revert ZeroYieldDeposit();

        uint256 supply = totalSupply();
        uint256 increment = Math.mulDiv(msg.value, MAGNITUDE, supply);
        uint256 combinedRemainder = mulmod(msg.value, MAGNITUDE, supply) + magnifiedDividendRemainder;

        increment += combinedRemainder / supply;
        magnifiedDividendRemainder = combinedRemainder % supply;
        magnifiedDividendPerShare += increment;
        totalYieldDeposited += msg.value;

        emit YieldDeposited(_msgSender(), msg.value, magnifiedDividendPerShare, magnifiedDividendRemainder);
    }

    /// @notice Total yield ever allocated to an account, including amounts already claimed.
    function accumulativeYield(address account) public view returns (uint256) {
        uint256 magnifiedBalance = Math.mulDiv(magnifiedDividendPerShare, balanceOf(account), 1);
        int256 corrected = SafeCast.toInt256(magnifiedBalance) + magnifiedDividendCorrections[account];
        return SafeCast.toUint256(corrected) / MAGNITUDE;
    }

    function claimableYield(address account) public view returns (uint256) {
        return accumulativeYield(account) - withdrawnYield[account];
    }

    /// @notice Claims the caller's accrued ETH without changing token balances.
    /// @dev Deliberately remains available while paused; compliance allowlisting still applies.
    function claimYield() external nonReentrant {
        address account = _msgSender();
        if (!isWhitelisted[account]) revert NotWhitelisted(account);

        uint256 amount = claimableYield(account);
        if (amount == 0) revert NoYieldToClaim();

        withdrawnYield[account] += amount;
        totalYieldClaimed += amount;

        (bool success,) = payable(account).call{value: amount}("");
        if (!success) revert EtherTransferFailed();

        emit YieldClaimed(account, amount);
    }

    function updateRealWorldValuation(uint256 valuationUsd, uint64 effectiveAt, bytes32 reportHash)
        external
        onlyRole(VALUATION_ROLE)
    {
        if (valuationUsd == 0) revert InvalidValuation();
        if (effectiveAt == 0 || effectiveAt > block.timestamp) {
            revert InvalidValuationEffectiveAt(effectiveAt);
        }
        if (reportHash == bytes32(0)) revert InvalidValuationReportHash();

        uint64 recordedAt = SafeCast.toUint64(block.timestamp);
        _realWorldValuationUsd = valuationUsd;
        valuationEffectiveAt = effectiveAt;
        valuationRecordedAt = recordedAt;
        valuationReportHash = reportHash;

        emit RealWorldValuationUpdated(valuationUsd, effectiveAt, recordedAt, reportHash);
    }

    /// @notice Latest manually recorded off-chain asset valuation, in 18-decimal USD.
    function getRealWorldValuation() external view returns (uint256) {
        return _realWorldValuationUsd;
    }

    function getValuationDetails()
        external
        view
        returns (uint256 valuationUsd, uint64 effectiveAt, uint64 recordedAt, bytes32 reportHash)
    {
        return (_realWorldValuationUsd, valuationEffectiveAt, valuationRecordedAt, valuationReportHash);
    }

    function setEthUsdOracle(address newOracle, uint256 newMaxAge) external onlyRole(ORACLE_MANAGER_ROLE) {
        _setEthUsdOracle(newOracle, newMaxAge);
    }

    /// @notice Returns a fully validated Chainlink ETH/USD observation.
    function getEthUsdPrice() public view returns (uint256 price, uint8 decimals, uint256 updatedAt) {
        (uint80 roundId, int256 answer,, uint256 observedAt, uint80 answeredInRound) = ethUsdOracle.latestRoundData();

        if (answer <= 0) revert InvalidOracleAnswer(answer);
        if (observedAt == 0 || observedAt > block.timestamp) revert InvalidOracleTimestamp(observedAt);
        if (answeredInRound < roundId) revert IncompleteOracleRound(roundId, answeredInRound);
        if (block.timestamp - observedAt > oracleMaxAge) revert StaleOraclePrice(observedAt, oracleMaxAge);

        return (SafeCast.toUint256(answer), oracleDecimals, observedAt);
    }

    /// @notice Claimable ETH yield converted to 18-decimal USD using Chainlink ETH/USD.
    function claimableYieldUsd(address account) external view returns (uint256) {
        (uint256 price, uint8 decimals,) = getEthUsdPrice();
        return Math.mulDiv(claimableYield(account), price, 10 ** uint256(decimals));
    }

    function _setEthUsdOracle(address newOracle, uint256 newMaxAge) internal {
        if (newOracle == address(0)) revert ZeroAddress();
        if (newMaxAge == 0) revert InvalidOracleMaxAge();

        uint8 decimals = AggregatorV3Interface(newOracle).decimals();
        if (decimals > 18) revert UnsupportedOracleDecimals(decimals);

        ethUsdOracle = AggregatorV3Interface(newOracle);
        oracleDecimals = decimals;
        oracleMaxAge = newMaxAge;
        emit EthUsdOracleUpdated(newOracle, decimals, newMaxAge);
    }

    /// @dev Adjusts signed dividend corrections in O(1), so transfers never settle ETH
    ///      and historical yield stays with the holder that owned the shares at deposit time.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        if (from != address(0) && !isWhitelisted[from]) revert NotWhitelisted(from);
        if (to != address(0) && !isWhitelisted[to]) revert NotWhitelisted(to);

        super._update(from, to, value);

        int256 correction = SafeCast.toInt256(Math.mulDiv(magnifiedDividendPerShare, value, 1));
        if (from == address(0)) {
            magnifiedDividendCorrections[to] -= correction;
        } else if (to == address(0)) {
            magnifiedDividendCorrections[from] += correction;
        } else {
            magnifiedDividendCorrections[from] += correction;
            magnifiedDividendCorrections[to] -= correction;
        }
    }
}
