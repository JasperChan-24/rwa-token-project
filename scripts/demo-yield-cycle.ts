import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

import {
  concatHex,
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  getAddress,
  http,
  keccak256,
  parseEther,
  parseUnits,
  stringToHex,
  type Abi,
  type Address,
  type Hash,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const confirmationPhrase = 'EXECUTE_SEPOLIA_YIELD_DEMO'
const reportPath = 'deployments/sepolia/PropertyToken.demo.json'
const firstTransfer = parseUnits('1000', 18)
const secondTransfer = parseUnits('500', 18)
const depositedYield = parseEther('0.001')
const maximumDemoOutlay = parseEther('0.01')

type DeploymentManifest = {
  chainId: number
  address: Address
  deployer: Address
  abi: Abi
}

type TransactionRecord = {
  step: string
  hash: Hash
  blockNumber: string
  url: string
  blockscoutUrl: string
}

function requirePrivateKey(value: string | undefined): Hex {
  if (!value) {
    throw new Error('SEPOLIA_PRIVATE_KEY is required for the Sepolia demo.')
  }
  const normalized = value.startsWith('0x') ? value : `0x${value}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error('SEPOLIA_PRIVATE_KEY must contain exactly 32 bytes.')
  }
  return normalized as Hex
}

if (process.env.SEPOLIA_DEMO_CONFIRM !== confirmationPhrase) {
  throw new Error(
    `Refusing to send transactions. Set SEPOLIA_DEMO_CONFIRM=${confirmationPhrase} only after reviewing this bounded Sepolia-only workflow.`,
  )
}

const rpcUrl = process.env.SEPOLIA_RPC_URL
if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is required.')

const manifest = JSON.parse(
  await readFile('deployments/sepolia/PropertyToken.json', 'utf8'),
) as DeploymentManifest
assert.equal(manifest.chainId, sepolia.id)

const deployerPrivateKey = requirePrivateKey(process.env.SEPOLIA_PRIVATE_KEY)
const deployer = privateKeyToAccount(deployerPrivateKey)
assert.equal(getAddress(deployer.address), getAddress(manifest.deployer))

// Sepolia-only deterministic participant: recoverable from the deployer key if the
// process stops, but never persisted or printed. Do not reuse this derivation for
// production keys or value-bearing networks.
const participantPrivateKey = keccak256(
  concatHex([
    deployerPrivateKey,
    stringToHex('PropertyToken Sepolia yield demo participant v1'),
  ]),
)
const participant = privateKeyToAccount(participantPrivateKey)

const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
const deployerClient = createWalletClient({
  account: deployer,
  chain: sepolia,
  transport: http(rpcUrl),
})
const participantClient = createWalletClient({
  account: participant,
  chain: sepolia,
  transport: http(rpcUrl),
})

assert.equal(await publicClient.getChainId(), sepolia.id)
const contract = getAddress(manifest.address)
const read = <T>(functionName: string, args: readonly unknown[] = []) =>
  publicClient.readContract({
    address: contract,
    abi: manifest.abi,
    functionName,
    args,
  }) as Promise<T>

const transactions: TransactionRecord[] = []
async function confirmTransaction(step: string, hash: Hash): Promise<void> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  assert.equal(receipt.status, 'success', `${step} reverted: ${hash}`)
  const transaction = {
    step,
    hash,
    blockNumber: receipt.blockNumber.toString(),
    url: `https://sepolia.etherscan.io/tx/${hash}`,
    blockscoutUrl: `https://eth-sepolia.blockscout.com/tx/${hash}`,
  }
  transactions.push(transaction)
  console.log(`${step}: ${transaction.url}`)
}

const [
  deployerEthBefore,
  totalSupply,
  deployerTokensBefore,
  participantTokensBefore,
  participantAllowedBefore,
  totalYieldDepositedBefore,
  totalYieldClaimedBefore,
] = await Promise.all([
  publicClient.getBalance({ address: deployer.address }),
  read<bigint>('totalSupply'),
  read<bigint>('balanceOf', [deployer.address]),
  read<bigint>('balanceOf', [participant.address]),
  read<boolean>('isWhitelisted', [participant.address]),
  read<bigint>('totalYieldDeposited'),
  read<bigint>('totalYieldClaimed'),
])

assert.equal(totalSupply, parseUnits('10000', 18))
assert.equal(deployerTokensBefore, totalSupply)
assert.equal(participantTokensBefore, 0n)
assert.equal(participantAllowedBefore, false)
assert.equal(totalYieldDepositedBefore, 0n)
assert.equal(totalYieldClaimedBefore, 0n)

const fees = await publicClient.estimateFeesPerGas()
const maxFeePerGas = fees.maxFeePerGas ?? (await publicClient.getGasPrice())
const maxPriorityFeePerGas = fees.maxPriorityFeePerGas ?? 1n
const participantGasFunding = maxFeePerGas * 400_000n
assert.ok(
  depositedYield + participantGasFunding <= maximumDemoOutlay,
  'Current fee estimate exceeds the 0.01 Sepolia ETH demo cap.',
)
assert.ok(
  deployerEthBefore > maximumDemoOutlay,
  'Deployer balance is too low for the bounded demo and gas reserve.',
)

console.log(`Network: Sepolia (${sepolia.id})`)
console.log(`Contract: ${contract}`)
console.log(`Deployer: ${deployer.address}`)
console.log(`Demo participant: ${participant.address} (private key not persisted)`)
console.log(`Yield deposit: ${formatEther(depositedYield)} Sepolia ETH`)

