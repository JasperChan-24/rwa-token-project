# 🏢 RWA Yield Protocol: On-Chain Real Estate Tokenization

[![Live Demo](https://img.shields.io/badge/demo-live-green)](你的Vercel链接)
[![Blockchain](https://img.shields.io/badge/Network-Sepolia_Testnet-blue)](https://sepolia.etherscan.io/)

### 🌟 Project Overview
This is a full-stack Decentralized Finance (DeFi) application designed for Real World Asset (RWA) tokenization. It simulates the process of fractionalizing real estate assets into ERC-20 compliant tokens (PRES), allowing holders to earn rental income distributed directly on the Ethereum blockchain.

<img width="1302" height="852" alt="截屏2026-03-10 01 05 52" src="https://github.com/user-attachments/assets/20a84a85-a21c-4551-8152-4645f6e53e6f" />

### 🚀 Key Technical Highlights
* **Scalable Dividend Algorithm ($O(1)$ Complexity):** Implemented a high-efficiency dividend distribution logic that prevents gas spikes. Unlike traditional loops, this algorithm ensures gas costs remain constant regardless of the number of token holders.
* **Oracle Integration:** Integrated **Chainlink Price Feeds** to fetch real-time USD valuation for underlying assets, ensuring transparency between physical asset value and on-chain representation.
* **Web3 Full-Stack Architecture:** * **Smart Contracts:** Solidity, Hardhat, OpenZeppelin.
    * **Frontend:** Next.js, Tailwind CSS, Wagmi/Viem (for seamless wallet interaction).
    * **Deployment:** Smart contracts deployed on **Sepolia Testnet**; Frontend hosted on **Vercel**.

### 🛠️ Tech Stack
- **Smart Contract:** Solidity (^0.8.24)
- **Development Framework:** Hardhat
- **Frontend Framework:** Next.js 14 (App Router)
- **Web3 Library:** Wagmi & Viem
- **Oracle:** Chainlink Price Feeds (ETH/USD)

### 📈 Future Roadmap
- [ ] **Chainlink Automation:** Implementing decentralized keepers to automate monthly rent distribution.
- [ ] **Secondary Market:** Building an internal OTC desk for token trading.
- [ ] **Governance:** Introducing a DAO voting mechanism for asset management.

### 📦 Installation & Local Development
1. Clone the repo: `git clone https://github.com/JasperChan-24/rwa-token-project`
2. Install dependencies: `npm install`
3. Start local node: `npx hardhat node`
4. Run development server: `npm run dev`

Developed by a Financial Mathematics student at XJTLU, exploring the intersection of Quantitative Finance and Blockchain Technology.
