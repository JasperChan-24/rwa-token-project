import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import {
  getAddress,
  keccak256,
  parseEther,
  stringToHex,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from "viem";

const { networkHelpers, viem } = await network.create();
const ONE_TOKEN = parseEther("1");
const TOTAL_SUPPLY = parseEther("10000");
const ORACLE_MAX_AGE = 3n * 60n * 60n;
const ETH_USD_PRICE = 3_000n * 10n ** 8n;

async function expectRevert(action: Promise<unknown>, expected?: RegExp): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    if (expected !== undefined) {
      const rendered = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
      assert.match(rendered, expected);
    }
    return true;
  });
}

async function deployFixture() {
  const [admin, treasury, alice, bob, outsider] = await viem.getWalletClients();
  const oracle = await viem.deployContract("MockV3Aggregator", [8, ETH_USD_PRICE]);
  const token = await viem.deployContract("PropertyToken", [
    admin.account.address,
    treasury.account.address,
    oracle.address,
    ORACLE_MAX_AGE,
  ]);
  const publicClient = await viem.getPublicClient();

  return { admin, treasury, alice, bob, outsider, oracle, token, publicClient };
}

async function whitelist(
  token: Awaited<ReturnType<typeof deployFixture>>["token"],
  ...accounts: Address[]
) {
  for (const account of accounts) {
    await token.write.setWhitelisted([account, true]);
  }
}

