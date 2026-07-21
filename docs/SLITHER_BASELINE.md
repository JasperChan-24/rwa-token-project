# Slither review baseline

Last reviewed: 2026-07-21

Analyzer: `slither-analyzer==0.11.5`, `crytic-compile==0.3.11`

Target: `contracts/PropertyToken.sol`, compiled with its imports through Foundry;
third-party dependency findings are excluded.

The CI gate fails on every high-severity Slither result. The current scan has no
high-severity result. It reports the following lower-severity detector classes;
each was reviewed instead of being hidden with a broad detector exclusion.

| Detector | Reviewed behavior | Existing control |
| --- | --- | --- |
| `unused-return` | `latestRoundData()`'s `startedAt` field is intentionally unused. The answer, update timestamp, `roundId`, and `answeredInRound` are consumed and validated. | Non-positive answers, zero/future timestamps, incomplete rounds, and stale observations revert. |
| `timestamp` | Timestamps intentionally define valuation effective time and Oracle freshness. Small block-producer timestamp skew can only move those time boundaries; it cannot alter balances or dividend accounting. | Future/zero timestamps revert and Oracle observations must be within the configured maximum age. |
| `low-level-calls` | `claimYield()` uses `call` to pay ETH to an allowlisted claimant, so contracts are not limited by the `transfer` gas stipend. | Checks-effects-interactions updates accounting first, `nonReentrant` blocks callback reentry, and a failed payment reverts the accounting update. |

Reproduce the scan from a clean checkout:

```bash
git submodule update --init --recursive
npm ci
python -m pip install --requirement requirements-security.txt
npm run slither
```

This baseline is a triage record, not a suppression list or a security audit.
Any new high result fails CI; lower-severity output must still be reviewed when
the contract, compiler, or analyzer version changes.
