import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  createPublicClient,
  getAddress,
  http,
  type Abi,
  type Address,
  type Hash,
} from 'viem'
import { sepolia } from 'viem/chains'

type DeploymentManifest = {
  address: Address
  abi: Abi
}

type DemoReport = {
  chainId: number
  contract: Address
  accounts: {
    deployer: Address
    participant: Address
  }
  invariants: {
    totalYieldDepositedWei: string
    totalYieldClaimedWei: string
  }
  transactions: Array<{
    step: string
    hash: Hash
  }>
}

const rpcUrl = process.env.SEPOLIA_RPC_URL
if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is required.')

const manifest = JSON.parse(
  await readFile('deployments/sepolia/PropertyToken.json', 'utf8'),
) as DeploymentManifest
const report = JSON.parse(
  await readFile('deployments/sepolia/PropertyToken.demo.json', 'utf8'),
) as DemoReport

assert.equal(report.chainId, sepolia.id)
assert.equal(getAddress(report.contract), getAddress(manifest.address))

const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) })
const receipts = await Promise.all(
  report.transactions.map(async (transaction) => ({
    step: transaction.step,
    hash: transaction.hash,
    receipt: await client.getTransactionReceipt({ hash: transaction.hash }),
  })),
)
for (const transaction of receipts) {
  assert.equal(
    transaction.receipt.status,
    'success',
    `${transaction.step} did not succeed`,
  )
}

const read = <T>(functionName: string, args: readonly unknown[] = []) =>
  client.readContract({
    address: manifest.address,
    abi: manifest.abi,
    functionName,
    args,
  }) as Promise<T>

const [
  totalSupply,
  deployerBalance,
  participantBalance,
  participantAllowed,
  totalYieldDeposited,
  totalYieldClaimed,
] = await Promise.all([
  read<bigint>('totalSupply'),
  read<bigint>('balanceOf', [report.accounts.deployer]),
  read<bigint>('balanceOf', [report.accounts.participant]),
  read<boolean>('isWhitelisted', [report.accounts.participant]),
  read<bigint>('totalYieldDeposited'),
  read<bigint>('totalYieldClaimed'),
])

assert.equal(deployerBalance, totalSupply)
assert.equal(participantBalance, 0n)
assert.equal(participantAllowed, false)
assert.ok(totalYieldDeposited >= BigInt(report.invariants.totalYieldDepositedWei))
assert.ok(totalYieldClaimed >= BigInt(report.invariants.totalYieldClaimedWei))

console.log(
  JSON.stringify(
    {
      network: sepolia.name,
      contract: manifest.address,
      transactionCount: receipts.length,
      successfulTransactions: receipts.length,
      finalState: {
        deployerHoldsEntireSupply: deployerBalance === totalSupply,
        participantTokenBalance: participantBalance.toString(),
        participantAllowlisted: participantAllowed,
        totalYieldDeposited: totalYieldDeposited.toString(),
        totalYieldClaimed: totalYieldClaimed.toString(),
      },
    },
    null,
    2,
  ),
)
