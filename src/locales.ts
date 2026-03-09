export const dictionaries = {
  en: {
    title: "RWA Yield Dashboard",
    subtitle: "On-chain real estate yield protocol based on O(1) complexity algorithm",
    walletUnconnected: "Wallet Disconnected",
    disconnect: "Disconnect",
    connectWallet: "🔗 Connect Wallet",
    assetInfoTitle: "Prime Real Estate (PRES)",
    assetValuation: "Total On-chain Valuation",
    totalIssued: "Total Issued Shares",
    simulateAdmin: "Simulate: Admin Inject 10 ETH Yield",
    myPortfolio: "My Portfolio",
    holdings: "Shares Held",
    claimableYield: "Current Claimable Yield",
    claimButton: "Claim Yield",
    languageBtn: "中",
    // --- 新增的 OTC 交易模块词汇 ---
    transferTitle: "OTC Trading (Secondary Market)",
    recipientAddress: "Recipient Address (0x...)",
    transferAmount: "Amount (PRES)",
    confirmTransfer: "Confirm Transfer"
  },
  zh: {
    title: "RWA 资产分红看板",
    subtitle: "基于 O(1) 复杂度算法的链上房产收益协议",
    walletUnconnected: "钱包未连接",
    disconnect: "点击断开",
    connectWallet: "🔗 连接钱包",
    assetInfoTitle: "核心商业地产 (PRES)",
    assetValuation: "链上房产总估值",
    totalIssued: "已发行总份额",
    simulateAdmin: "模拟：作为管理员注入 10 ETH 房租",
    myPortfolio: "我的投资组合",
    holdings: "持有份额",
    claimableYield: "当前可领分红",
    claimButton: "一键提取收益 (Claim Yield)",
    languageBtn: "EN",
    // --- 新增的 OTC 交易模块词汇 ---
    transferTitle: "OTC 场外交易 (二级市场转让)",
    recipientAddress: "接收方钱包地址 (0x...)",
    transferAmount: "转让数量 (PRES)",
    confirmTransfer: "确认转让"
  }
};

export type Language = 'en' | 'zh';