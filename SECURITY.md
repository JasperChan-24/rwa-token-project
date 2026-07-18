# Security policy

## Scope

This repository is a Sepolia-only technical demonstration. It has not received an independent smart-contract audit and must not be used to represent, sell, or administer a real-world asset.

Please report suspected vulnerabilities through a private [GitHub security advisory](https://github.com/JasperChan-24/rwa-token-project/security/advisories/new). Do not include private keys, RPC credentials, API keys, KYC records, or other secrets in a public issue.

## Release controls

Every release must pass the following checks from a clean lockfile install:

```bash
npm ci
npm run compile
npm test
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
```

Hardhat compiler and test commands run sequentially because their shared compiler cache uses a process mutex. Deployment and verification secrets are never available to pull-request CI. Etherscan verification uses a read-only RPC connection and does not require the deployment private key.

## Known development-tool advisories

As of 2026-07-18, `npm audit --omit=dev` reports zero production vulnerabilities. The full development tree reports 14 advisories (7 low and 7 high):

- [`GHSA-xcpc-8h2w-3j85`](https://github.com/advisories/GHSA-xcpc-8h2w-3j85) through `hardhat -> adm-zip`. The current Hardhat release line still declares `adm-zip ^0.4.16`; npm reports no compatible fix through Hardhat.
- [`GHSA-848j-6mx2-7j84`](https://github.com/advisories/GHSA-848j-6mx2-7j84) through `@nomicfoundation/hardhat-verify -> @ethersproject/* -> elliptic`.

These packages are used only for trusted local/CI build and verification inputs and are not shipped in the static frontend. This separation reduces exposure but does not make the advisories disappear. Dependabot checks weekly; maintainers must reassess the advisories before each release, avoid processing untrusted archives or verification inputs, and remove this exception as soon as compatible upstream fixes exist.
