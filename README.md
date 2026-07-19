# PropertyToken RWA Demo

一个可编译、可测试、可部署到 Sepolia 的房地产 RWA 技术演示。仓库同时包含 Solidity 合约、Hardhat 工程、Next.js 前端和围绕分红、权限、KYC、Oracle 与安全边界的自动化测试。

> [!CAUTION]
> 本项目仅用于 Sepolia 技术演示。它没有经过安全审计，不代表任何真实物业、SPV 权益或可执行的法律权利，不是证券发行、募资、招揽或投资建议。Sepolia ETH 没有现实价值。

## 当前部署状态

以下是本仓库当前 Sepolia 演示部署的公开证据。Sourcify 已对创建与运行时 bytecode 给出 `exact_match`；Etherscan 也已使用 Solidity Standard JSON Input 完成源码验证并显示 `Exact Match`。

<!-- DEPLOYMENT_NETWORK -->
- Network: Sepolia (`chainId: 11155111`)
<!-- DEPLOYMENT_CONTRACT_ADDRESS -->
- Contract address: [`0xCac265066d612b6FE1E2Ff323bEDa97879f71aC3`](https://sepolia.etherscan.io/address/0xCac265066d612b6FE1E2Ff323bEDa97879f71aC3)
<!-- DEPLOYMENT_TRANSACTION_URL -->
- Deployment transaction: [`0xa7252d045fd341b30d8e9b37be6887a39d2ed1421fae0a23adc676ed8c3b12a9`](https://sepolia.etherscan.io/tx/0xa7252d045fd341b30d8e9b37be6887a39d2ed1421fae0a23adc676ed8c3b12a9)
<!-- DEPLOYMENT_ETHERSCAN_URL -->
- Etherscan source verification: [verified exact match](https://sepolia.etherscan.io/address/0xCac265066d612b6FE1E2Ff323bEDa97879f71aC3#code) (`v0.8.28+commit.7893614a`, optimizer enabled, 200 runs)
<!-- DEPLOYMENT_SOURCIFY_URL -->
- Sourcify verification: [exact match](https://repo.sourcify.dev/11155111/0xCac265066d612b6FE1E2Ff323bEDa97879f71aC3) ([API evidence](https://sourcify.dev/server/v2/contract/11155111/0xCac265066d612b6FE1E2Ff323bEDa97879f71aC3))

现有 [Vercel 地址](https://rwa-token-project.vercel.app) 仍托管早期提交，尚未与本页记录的 Sepolia 合约和生成 ABI 对齐，因此不能作为本次 release 的验证证据。本次 release 合并并完成生产部署后，应以部署 commit SHA 和 Vercel deployment 记录为准。前端默认连接上述 Sepolia 部署，也可用 `NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS` 覆盖；钱包不在 Sepolia 或地址无效时会禁用链上写操作。

## 功能与边界

`PropertyToken` 是一个固定供应、不可升级的 ERC-20 演示合约：

- 部署时一次性向 treasury 铸造 `10,000 PRES`（18 位小数），之后没有增发、销毁或升级入口。
- 只有白名单地址之间可以转账；KYC/AML 在链下完成，链上只保存钱包是否获准的映射。
- 获授权的分红分发者存入 ETH，持有人自行领取，不遍历持有人列表。
- 获授权的估值角色登记人工物业估值、估值生效时间和报告哈希。
- Chainlink ETH/USD 只用于把“可领取 ETH”换算成只读的美元展示值，不生成物业估值，也不改变 ETH 分红权益。
- 支持暂停、最小权限角色划分，以及带 48 小时延迟的两步默认管理员交接。

前端使用注入式钱包连接 Sepolia，展示余额、可领取 ETH 及其 USD 参考值、物业估值元数据、Oracle 新鲜度、白名单和暂停状态，并提供转账、分红存入及领取交互。UI 的按钮限制只是交互提示，最终权限始终由合约执行。

## 技术栈与目录

- Solidity + OpenZeppelin Contracts：ERC-20、角色权限、暂停、重入保护和延迟管理员规则。
- Hardhat 3 + viem + Node.js test runner：编译、测试、覆盖率、Sepolia 部署和源码验证。
- Chainlink `AggregatorV3Interface`：读取 Sepolia ETH/USD feed，并检查价格有效性与更新时间。
- Next.js 16 + React 19 + TypeScript + wagmi + viem：前端与钱包交互。

```text
contracts/PropertyToken.sol          核心 ERC-20、白名单、分红、估值和 Oracle 逻辑
test/PropertyToken.ts                合约行为、安全性、舍入与 gas scaling 测试
scripts/deploy.ts                    Sepolia 部署与演示初始化
hardhat.config.ts                    Solidity、网络、验证和测试配置
src/contracts/propertyToken.ts       前端使用的部署地址与生成 ABI 入口
src/contracts/generated/             从 Hardhat artifact 生成的 TypeScript ABI
abi/PropertyToken.json               从 Hardhat artifact 导出的可提交 ABI
deployments/sepolia/PropertyToken.json  部署、初始化、构造参数和验证 manifest
verification/PropertyToken.standard-input.json  精确生产构建的标准 JSON 输入
src/app/                             Next.js App Router 页面与 providers
artifacts/                            `npm run compile` 生成的 ABI/bytecode（构建产物）
```

权威编译 artifact 由 Hardhat 从合约源码生成：

```text
artifacts/contracts/PropertyToken.sol/PropertyToken.json
```

不要手工修改构建 artifact 或生成 ABI；修改 Solidity 后重新运行 `npm run compile`。npm 的 `postcompile` 会同时更新 `abi/PropertyToken.json` 和前端 TypeScript ABI，避免前端手写 ABI 漂移。生产构建后可用 `npm run export:verification` 重新导出 Etherscan/Sourcify 标准 JSON 输入。

## 本地运行

要求 Node.js `>=22.13.0`。在本目录执行：

```bash
npm ci
npm run compile
npm test
npm run dev
```

然后打开 <http://localhost:3000>。如需连接前端，在 `.env.local` 中设置：

```dotenv
NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS=0xYourVerifiedSepoliaContract
```

`NEXT_PUBLIC_` 变量会进入浏览器 bundle，只能放公开的合约地址，绝不能放私钥或 API key。地址缺失或格式无效时，前端保持说明状态；钱包不在 Sepolia 时禁用链上写操作并提示切换网络。用户仍须独立核对该地址确实对应本仓库的已验证部署。

## 环境变量

部署与验证命令从当前 shell 读取以下变量：

| 变量 | 用途 | 是否敏感 |
| --- | --- | --- |
| `SEPOLIA_RPC_URL` | Sepolia JSON-RPC endpoint；链上检查与源码验证需要 | 通常包含服务商凭据 |
| `SEPOLIA_PRIVATE_KEY` | 仅在重新部署时用于支付 gas；既有合约验证不需要 | **是** |
| `ETHERSCAN_API_KEY` | Etherscan 源码验证 | **是** |
| `NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS` | 前端连接的已部署合约地址 | 否，公开变量 |

示例（不要把真实值提交到 Git）：

```bash
export SEPOLIA_RPC_URL='https://your-sepolia-rpc.example'
export SEPOLIA_PRIVATE_KEY='your-deployer-private-key'
export ETHERSCAN_API_KEY='your-etherscan-api-key'
export NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS='0xYourVerifiedSepoliaContract'
```

验证既有部署时只设置 `SEPOLIA_RPC_URL` 与 `ETHERSCAN_API_KEY`，不要把部署私钥加载进验证进程。只有执行 `deploy:sepolia` 时才设置 `SEPOLIA_PRIVATE_KEY`。部署账户只应持有必要的 Sepolia 测试 ETH。演示部署完成后，应把生产类角色分配给独立、多签或受控账户；本演示的单一部署者便利配置不等于生产密钥管理方案。

## 校验命令

提交前建议完整执行：

```bash
npm run compile
npm test
npm run check:sepolia
npm run coverage
npm run lint
npm run typecheck
npm run build
npm audit
```

- `compile` 重新生成 Solidity ABI 与 bytecode artifact。
- `test` 包含 O(1) 分红、转账修正、权限、KYC、重入、舍入、gas scaling、暂停、估值和 Oracle staleness 场景；gas scaling 是测试断言，不是对任意网络 gas 价格的承诺。
- `check:sepolia` 从已提交 manifest 核验部署/初始化交易、runtime bytecode、供应、管理员、角色、Oracle、估值与 Sourcify exact match；需要 `SEPOLIA_RPC_URL`。
- `coverage` 报告测试覆盖路径；高覆盖率不等于安全审计。
- `lint`、`typecheck` 和 `build` 分别检查静态规则、完整仓库 TypeScript 类型与生产构建。`next build` 使用 `tsconfig.next.json`，只检查可部署前端；Hardhat 测试和部署脚本仍由完整 `typecheck` 在 `compile` 生成 artifacts 后独立检查，因此 Vercel 不依赖未提交的本地 Hardhat artifacts。
- `npm audit` 检查 npm 已知漏洞数据库。它不分析 Solidity、协议经济模型、链下法律安排或尚未公开的漏洞，也不能替代人工依赖审查与合约审计。

2026-07-18 对当前 lockfile 的复核结果是：`npm audit --omit=dev` 为 **0**；完整 `npm audit` 为 **14 个（7 low、7 high）**。高等级告警来自开发期 Hardhat 工具链中的 `hardhat -> adm-zip` 和 `@nomicfoundation/hardhat-verify -> @ethersproject/* -> elliptic`，不进入 Next.js 生产依赖或浏览器 bundle。当前最新 Hardhat 仍依赖受影响的 `adm-zip` 范围，不能通过盲目升级或隐藏完整审计结果来宣称已经修复；仓库在 [`SECURITY.md`](SECURITY.md) 中记录临时控制、上游状态和复核要求，并用 `npm audit --omit=dev` 作为生产依赖的硬性 CI 门。告警会随 advisory 数据库和 lockfile 变化；发布证据仍应保存当次命令输出、lockfile 和 commit SHA，不能因为 `next build` 成功就忽略 lint、测试或 audit 失败。

## O(1) magnified dividend-per-share

分红采用“累计每股分红”记账，而不是在存入时循环给每个地址写余额。设高精度常量为 `M`、当前累计每股值为 `D`：

```text
存入 x wei:       D += floor(x * M / totalSupply)
累计权益(account): floor((D * balance(account) + correction(account)) / M)
可领取(account):   累计权益(account) - 已领取(account)
```

一次存入、一次查询和一次领取只进行固定数量的存储读写，复杂度相对持有人数量为 O(1)。这不意味着 gas 恒等，也不消除 EVM 状态冷热、编译器版本等因素带来的差异。

ERC-20 转账时必须同步修正历史权益。转出 `amount` 时：

```text
correction(from) += D * amount
correction(to)   -= D * amount
```

因此，转账前已经累积的分红仍属于转出方；接收方只从收到代币后参与后续分红，不会继承历史分红，也不会因转账造成重复领取。测试覆盖分红前后多次转账和持有人数量增长场景。

Solidity 整数除法向下取整，极小分红可能形成不可分配的 wei dust。测试要求总领取额不超过实际存入额，并覆盖小额、多账户及重复分配的舍入边界；演示不承诺每个 wei 都能按任意持仓比例精确拆分。

### ETH pull claim 与重入防护

分红分发者通过 `depositYield()` 存入 ETH；合约不会主动循环向持有人推送。每个持有人调用 `claimYield()` 拉取自己的 ETH：

1. 计算当前可领取额；
2. 先更新已领取记账；
3. 再执行 ETH 转账；
4. 使用重入保护阻止回调重复领取，转账失败则整个交易回滚。

这只保护合约内的领取记账，不保证接收钱包安全，也不代表链下银行现金流已经到账。

## 权限、KYC 与暂停

| 角色 | 合约权限 |
| --- | --- |
| `DEFAULT_ADMIN_ROLE` | 授予/撤销运维角色；默认管理员变更必须经过 48 小时延迟和新管理员接受两步 |
| `COMPLIANCE_ROLE` | 添加或移除钱包白名单 |
| `DIVIDEND_DISTRIBUTOR_ROLE` | 通过 `depositYield()` 存入可分配 ETH |
| `VALUATION_ROLE` | 更新人工物业估值、日期与报告哈希 |
| `ORACLE_MANAGER_ROLE` | 更换 ETH/USD feed 与最大允许陈旧时间 |
| `PAUSER_ROLE` | 暂停或恢复代币转账和新的 ETH 分红存入；不阻断合规地址领取已累积分红 |

KYC/AML 不在 Solidity 中完成。合规运营方在线下核验身份、制裁名单、投资者资格和钱包归属后，由 `COMPLIANCE_ROLE` 把结果映射为 `address => allowed`。链上白名单：

- 不保存姓名或证件，也无法证明操作钱包的人仍是原受审查人；
- 不能替代持续监控、到期复核、制裁筛查或司法辖区要求；
- 被移出白名单会阻止其转账和领取，但不会清零已累积分红；恢复白名单后可继续领取。冻结、申诉和纠错流程必须在法律文件中明确；
- 合规角色私钥泄露、错误映射或恶意操作仍是中心化风险。

暂停只阻止代币转账和新的 `depositYield()`；已通过白名单的地址仍可调用 `claimYield()` 领取暂停前已累积的分红。它是事故响应工具，不是资产追回机制。管理员与各运维角色应使用独立账户、硬件签名或多签，并对授权、撤权、白名单、估值和 Oracle 更新事件进行链下监控。

## 估值与 Chainlink Oracle

这两类数值必须严格区分：

### 人工物业估值

`getRealWorldValuation()` 返回由 `VALUATION_ROLE` 写入的物业估值，单位为 **USD、18 位小数**。`getValuationDetails()` 同时返回：

- `valuationUsd`：人工录入值；
- `effectiveAt`：报告的估值基准时间；
- `recordedAt`：上链记录时间；
- `reportHash`：链下报告文件内容的哈希承诺。

报告哈希只能证明“之后提供的文件是否与当时承诺的字节一致”，不能证明报告真实、独立、完整、合法或仍然有效。报告文件、估价机构、方法、签名、存储位置和更新政策都属于链下治理。演示部署初始化的 `10,000,000 USD` 只是测试数据，不是 Chainlink 报价，也不代表真实物业。

### Chainlink ETH/USD

`getEthUsdPrice()` 读取 ETH/USD feed；合约拒绝非正数、未完成或超过允许最大时效的结果，并把精度规范化。`claimableYieldUsd(account)` 仅按该参考价把可领取 ETH 换算为 USD 展示值：

```text
claimableYieldUsd = claimable ETH × ETH/USD reference price
```

它不会支付美元，也不会改变 `claimableYield(account)` 的 ETH 数量。Oracle 陈旧或不可用时，USD 参考读取可以失败，但 ETH 分红记账和人工物业估值是独立路径。默认演示最大时效为 3 小时；该阈值不是对所有生产场景的建议。

## Sepolia 部署与验证

先执行完整校验并确认部署账户、treasury、初始管理员和 Chainlink feed 参数。部署脚本使用构造参数：

```text
PropertyToken(initialAdmin, treasury, initialOracle, initialOracleMaxAge)
```

演示脚本把 Oracle 最大时效设为 3 小时，并写入带演示声明哈希的 `10,000,000 USD` 初始人工估值。该初始化只为了呈现接口，不是尽调结论。

```bash
npm run compile
npm test
npm run deploy:sepolia
npm run check:sepolia
```

部署脚本会等待确认、写入 `deployments/sepolia/PropertyToken.json`、尝试 Etherscan 与 Sourcify 验证，并在任一验证未完成时返回非零状态。保存命令输出中的合约地址和部署交易哈希，并独立在 Sepolia 区块浏览器核对 bytecode、构造参数、角色事件和初始化交易。若 Etherscan 因缺少 API key 未完成，可在配置密钥后读取已提交 manifest，以部署时的**完全相同**构造参数重试，并自动更新 manifest 的验证状态：

```bash
npm run verify:deployment
```

也可以直接调用底层 Hardhat verify 命令：

```bash
npm run verify:sepolia -- \
  0xDeployedContract \
  0xInitialAdmin \
  0xTreasury \
  0xChainlinkEthUsdFeed \
  10800
```

验证完成后还应：

1. 在 Etherscan 检查编译器、优化设置和 constructor arguments 与本 commit 一致；
2. 向 Sourcify 提交同一编译 metadata 并核对 bytecode match；
3. 把 `NEXT_PUBLIC_PROPERTY_TOKEN_ADDRESS` 设为验证后的地址，重新运行 `lint`、`typecheck` 和 `build`；
4. 用真实 Etherscan、Sourcify 和部署交易 URL 替换 README 顶部对应的 `<!-- DEPLOYMENT_* -->` 项；
5. 记录 commit SHA、deployer、初始角色持有人、RPC chain ID、部署时间和验证结果。

源码验证只能证明部署 bytecode 与某份源码/配置匹配，不能证明合约安全、法律结构有效或输入的估值与 KYC 数据真实。

## 现实世界运营模型

本合约只实现链上记账。若要代表真实房地产，至少需要独立、可执行且经过法律审查的链下结构：

1. **SPV 与权利定义**：通常由特定目的实体持有物业，法律文件明确代币究竟代表股份、债权、收益权还是纯技术凭证，以及持有人表决、信息、赎回和处置权。链上 ERC-20 本身不会自动转移不动产产权。
2. **资产托管与产权**：产权登记、抵押、保险、维修和物业管理发生在链下；合资格托管人、受托人或管理人保管文件与控制权，并定期将登记信息和链上供应对账。
3. **银行现金流**：租户把租金支付到 SPV/受控银行账户。运营方在扣除税费、维修、管理费、债务偿付和储备后，依据已批准分配政策决定可分配金额，再完成 fiat/ETH 转换并调用 `depositYield()`。合约不会读取银行账户，也无法证明存入 ETH 来自该物业。
4. **KYC 映射**：受监管运营方在线下完成身份、AML、制裁和资格检查，再把获准钱包映射到链上白名单，并维护换钱包、失窃、继承、冻结和复核流程。
5. **估值更新**：独立估价报告保存在可长期访问且访问受控的位置；链上记录 USD 数值、生效时间和文件哈希。更新频率、估价师资格、重大事件触发条件和争议处理必须由法律及运营文件规定。
6. **对账与披露**：持续对账 token cap table、SPV 股东/持有人登记、银行流水、应付分红、未领取 ETH、税务与费用，并向持有人披露差异和纠正记录。

本仓库没有设立 SPV、托管物业、接入银行、执行 KYC、购买保险、签署租约或提供估值报告；演示变量和哈希不能被解释为这些现实安排已经存在。

## 主要风险

- **物业与违约风险**：空置、租户欠租、维修、灾害、保险不足、利率、税务、抵押权人优先受偿及物业贬值都可能减少或中断现金流。
- **SPV 与破产隔离风险**：破产隔离依赖实体设立、独立账簿、资金不混同、有限目的条款和当地法院执行；“SPV”名称或智能合约不能保证隔离有效，也不能阻止法律挑战。
- **托管、银行与转换风险**：产权文件、银行账户、私钥、fiat/ETH 兑换方或管理人可能被盗、冻结、破产、制裁或操作失误，链上代码无法自动纠正链下损失。
- **执行风险**：违约处置、抵押权执行、出售物业、追索管理人和向持有人分配清算款需要受托人、法院及现实资产控制。代币合约不能自行查封或出售物业。
- **估值风险**：估值可能主观、滞后、有利益冲突或使用错误假设；报告哈希不验证报告内容。链上价格不等于可成交价格或净资产值。
- **流动性风险**：项目不承诺交易所、做市、赎回或买方。白名单、证券法规、网络拥堵和钱包限制会进一步降低可转让性。
- **Oracle 风险**：feed 可能陈旧、暂停、配置错误或遭受异常市场影响。Oracle 管理员可能误设地址或时效。这里的 Oracle 只影响 ETH 分红的 USD 参考显示，仍可能误导用户。
- **管理员与合规风险**：角色账户可更改白名单、估值、Oracle 或暂停状态。延迟交接降低部分风险，但不能消除密钥泄露、串谋、审查、错误操作或治理失灵。
- **智能合约风险**：权限、精度、舍入、重入、编译器、依赖、前端 ABI 或未覆盖交互可能存在缺陷。固定不可升级设计避免代理升级风险，但发现缺陷时通常需要部署新合约并制定迁移方案。
- **网络与前端风险**：Sepolia、RPC、钱包、浏览器和第三方服务可能中断或显示错误；用户应在钱包中独立核对 chain ID、目标地址、函数和金额。
- **法律、监管与税务风险**：代币可能在某些司法辖区被视为证券或其他受监管产品。发行、转让、营销、KYC/AML、数据保护、税务和投资者资格必须由当地专业人士判断。

## 安全与生产使用

在任何主网或真实资产场景前，至少需要独立智能合约审计、法律意见、威胁建模、角色与多签方案、监控和事件响应、Oracle 故障预案、链下账务审计、灾难恢复及受控迁移流程。测试通过、源码验证和 README 披露都不能替代这些工作。
