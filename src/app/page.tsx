'use client'

import { useState } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { injected } from 'wagmi/connectors'
import { sepolia } from 'wagmi/chains'
import { formatEther, formatUnits, isAddress, parseEther } from 'viem'
import {
  propertyTokenAbi,
  propertyTokenAddress,
} from '@/contracts/propertyToken'
import { dictionaries, type Language } from '../locales'

type WriteAction = 'deposit' | 'claim' | 'transfer'

function formatDecimal(
  value: bigint | undefined,
  decimals: number,
  language: Language,
  maximumFractionDigits = 4,
) {
  if (value === undefined) return '—'

  const formatted = formatUnits(value, decimals)
  const numericValue = Number(formatted)
  if (!Number.isFinite(numericValue)) return formatted

  return new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    maximumFractionDigits,
  }).format(numericValue)
}

function formatTimestamp(timestamp: bigint | undefined, language: Language) {
  if (!timestamp) return '—'

  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(Number(timestamp) * 1_000)) + ' UTC'
}

function shortHex(value: string | undefined) {
  if (!value || /^0x0+$/.test(value)) return '—'
  return `${value.slice(0, 10)}…${value.slice(-8)}`
}

function errorMessage(error: unknown) {
  if (!error) return ''
  if (typeof error === 'object' && 'shortMessage' in error) {
    const shortMessage = (error as { shortMessage?: unknown }).shortMessage
    if (typeof shortMessage === 'string') return shortMessage
  }
  if (error instanceof Error) return error.message.split('\n')[0]
  return String(error)
}

function parsePositiveAmount(value: string) {
  try {
    const amount = parseEther(value)
    return amount > BigInt(0) ? amount : undefined
  } catch {
    return undefined
  }
}

