# Security policy

## Scope

This repository is a Sepolia-only technical demonstration. It has not received an independent smart-contract audit and must not be used to represent, sell, or administer a real-world asset.

Please report suspected vulnerabilities through a private [GitHub security advisory](https://github.com/JasperChan-24/rwa-token-project/security/advisories/new). Do not include private keys, RPC credentials, API keys, KYC records, or other secrets in a public issue.

## Release controls

Every release must pass the following checks from a clean lockfile install.
They require Node.js `>=22.13.0`, Foundry `v1.7.1`, and Python `3.12`; CI pins
those versions. Locally, install the pinned analyzer in an isolated environment:

```bash
git submodule update --init --recursive
npm ci
python3.12 -m venv .venv-security
source .venv-security/bin/activate
python -m pip install --requirement requirements-security.txt
npm run compile
npm run export:verification
git diff --exit-code -- abi/PropertyToken.json src/contracts/generated/propertyTokenAbi.ts verification/PropertyToken.standard-input.json
npm test
npm run lint:foundry
npm run test:foundry
npm run gas:check
npm run slither
npm run test:frontend
npm run coverage
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

Hardhat compiler and test commands run sequentially because their shared compiler cache uses a process mutex. Foundry provides a separate fuzz/invariant state-machine campaign and versioned gas regression gate; Slither is forced through the Foundry compiler path because the pinned analyzer line does not auto-detect Hardhat 3. Reviewed non-high Slither results and their controls are recorded in [`docs/SLITHER_BASELINE.md`](docs/SLITHER_BASELINE.md). Static analysis, fuzzing, high coverage, and green CI are evidence layers—not an independent audit. Deployment and verification secrets are never available to pull-request CI. Etherscan verification uses a read-only RPC connection and does not require the deployment private key. Repository-level controls include private vulnerability reporting, dependency alerts and automated security updates, secret scanning, push protection, and required CI on the protected `main` branch.

## Known development-tool advisories

As of 2026-07-21, `npm audit --omit=dev` reports zero production vulnerabilities. The full development tree reports eight low-severity entries, all propagated from one unpatched advisory:

- [`GHSA-848j-6mx2-7j84`](https://github.com/advisories/GHSA-848j-6mx2-7j84) through `@nomicfoundation/hardhat-verify -> @ethersproject/* -> elliptic`. The advisory does not currently list a patched `elliptic` release.

The earlier high-severity [`GHSA-xcpc-8h2w-3j85`](https://github.com/advisories/GHSA-xcpc-8h2w-3j85) finding is removed by locking Hardhat's transitive `adm-zip` dependency to patched version 0.6.0 through npm `overrides`. Compile, verification export, contract tests, coverage, type checking, and the production build validate that compatibility override before release.

The remaining affected package is used only for trusted local/CI verification inputs and is not shipped in the static frontend. This separation reduces exposure but does not make the advisory disappear. Dependabot checks weekly; maintainers must reassess it before each release, avoid untrusted verification inputs, and remove the exception as soon as a compatible upstream fix exists.
