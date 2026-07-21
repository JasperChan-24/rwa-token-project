# Third-party notices

## Magnified-dividend accounting prior art

PropertyToken adapts the established magnified-dividend-per-share and signed
transfer-correction pattern from Roger Wu's `DividendPayingToken` reference
implementation, pinned here for review:

- Source: [`DividendPayingToken.sol` at `4f7c1fa`](https://github.com/Roger-Wu/erc1726-dividend-paying-token/blob/4f7c1fa40b94a62cbd93109d9b94b73fea17f074/contracts/DividendPayingToken.sol)
- Package metadata: [`package.json` at `4f7c1fa`](https://github.com/Roger-Wu/erc1726-dividend-paying-token/blob/4f7c1fa40b94a62cbd93109d9b94b73fea17f074/package.json)
- ERC-1726 discussion: [ethereum/EIPs#1726](https://github.com/ethereum/EIPs/issues/1726)

The shared pattern includes the `2^128` magnitude, cumulative magnified
dividend-per-share value, signed per-account corrections, withdrawn accounting,
and correction sign changes on transfer, mint, and burn. Roger Wu's source in
turn credits the earlier PoWH3D implementation as prior art.

This repository's contribution is the Solidity 0.8.28 and OpenZeppelin 5
architecture, a unified `_update` adaptation, carry-forward division remainder,
fixed-supply and allowlist boundaries, role separation and pause behavior,
pull-claim safety, oracle and valuation integration, fuzz/invariant and
deterministic tests, gas regression gates, Sepolia deployment, exact-match source
verification, frontend, and public evidence package. It does not claim invention
of the underlying magnified-dividend algorithm.

The deployed `contracts/PropertyToken.sol` source is intentionally not changed
solely to add a source comment in this release: Solidity includes source hashes
in compiler metadata, so even a whitespace-only source change would change the
runtime metadata hash and break the published Sepolia exact match. A future
redeployed contract version should carry this attribution directly in NatSpec.

### Upstream ISC license notice

The pinned upstream package declares the ISC license and names `Roger-Wu` as its
author. It does not include a standalone license file at that commit, so the
standard ISC notice is reproduced here with the named author.

Copyright (c) Roger Wu

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