await confirmTransaction(
  'allowlist participant',
  await deployerClient.writeContract({
    address: contract,
    abi: manifest.abi,
    functionName: 'setWhitelisted',
    args: [participant.address, true],
  }),
)

await confirmTransaction(
  'fund participant gas',
  await deployerClient.sendTransaction({
    to: participant.address,
    value: participantGasFunding,
  }),
)

await confirmTransaction(
  'transfer 1000 PRES before deposit',
  await deployerClient.writeContract({
    address: contract,
    abi: manifest.abi,
    functionName: 'transfer',
    args: [participant.address, firstTransfer],
  }),
)

await confirmTransaction(
  'deposit 0.001 ETH yield',
  await deployerClient.writeContract({
    address: contract,
    abi: manifest.abi,
    functionName: 'depositYield',
    value: depositedYield,
  }),
)

const claimableAfterDeposit = {
  deployer: await read<bigint>('claimableYield', [deployer.address]),
  participant: await read<bigint>('claimableYield', [participant.address]),
}

await confirmTransaction(
  'transfer 500 PRES after deposit',
  await deployerClient.writeContract({
    address: contract,
    abi: manifest.abi,
    functionName: 'transfer',
    args: [participant.address, secondTransfer],
  }),
)

const claimableAfterSecondTransfer = {
  deployer: await read<bigint>('claimableYield', [deployer.address]),
  participant: await read<bigint>('claimableYield', [participant.address]),
}
assert.deepEqual(claimableAfterSecondTransfer, claimableAfterDeposit)

await confirmTransaction(
  'participant claims historical yield',
  await participantClient.writeContract({
    address: contract,
    abi: manifest.abi,
    functionName: 'claimYield',
  }),
)

await confirmTransaction(
  'deployer claims remaining yield',
  await deployerClient.writeContract({
    address: contract,
    abi: manifest.abi,
    functionName: 'claimYield',
  }),
)

await confirmTransaction(
  'return 1500 PRES to deployer',
  await participantClient.writeContract({
    address: contract,
    abi: manifest.abi,
    functionName: 'transfer',
    args: [deployer.address, firstTransfer + secondTransfer],
  }),
)

await confirmTransaction(
  'remove participant allowlist flag',
  await deployerClient.writeContract({
    address: contract,
    abi: manifest.abi,
    functionName: 'setWhitelisted',
    args: [participant.address, false],
  }),
)

const participantEthBeforeSweep = await publicClient.getBalance({
  address: participant.address,
})
const sweepGas = 21_000n
const maximumSweepFee = sweepGas * maxFeePerGas
if (participantEthBeforeSweep > maximumSweepFee) {
  await confirmTransaction(
    'return participant Sepolia ETH',
    await participantClient.sendTransaction({
      to: deployer.address,
      value: participantEthBeforeSweep - maximumSweepFee,
      gas: sweepGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
    }),
  )
}

const [
  deployerTokensAfter,
  participantTokensAfter,
  participantAllowedAfter,
  totalYieldDepositedAfter,
  totalYieldClaimedAfter,
  contractEthAfter,
  participantEthAfter,
] = await Promise.all([
  read<bigint>('balanceOf', [deployer.address]),
  read<bigint>('balanceOf', [participant.address]),
  read<boolean>('isWhitelisted', [participant.address]),
  read<bigint>('totalYieldDeposited'),
  read<bigint>('totalYieldClaimed'),
  publicClient.getBalance({ address: contract }),
  publicClient.getBalance({ address: participant.address }),
])

assert.equal(deployerTokensAfter, totalSupply)
assert.equal(participantTokensAfter, 0n)
assert.equal(participantAllowedAfter, false)
assert.equal(totalYieldDepositedAfter, depositedYield)
assert.equal(
  totalYieldClaimedAfter,
  claimableAfterSecondTransfer.deployer + claimableAfterSecondTransfer.participant,
)
assert.equal(contractEthAfter, depositedYield - totalYieldClaimedAfter)

const report = {
  schemaVersion: 1,
  network: 'sepolia',
  chainId: sepolia.id,
  contract,
  executedAt: new Date().toISOString(),
  purpose:
    'Bounded Sepolia demonstration of allowlist, transfer, O(1) yield deposit, post-deposit transfer correction, pull claims, and cleanup.',
  privacy:
    'Only public addresses and transaction hashes are recorded. No private key is persisted or printed.',
  accounts: {
    deployer: deployer.address,
    participant: participant.address,
  },
  amounts: {
    firstTransferPres: formatUnits(firstTransfer, 18),
    secondTransferPres: formatUnits(secondTransfer, 18),
    depositedYieldEth: formatEther(depositedYield),
    deployerClaimEth: formatEther(claimableAfterSecondTransfer.deployer),
    participantClaimEth: formatEther(claimableAfterSecondTransfer.participant),
  },
  invariants: {
    claimableUnaffectedByPostDepositTransfer: true,
    finalDeployerPres: formatUnits(deployerTokensAfter, 18),
    finalParticipantPres: formatUnits(participantTokensAfter, 18),
    finalParticipantAllowlisted: participantAllowedAfter,
    totalYieldDepositedWei: totalYieldDepositedAfter.toString(),
    totalYieldClaimedWei: totalYieldClaimedAfter.toString(),
    unclaimedRoundingDustWei: contractEthAfter.toString(),
    participantRemainingSepoliaEth: formatEther(participantEthAfter),
  },
  transactions,
}

await mkdir('deployments/sepolia', { recursive: true })
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(`Demo report: ${reportPath}`)