describe("PropertyToken", { concurrency: false }, () => {
  it("creates a fixed 10,000 PRES supply and assigns every operational role to the initial admin", async () => {
    const { admin, treasury, token } = await deployFixture();

    assert.equal(await token.read.name(), "Prime Real Estate Share");
    assert.equal(await token.read.symbol(), "PRES");
    assert.equal(await token.read.totalSupply(), TOTAL_SUPPLY);
    assert.equal(await token.read.balanceOf([treasury.account.address]), TOTAL_SUPPLY);
    assert.equal(getAddress(await token.read.defaultAdmin()), getAddress(admin.account.address));
    assert.equal(await token.read.defaultAdminDelay(), 48 * 60 * 60);
    assert.equal(await token.read.isWhitelisted([admin.account.address]), true);
    assert.equal(await token.read.isWhitelisted([treasury.account.address]), true);

    for (const roleName of [
      "COMPLIANCE_ROLE",
      "DIVIDEND_DISTRIBUTOR_ROLE",
      "VALUATION_ROLE",
      "ORACLE_MANAGER_ROLE",
      "PAUSER_ROLE",
    ] as const) {
      const role = await token.read[roleName]();
      assert.equal(await token.read.hasRole([role, admin.account.address]), true);
    }
  });

  it("enforces a delayed two-step default-admin transfer", async () => {
    const { admin, alice, outsider, token, publicClient } = await deployFixture();

    await expectRevert(
      token.write.beginDefaultAdminTransfer([alice.account.address], { account: outsider.account }),
      /AccessControlUnauthorizedAccount/,
    );
    await token.write.beginDefaultAdminTransfer([alice.account.address], { account: admin.account });

    const pending = await token.read.pendingDefaultAdmin();
    const latestBlock = await publicClient.getBlock();
    assert.equal(getAddress(pending[0]), getAddress(alice.account.address));
    assert.ok(BigInt(pending[1]) >= latestBlock.timestamp + 48n * 60n * 60n - 1n);
    await expectRevert(
      token.write.acceptDefaultAdminTransfer({ account: alice.account }),
      /AccessControlEnforcedDefaultAdminDelay/,
    );

    await networkHelpers.time.increaseTo(pending[1]);
    await token.write.acceptDefaultAdminTransfer({ account: alice.account });
    assert.equal(getAddress(await token.read.defaultAdmin()), getAddress(alice.account.address));

    const valuationRole = await token.read.VALUATION_ROLE();
    await expectRevert(
      token.write.grantRole([valuationRole, outsider.account.address], { account: admin.account }),
      /AccessControlUnauthorizedAccount/,
    );
    await token.write.grantRole([valuationRole, outsider.account.address], { account: alice.account });
    assert.equal(await token.read.hasRole([valuationRole, outsider.account.address]), true);
  });

  it("enforces every privileged operation and rejects direct ETH transfers", async () => {
    const { alice, outsider, oracle, token } = await deployFixture();
    const reportHash = keccak256(stringToHex("unauthorized valuation"));

    await expectRevert(
      token.write.setWhitelisted([alice.account.address, true], { account: outsider.account }),
      /AccessControlUnauthorizedAccount/,
    );
    await expectRevert(
      token.write.depositYield({ account: outsider.account, value: 1n }),
      /AccessControlUnauthorizedAccount/,
    );
    await expectRevert(
      token.write.updateRealWorldValuation([1n, 1n, reportHash], { account: outsider.account }),
      /AccessControlUnauthorizedAccount/,
    );
    await expectRevert(
      token.write.setEthUsdOracle([oracle.address, ORACLE_MAX_AGE], { account: outsider.account }),
      /AccessControlUnauthorizedAccount/,
    );
    await expectRevert(token.write.pause({ account: outsider.account }), /AccessControlUnauthorizedAccount/);
    await expectRevert(
      outsider.sendTransaction({ to: token.address, value: 1n }),
    );
    await expectRevert(token.write.depositYield({ value: 0n }), /ZeroYieldDeposit/);
  });

  it("requires both transfer endpoints to be whitelisted, including transferFrom", async () => {
    const { treasury, alice, bob, token } = await deployFixture();
    const amount = 100n * ONE_TOKEN;

    await expectRevert(
      token.write.transfer([alice.account.address, amount], { account: treasury.account }),
      /NotWhitelisted/,
    );

    await whitelist(token, alice.account.address, bob.account.address);
    await token.write.approve([alice.account.address, amount], { account: treasury.account });
    await token.write.setWhitelisted([bob.account.address, false]);
    await expectRevert(
      token.write.transferFrom([treasury.account.address, bob.account.address, amount], {
        account: alice.account,
      }),
      /NotWhitelisted/,
    );

    await token.write.setWhitelisted([bob.account.address, true]);
    await token.write.transferFrom([treasury.account.address, bob.account.address, amount], {
      account: alice.account,
    });
    assert.equal(await token.read.balanceOf([bob.account.address]), amount);

    await token.write.setWhitelisted([treasury.account.address, false]);
    await expectRevert(
      token.write.transfer([alice.account.address, 1n], { account: treasury.account }),
      /NotWhitelisted/,
    );
  });

  it("blocks transfers and deposits while paused but permits allowlisted claims and administration", async () => {
    const { treasury, alice, outsider, token, publicClient } = await deployFixture();
    await whitelist(token, alice.account.address);
    await token.write.transfer([alice.account.address, 2_000n * ONE_TOKEN], { account: treasury.account });
    await token.write.depositYield({ value: parseEther("10") });
    await token.write.pause();

    await expectRevert(
      token.write.transfer([treasury.account.address, ONE_TOKEN], { account: alice.account }),
      /EnforcedPause/,
    );
    await expectRevert(token.write.depositYield({ value: 1n }), /EnforcedPause/);

    await token.write.claimYield({ account: alice.account });
    assert.equal(await token.read.withdrawnYield([alice.account.address]), parseEther("2") - 1n);

    const block = await publicClient.getBlock();
    const reportHash = keccak256(stringToHex("paused-state appraisal"));
    await token.write.updateRealWorldValuation([parseEther("10000000"), block.timestamp, reportHash]);
    await token.write.setWhitelisted([alice.account.address, false]);
    assert.equal(await token.read.getRealWorldValuation(), parseEther("10000000"));

    await expectRevert(
      token.write.unpause({ account: outsider.account }),
      /AccessControlUnauthorizedAccount/,
    );
    await token.write.setWhitelisted([alice.account.address, true]);
    await token.write.unpause();
    await token.write.transfer([treasury.account.address, ONE_TOKEN], { account: alice.account });
    await token.write.depositYield({ value: 1n });
    assert.equal(await token.read.paused(), false);
  });

  it("uses signed O(1) corrections: transfers pay no ETH and preserve each deposit-time owner", async () => {
    const { treasury, alice, bob, token, publicClient } = await deployFixture();
    await whitelist(token, alice.account.address, bob.account.address);
    await token.write.transfer([alice.account.address, 4_000n * ONE_TOKEN], { account: treasury.account });
    await token.write.depositYield({ value: parseEther("10") });

    const contractBalanceBefore = await publicClient.getBalance({ address: token.address });
    await token.write.approve([bob.account.address, 1_000n * ONE_TOKEN], { account: alice.account });
    await token.write.transferFrom(
      [alice.account.address, bob.account.address, 1_000n * ONE_TOKEN],
      { account: bob.account },
    );
    const contractBalanceAfter = await publicClient.getBalance({ address: token.address });

    assert.equal(contractBalanceAfter, contractBalanceBefore, "a transfer must never settle ETH");
    assert.equal(await token.read.withdrawnYield([alice.account.address]), 0n);
    // Each account's final division by MAGNITUDE rounds down independently.
    assert.equal(await token.read.claimableYield([treasury.account.address]), parseEther("6") - 1n);
    assert.equal(await token.read.claimableYield([alice.account.address]), parseEther("4") - 1n);
    assert.equal(await token.read.claimableYield([bob.account.address]), 0n);

    await token.write.depositYield({ value: parseEther("5") });
    assert.equal(await token.read.claimableYield([treasury.account.address]), parseEther("9") - 1n);
    assert.equal(await token.read.claimableYield([alice.account.address]), parseEther("5.5") - 1n);
    assert.equal(await token.read.claimableYield([bob.account.address]), parseEther("0.5"));
  });

  it("lets a seller claim old yield after selling the entire token balance", async () => {
    const { treasury, alice, bob, token } = await deployFixture();
    await whitelist(token, alice.account.address, bob.account.address);
    const sold = 2_000n * ONE_TOKEN;
    await token.write.transfer([alice.account.address, sold], { account: treasury.account });
    await token.write.depositYield({ value: parseEther("10") });
    await token.write.transfer([bob.account.address, sold], { account: alice.account });

    assert.equal(await token.read.balanceOf([alice.account.address]), 0n);
    assert.equal(await token.read.claimableYield([alice.account.address]), parseEther("2") - 1n);
    assert.equal(await token.read.claimableYield([bob.account.address]), 0n);
    await token.write.claimYield({ account: alice.account });
    assert.equal(await token.read.withdrawnYield([alice.account.address]), parseEther("2") - 1n);
  });

  it("keeps accrued rights across whitelist revocation and restoration", async () => {
    const { treasury, alice, token } = await deployFixture();
    await whitelist(token, alice.account.address);
    await token.write.transfer([alice.account.address, 1_000n * ONE_TOKEN], { account: treasury.account });
    await token.write.depositYield({ value: parseEther("10") });
    const accrued = await token.read.claimableYield([alice.account.address]);

    await token.write.setWhitelisted([alice.account.address, false]);
    await expectRevert(token.write.claimYield({ account: alice.account }), /NotWhitelisted/);
    assert.equal(await token.read.claimableYield([alice.account.address]), accrued);

    await token.write.setWhitelisted([alice.account.address, true]);
    await token.write.claimYield({ account: alice.account });
    assert.equal(await token.read.withdrawnYield([alice.account.address]), accrued);
  });

  it("carries scaled division remainder and conserves all deposited wei up to per-holder rounding dust", async () => {
    const { treasury, alice, bob, token, publicClient } = await deployFixture();
    await whitelist(token, alice.account.address, bob.account.address);
    await token.write.transfer([alice.account.address, 3_333n * ONE_TOKEN], { account: treasury.account });
    await token.write.transfer([bob.account.address, 2_222n * ONE_TOKEN], { account: treasury.account });

    const deposits = [1n, 2n, 7n, 101n, 1_000_000_000_000_000_123n];
    for (const value of deposits) {
      await token.write.depositYield({ value });
    }

    const deposited = deposits.reduce((sum, value) => sum + value, 0n);
    const magnitude = (await token.read.MAGNITUDE()) as bigint;
    assert.equal(await token.read.totalYieldDeposited(), deposited);
    assert.equal(await token.read.magnifiedDividendPerShare(), (deposited * magnitude) / TOTAL_SUPPLY);
    assert.equal(await token.read.magnifiedDividendRemainder(), (deposited * magnitude) % TOTAL_SUPPLY);

    const accounts = [treasury.account.address, alice.account.address, bob.account.address];
    const claimables = (await Promise.all(
      accounts.map((account) => token.read.claimableYield([account])),
    )) as bigint[];
    const distributable = claimables.reduce((sum, value) => sum + value, 0n);
    assert.ok(distributable <= deposited);
    assert.ok(deposited - distributable <= BigInt(accounts.length));

    for (let index = 0; index < accounts.length; index += 1) {
      if (claimables[index] > 0n) {
        const wallets = [treasury, alice, bob];
        await token.write.claimYield({ account: wallets[index].account });
      }
    }
    assert.equal(await token.read.totalYieldClaimed(), distributable);
    assert.equal(await publicClient.getBalance({ address: token.address }), deposited - distributable);
  });

  it("blocks reentrant double claims and rolls back accounting when a recipient rejects ETH", async () => {
    const { treasury, token } = await deployFixture();
    const reentrant = await viem.deployContract("ReentrantYieldRecipient", [token.address]);
    const rejecting = await viem.deployContract("RejectingYieldRecipient", [token.address]);
    await whitelist(token, reentrant.address, rejecting.address);
    await token.write.transfer([reentrant.address, 1_000n * ONE_TOKEN], { account: treasury.account });
    await token.write.transfer([rejecting.address, 1_000n * ONE_TOKEN], { account: treasury.account });
    await token.write.depositYield({ value: parseEther("10") });

    await reentrant.write.claim();
    assert.equal(await reentrant.read.receiveCount(), 1n);
    assert.equal(await reentrant.read.reentrySucceeded(), false);
    assert.equal(await token.read.withdrawnYield([reentrant.address]), parseEther("1") - 1n);

    const before = await token.read.claimableYield([rejecting.address]);
    await expectRevert(rejecting.write.claim(), /EtherTransferFailed/);
    assert.equal(await token.read.withdrawnYield([rejecting.address]), 0n);
    assert.equal(await token.read.claimableYield([rejecting.address]), before);
  });

  it("records manual 18-decimal USD valuation provenance independently of the price oracle", async () => {
    const { token, publicClient } = await deployFixture();
    const block = await publicClient.getBlock();
    const valuation = parseEther("10000000");
    const reportHash = keccak256(stringToHex("ipfs://demo-appraisal-report"));

    await token.write.updateRealWorldValuation([valuation, block.timestamp, reportHash]);
    assert.equal(await token.read.getRealWorldValuation(), valuation);
    const details = (await token.read.getValuationDetails()) as readonly [bigint, bigint, bigint, Hex];
    assert.equal(details[0], valuation);
    assert.equal(details[1], block.timestamp);
    assert.ok(details[2] >= block.timestamp);
    assert.equal(details[3], reportHash);

    await expectRevert(
      token.write.updateRealWorldValuation([0n, block.timestamp, reportHash]),
      /InvalidValuation/,
    );
    await expectRevert(
      token.write.updateRealWorldValuation([valuation, 0n, reportHash]),
      /InvalidValuationEffectiveAt/,
    );
    await expectRevert(
      token.write.updateRealWorldValuation([valuation, block.timestamp, zeroHash]),
      /InvalidValuationReportHash/,
    );
    const latest = await publicClient.getBlock();
    await expectRevert(
      token.write.updateRealWorldValuation([valuation, latest.timestamp + 1_000n, reportHash]),
      /InvalidValuationEffectiveAt/,
    );
  });

  it("validates positive, complete, current, non-future Chainlink rounds and converts claimable ETH to USD", async () => {
    const { treasury, alice, oracle, token, publicClient } = await deployFixture();
    await whitelist(token, alice.account.address);
    await token.write.transfer([alice.account.address, 2_000n * ONE_TOKEN], { account: treasury.account });
    await token.write.depositYield({ value: parseEther("1") });

    const observation = (await token.read.getEthUsdPrice()) as readonly [bigint, number, bigint];
    assert.equal(observation[0], ETH_USD_PRICE);
    assert.equal(observation[1], 8);
    assert.equal(
      await token.read.claimableYieldUsd([alice.account.address]),
      (parseEther("0.2") - 1n) * 3_000n,
    );

    let now = (await publicClient.getBlock()).timestamp;
    await oracle.write.setRoundData([2n, 0n, now, now, 2n]);
    await expectRevert(token.read.getEthUsdPrice(), /InvalidOracleAnswer/);

    await oracle.write.setRoundData([3n, ETH_USD_PRICE, now, 0n, 3n]);
    await expectRevert(token.read.getEthUsdPrice(), /InvalidOracleTimestamp/);

    now = (await publicClient.getBlock()).timestamp;
    await oracle.write.setRoundData([4n, ETH_USD_PRICE, now, now + 1_000n, 4n]);
    await expectRevert(token.read.getEthUsdPrice(), /InvalidOracleTimestamp/);

    now = (await publicClient.getBlock()).timestamp;
    await oracle.write.setRoundData([5n, ETH_USD_PRICE, now - ORACLE_MAX_AGE - 1n, now - ORACLE_MAX_AGE - 1n, 5n]);
    await expectRevert(token.read.getEthUsdPrice(), /StaleOraclePrice/);

    now = (await publicClient.getBlock()).timestamp;
    await oracle.write.setRoundData([6n, ETH_USD_PRICE, now, now, 5n]);
    await expectRevert(token.read.getEthUsdPrice(), /IncompleteOracleRound/);
  });

  it("allows controlled oracle replacement and rejects unusable configuration", async () => {
    const { token } = await deployFixture();
    const replacement = await viem.deployContract("MockV3Aggregator", [18, 2_500n * 10n ** 18n]);
    await token.write.setEthUsdOracle([replacement.address, 900n]);
    assert.equal(getAddress((await token.read.ethUsdOracle()) as Address), getAddress(replacement.address));
    assert.equal(await token.read.oracleDecimals(), 18);
    assert.equal(await token.read.oracleMaxAge(), 900n);

    await expectRevert(token.write.setEthUsdOracle([zeroAddress, 900n]), /ZeroAddress/);
    await expectRevert(token.write.setEthUsdOracle([replacement.address, 0n]), /InvalidOracleMaxAge/);
    const unsupported = await viem.deployContract("MockV3Aggregator", [19, 1n]);
    await expectRevert(token.write.setEthUsdOracle([unsupported.address, 900n]), /UnsupportedOracleDecimals/);
  });

  it("keeps first-deposit gas effectively constant as the holder set grows", async () => {
    const { admin, treasury, oracle, token: sparseToken, publicClient } = await deployFixture();
    const denseToken = await viem.deployContract("PropertyToken", [
      admin.account.address,
      treasury.account.address,
      oracle.address,
      ORACLE_MAX_AGE,
    ]);

    for (let index = 0; index < 48; index += 1) {
      const holder = `0x${(10_000 + index).toString(16).padStart(40, "0")}` as Address;
      await denseToken.write.setWhitelisted([holder, true]);
      await denseToken.write.transfer([holder, ONE_TOKEN], { account: treasury.account });
    }

    const sparseHash = await sparseToken.write.depositYield({ value: parseEther("1") });
    const denseHash = await denseToken.write.depositYield({ value: parseEther("1") });
    const sparseReceipt = await publicClient.waitForTransactionReceipt({ hash: sparseHash });
    const denseReceipt = await publicClient.waitForTransactionReceipt({ hash: denseHash });
    const delta =
      sparseReceipt.gasUsed > denseReceipt.gasUsed
        ? sparseReceipt.gasUsed - denseReceipt.gasUsed
        : denseReceipt.gasUsed - sparseReceipt.gasUsed;

    assert.ok(delta <= 5_000n, `deposit gas changed by ${delta} with 48 additional holders`);
  });
});