export default function Home() {
  const [language, setLanguage] = useState<Language>('en')
  const [recipient, setRecipient] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [depositAmount, setDepositAmount] = useState('0.01')
  const [activeAction, setActiveAction] = useState<WriteAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const t = dictionaries[language]
  const { address, chainId, isConnected } = useAccount()
  const {
    connect,
    error: connectError,
    isPending: isConnecting,
  } = useConnect()
  const { disconnect } = useDisconnect()
  const {
    switchChain,
    error: switchError,
    isPending: isSwitching,
  } = useSwitchChain()
  const {
    data: transactionHash,
    error: writeError,
    isPending: isWaitingForWallet,
    reset: resetWrite,
    writeContractAsync,
  } = useWriteContract()
  const {
    error: receiptError,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({ hash: transactionHash })

  const readEnabled = Boolean(propertyTokenAddress)
  const wrongNetwork = isConnected && chainId !== sepolia.id
  const recipientAddress = isAddress(recipient) ? recipient : undefined
  const parsedTransferAmount = parsePositiveAmount(transferAmount)
  const parsedDepositAmount = parsePositiveAmount(depositAmount)

  const {
    data: realWorldValuation,
    error: valuationError,
  } = useReadContract({
    address: propertyTokenAddress,
    abi: propertyTokenAbi,
    functionName: 'getRealWorldValuation',
    chainId: sepolia.id,
    query: { enabled: readEnabled, refetchInterval: 15_000 },
  })
  const { data: valuationDetails, error: valuationDetailsError } =
    useReadContract({
      address: propertyTokenAddress,
      abi: propertyTokenAbi,
      functionName: 'getValuationDetails',
      chainId: sepolia.id,
      query: { enabled: readEnabled, refetchInterval: 15_000 },
    })
  const { data: oracleData, error: oracleError } = useReadContract({
    address: propertyTokenAddress,
    abi: propertyTokenAbi,
    functionName: 'getEthUsdPrice',
    chainId: sepolia.id,
    query: { enabled: readEnabled, refetchInterval: 15_000 },
  })
  const { data: oracleMaxAge, error: oracleMaxAgeError } = useReadContract({
    address: propertyTokenAddress,
    abi: propertyTokenAbi,
    functionName: 'oracleMaxAge',
    chainId: sepolia.id,
    query: { enabled: readEnabled, staleTime: 60_000 },
  })
  const { data: totalSupply, error: supplyError } = useReadContract({
    address: propertyTokenAddress,
    abi: propertyTokenAbi,
    functionName: 'totalSupply',
    chainId: sepolia.id,
    query: { enabled: readEnabled, refetchInterval: 15_000 },
  })
  const { data: isPaused, error: pausedError } = useReadContract({
    address: propertyTokenAddress,
    abi: propertyTokenAbi,
    functionName: 'paused',
    chainId: sepolia.id,
    query: { enabled: readEnabled, refetchInterval: 10_000 },
  })
  const { data: balance, error: balanceError } = useReadContract({
    address: propertyTokenAddress,
    abi: propertyTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: Boolean(propertyTokenAddress && address),
      refetchInterval: 10_000,
    },
  })
  const { data: claimable, error: claimableError } = useReadContract({
    address: propertyTokenAddress,
    abi: propertyTokenAbi,
    functionName: 'claimableYield',
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: Boolean(propertyTokenAddress && address),
      refetchInterval: 10_000,
    },
  })
  const { data: claimableUsd, error: claimableUsdError } = useReadContract({
    address: propertyTokenAddress,
    abi: propertyTokenAbi,
    functionName: 'claimableYieldUsd',
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: Boolean(propertyTokenAddress && address),
      refetchInterval: 10_000,
    },
  })
  const { data: accountWhitelisted, error: accountWhitelistError } =
    useReadContract({
      address: propertyTokenAddress,
      abi: propertyTokenAbi,
      functionName: 'isWhitelisted',
      args: address ? [address] : undefined,
      chainId: sepolia.id,
      query: {
        enabled: Boolean(propertyTokenAddress && address),
        refetchInterval: 10_000,
      },
    })
  const { data: recipientWhitelisted, error: recipientWhitelistError } =
    useReadContract({
      address: propertyTokenAddress,
      abi: propertyTokenAbi,
      functionName: 'isWhitelisted',
      args: recipientAddress ? [recipientAddress] : undefined,
      chainId: sepolia.id,
      query: {
        enabled: Boolean(propertyTokenAddress && recipientAddress),
        refetchInterval: 10_000,
      },
    })
  const { data: distributorRole, error: distributorRoleError } =
    useReadContract({
      address: propertyTokenAddress,
      abi: propertyTokenAbi,
      functionName: 'DIVIDEND_DISTRIBUTOR_ROLE',
      chainId: sepolia.id,
      query: { enabled: readEnabled, staleTime: Number.POSITIVE_INFINITY },
    })
  const { data: isDistributor, error: roleCheckError } = useReadContract({
    address: propertyTokenAddress,
    abi: propertyTokenAbi,
    functionName: 'hasRole',
    args: distributorRole && address ? [distributorRole, address] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: Boolean(propertyTokenAddress && distributorRole && address),
      refetchInterval: 15_000,
    },
  })

  const firstReadError = [
    valuationError,
    valuationDetailsError,
    oracleError,
    oracleMaxAgeError,
    supplyError,
    pausedError,
    balanceError,
    claimableError,
    claimableUsdError,
    accountWhitelistError,
    recipientWhitelistError,
    distributorRoleError,
    roleCheckError,
  ].find(Boolean)

  let transferIssue: string | null = null
  if (recipient && !recipientAddress) transferIssue = t.invalidRecipient
  else if (
    recipientAddress &&
    address &&
    recipientAddress.toLowerCase() === address.toLowerCase()
  ) {
    transferIssue = t.selfTransfer
  } else if (recipientAddress && recipientWhitelisted === undefined) {
    transferIssue = t.checkingRecipient
  } else if (recipientAddress && recipientWhitelisted === false) {
    transferIssue = t.recipientNotWhitelisted
  } else if (transferAmount && !parsedTransferAmount) {
    transferIssue = t.invalidAmount
  } else if (
    parsedTransferAmount &&
    balance !== undefined &&
    parsedTransferAmount > balance
  ) {
    transferIssue = t.insufficientBalance
  }

  const writeReady = Boolean(propertyTokenAddress && isConnected && !wrongNetwork)
  const canClaim = Boolean(
    writeReady && accountWhitelisted && claimable && claimable > BigInt(0),
  )
  const canTransfer = Boolean(
    writeReady &&
      isPaused === false &&
      accountWhitelisted &&
      recipientAddress &&
      recipientWhitelisted &&
      parsedTransferAmount &&
      balance !== undefined &&
      parsedTransferAmount <= balance &&
      address &&
      recipientAddress.toLowerCase() !== address.toLowerCase(),
  )
  const canDeposit = Boolean(
    writeReady && isPaused === false && isDistributor && parsedDepositAmount,
  )
  const writeBusy = isWaitingForWallet || isConfirming

  async function handleDeposit() {
    if (!propertyTokenAddress || !canDeposit || !parsedDepositAmount) {
      setActionError(t.invalidAmount)
      return
    }

    setActiveAction('deposit')
    setActionError(null)
    resetWrite()
    try {
      await writeContractAsync({
        address: propertyTokenAddress,
        abi: propertyTokenAbi,
        functionName: 'depositYield',
        chainId: sepolia.id,
        value: parsedDepositAmount,
      })
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }

  async function handleClaim() {
    if (!propertyTokenAddress || !canClaim) {
      setActionError(t.walletRequired)
      return
    }

    setActiveAction('claim')
    setActionError(null)
    resetWrite()
    try {
      await writeContractAsync({
        address: propertyTokenAddress,
        abi: propertyTokenAbi,
        functionName: 'claimYield',
        chainId: sepolia.id,
      })
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }

  async function handleTransfer() {
    if (
      !propertyTokenAddress ||
      !canTransfer ||
      !recipientAddress ||
      !parsedTransferAmount
    ) {
      setActionError(transferIssue || t.walletRequired)
      return
    }

    setActiveAction('transfer')
    setActionError(null)
    resetWrite()
    try {
      await writeContractAsync({
        address: propertyTokenAddress,
        abi: propertyTokenAbi,
        functionName: 'transfer',
        args: [recipientAddress, parsedTransferAmount],
        chainId: sepolia.id,
      })
      setRecipient('')
      setTransferAmount('')
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }

  const actionLabel = activeAction
    ? {
        deposit: t.actionDeposit,
        claim: t.actionClaim,
        transfer: t.actionTransfer,
      }[activeAction]
    : ''
  const transactionError =
    actionError || errorMessage(receiptError) || errorMessage(writeError)

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 font-sans text-white md:px-10 md:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-6 border-b border-slate-800 pb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              {t.testnetNotice}
            </div>
            <h1 className="mb-2 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-4xl font-extrabold text-transparent">
              {t.title}
            </h1>
            <p className="text-slate-400">{t.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3" suppressHydrationWarning>
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
              className="h-10 min-w-10 rounded-full border border-slate-700 bg-slate-900 px-3 font-bold text-slate-300 transition hover:border-emerald-400 hover:text-white"
            >
              {t.languageBtn}
            </button>
            {isConnected ? (
              <button
                type="button"
                onClick={() => disconnect()}
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm transition hover:border-red-500/60 hover:bg-red-950/40"
              >
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                {address?.slice(0, 6)}…{address?.slice(-4)} · {t.disconnect}
              </button>
            ) : (
              <button
                type="button"
                disabled={isConnecting}
                onClick={() => connect({ connector: injected() })}
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold shadow-lg shadow-blue-950 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConnecting ? t.connecting : t.connectWallet}
              </button>
            )}
          </div>
        </header>

        {!propertyTokenAddress && (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
            {t.contractNotConfigured}
          </div>
        )}

        {wrongNetwork && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <span>{t.wrongNetwork}</span>
            <button
              type="button"
              disabled={isSwitching}
              onClick={() => switchChain({ chainId: sepolia.id })}
              className="rounded-lg bg-amber-400 px-4 py-2 font-bold text-slate-950 disabled:opacity-60"
            >
              {isSwitching ? t.switchingNetwork : t.switchNetwork}
            </button>
          </div>
        )}

        {(connectError || switchError) && (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
            {errorMessage(connectError || switchError)}
          </div>
        )}

        {firstReadError && (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
            <strong>{t.readError}:</strong> {errorMessage(firstReadError)}
          </div>
        )}

        {isPaused && (
          <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-100">
            {t.paused}
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <article className="rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl lg:col-span-2">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-200">
                  {t.assetInfoTitle}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t.manualValuation}
                </p>
              </div>
              {propertyTokenAddress && (
                <a
                  href={`https://sepolia.etherscan.io/address/${propertyTokenAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-400 underline decoration-blue-400/40 underline-offset-4 hover:text-blue-300"
                >
                  {t.contractLink}
                </a>
              )}
            </div>

            <p className="mb-8 text-4xl font-bold tracking-tight text-emerald-400 md:text-5xl">
              ${formatDecimal(realWorldValuation, 18, language, 2)}
            </p>

            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-950/60 p-4">
                <dt className="text-slate-500">{t.valuationEffectiveAt}</dt>
                <dd className="mt-1 font-medium text-slate-200">
                  {formatTimestamp(valuationDetails?.[1], language)}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-950/60 p-4">
                <dt className="text-slate-500">{t.valuationRecordedAt}</dt>
                <dd className="mt-1 font-medium text-slate-200">
                  {formatTimestamp(valuationDetails?.[2], language)}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-950/60 p-4 sm:col-span-2">
                <dt className="text-slate-500">{t.valuationReportHash}</dt>
                <dd
                  className="mt-1 break-all font-mono text-slate-200"
                  title={valuationDetails?.[3]}
                >
                  {shortHex(valuationDetails?.[3])}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-5">
              <span className="text-slate-400">{t.totalIssued}</span>
              <span className="text-lg font-semibold">
                {formatDecimal(totalSupply, 18, language, 2)} PRES
              </span>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
            <h2 className="mb-6 text-xl font-semibold text-slate-200">
              {t.oracleTitle}
            </h2>
            <p className="mb-8 text-3xl font-bold text-blue-400">
              ${
                oracleData
                  ? formatDecimal(oracleData[0], oracleData[1], language, 2)
                  : '—'
              }
            </p>
            <dl className="space-y-5 text-sm">
              <div>
                <dt className="text-slate-500">{t.oracleUpdatedAt}</dt>
                <dd className="mt-1 text-slate-200">
                  {formatTimestamp(oracleData?.[2], language)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{t.oracleFreshness}</dt>
                <dd
                  className={`mt-1 font-semibold ${
                    oracleData && !oracleError ? 'text-emerald-400' : 'text-red-300'
                  }`}
                >
                  {oracleData && !oracleError
                    ? t.oracleFresh
                    : t.oracleUnavailable}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">{t.oracleMaxAge}</dt>
                <dd className="mt-1 text-slate-200">
                  {oracleMaxAge?.toString() ?? '—'} {t.seconds}
                </dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
            <h2 className="mb-6 text-xl font-semibold text-slate-200">
              {t.myPortfolio}
            </h2>
            <div className="mb-4 rounded-2xl bg-slate-950/60 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <span className="text-slate-400">{t.holdings}</span>
                <span className="text-2xl font-bold">
                  {formatDecimal(balance, 18, language)} PRES
                </span>
              </div>
            </div>
            <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-slate-950/60 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <span className="text-slate-400">{t.claimableYield}</span>
                <span className="text-2xl font-extrabold text-emerald-400">
                  {claimable === undefined ? '—' : formatEther(claimable)} ETH
                </span>
              </div>
              <div className="mt-3 flex justify-between text-sm text-slate-500">
                <span>{t.claimableYieldUsd}</span>
                <span>${formatDecimal(claimableUsd, 18, language, 2)}</span>
              </div>
            </div>

            <p
              className={`mb-5 text-sm ${
                accountWhitelisted ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {!isConnected
                ? t.whitelistUnknown
                : accountWhitelisted === undefined
                  ? t.whitelistPending
                  : accountWhitelisted
                    ? t.whitelisted
                    : t.notWhitelisted}
            </p>

            <button
              type="button"
              disabled={!canClaim || writeBusy}
              onClick={handleClaim}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 font-bold transition hover:from-emerald-400 hover:to-emerald-500 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400"
            >
              {t.claimButton}
            </button>
          </article>

          <article className="rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
            <h2 className="mb-6 text-xl font-semibold text-slate-200">
              {t.depositTitle}
            </h2>
            {isDistributor ? (
              <div className="space-y-4">
                <label className="block text-sm text-slate-400" htmlFor="deposit-amount">
                  {t.depositAmount}
                </label>
                <input
                  id="deposit-amount"
                  type="text"
                  inputMode="decimal"
                  value={depositAmount}
                  onChange={(event) => {
                    setDepositAmount(event.target.value)
                    setActionError(null)
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                />
                {depositAmount && !parsedDepositAmount && (
                  <p className="text-sm text-red-300">{t.invalidAmount}</p>
                )}
                <button
                  type="button"
                  disabled={!canDeposit || writeBusy}
                  onClick={handleDeposit}
                  className="w-full rounded-xl border border-blue-500/50 bg-blue-600/20 py-3.5 font-bold text-blue-300 transition hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500"
                >
                  {t.depositButton}
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5 text-sm leading-6 text-slate-400">
                {t.distributorOnly}
              </div>
            )}
          </article>
        </section>

        <section className="mb-6 rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl">
          <h2 className="mb-6 text-xl font-semibold text-slate-200">
            {t.transferTitle}
          </h2>
          <div className="grid gap-4 md:grid-cols-[1fr_12rem_auto]">
            <input
              type="text"
              spellCheck={false}
              placeholder={t.recipientAddress}
              value={recipient}
              onChange={(event) => {
                setRecipient(event.target.value.trim())
                setActionError(null)
              }}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder={t.transferAmount}
              value={transferAmount}
              onChange={(event) => {
                setTransferAmount(event.target.value)
                setActionError(null)
              }}
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
            />
            <button
              type="button"
              disabled={!canTransfer || writeBusy}
              onClick={handleTransfer}
              className="rounded-xl bg-blue-600 px-6 py-3 font-bold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {t.confirmTransfer}
            </button>
          </div>
          {(recipient || transferAmount) && transferIssue && (
            <p className="mt-3 text-sm text-amber-300">{transferIssue}</p>
          )}
        </section>

        {(activeAction || transactionError) && (
          <section
            className="mb-6 rounded-2xl border border-blue-500/30 bg-blue-950/20 p-5"
            aria-live="polite"
          >
            <h2 className="font-semibold text-blue-200">{t.transactionTitle}</h2>
            {activeAction && (
              <p className="mt-2 text-sm text-slate-400">{actionLabel}</p>
            )}
            {isWaitingForWallet && (
              <p className="mt-2 text-sm text-blue-200">{t.walletConfirmation}</p>
            )}
            {transactionHash && isConfirming && (
              <p className="mt-2 text-sm text-blue-200">{t.transactionPending}</p>
            )}
            {transactionHash && isConfirmed && (
              <p className="mt-2 text-sm font-semibold text-emerald-400">
                {t.transactionSuccess}
              </p>
            )}
            {transactionError && (
              <p className="mt-2 break-words text-sm text-red-300">
                {t.transactionFailed}: {transactionError}
              </p>
            )}
            {transactionHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm text-blue-400 underline decoration-blue-400/40 underline-offset-4 hover:text-blue-300"
              >
                {t.viewTransaction} · {shortHex(transactionHash)}
              </a>
            )}
          </section>
        )}

        <aside className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-5 text-sm leading-6 text-amber-100/80">
          <h2 className="mb-1 font-semibold text-amber-200">{t.riskTitle}</h2>
          <p>{t.riskNotice}</p>
        </aside>
      </div>
    </main>
  )
}
