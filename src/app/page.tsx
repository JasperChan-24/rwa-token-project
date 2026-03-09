'use client'; 

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { parseAbi, formatEther, parseEther } from 'viem';
import { dictionaries, Language } from '../locales';

const CONTRACT_ADDRESS = "0xFCA6eda0C113A3D1C91c142592683100aC7E232b";

const ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function claimableYield(address) view returns (uint256)",
  "function depositYield() payable",
  "function claimYield()",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function getRealWorldValuation() view returns (uint256)" 
]);

export default function Home() {
  const [lang, setLang] = useState<Language>('en');
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const t = dictionaries[lang];

  const [recipient, setRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('');

  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContract } = useWriteContract();

  const { data: realWorldValuation } = useReadContract({
    address: CONTRACT_ADDRESS, abi: ABI, functionName: 'getRealWorldValuation', query: { refetchInterval: 5000 } 
  });
  
  const { data: totalSupply } = useReadContract({
    address: CONTRACT_ADDRESS, abi: ABI, functionName: 'totalSupply', query: { refetchInterval: 2000 } 
  });
  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESS, abi: ABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { refetchInterval: 2000 }
  });
  const { data: claimable } = useReadContract({
    address: CONTRACT_ADDRESS, abi: ABI, functionName: 'claimableYield', args: address ? [address] : undefined, query: { refetchInterval: 2000 }
  });

  const handleDeposit = () => writeContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: 'depositYield', value: parseEther('0.01') });
  const handleClaim = () => writeContract({ address: CONTRACT_ADDRESS, abi: ABI, functionName: 'claimYield' });

  const handleTransfer = () => {
    if (!recipient || !transferAmount) return;
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'transfer',
      args: [recipient as `0x${string}`, parseEther(transferAmount)],
    });
    setRecipient('');
    setTransferAmount('');
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6 md:p-12 font-sans relative">
      <button onClick={() => setLang(lang === 'en' ? 'zh' : 'en')} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center font-bold text-gray-300 hover:text-white hover:border-emerald-400 transition-all z-50 shadow-lg">
        {t.languageBtn}
      </button>

      <div className="max-w-6xl mx-auto">
        <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6 pr-16">
          <div>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2">{t.title}</h1>
            <p className="text-gray-400">{t.subtitle}</p>
          </div>
          {/* 🌟 修改这里：只有当 mounted 为 true 时，才渲染按钮 */}
          {!mounted ? null : isConnected ? (
            <button onClick={() => disconnect()} className="px-4 py-2 bg-gray-800 hover:bg-red-900/30 rounded-full border border-gray-700 text-sm flex items-center gap-2 transition-colors whitespace-nowrap">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              {address?.slice(0, 6)}...{address?.slice(-4)} ({t.disconnect})
            </button>
          ) : (
            <button onClick={() => connect({ connector: injected() })} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-sm shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all whitespace-nowrap">
              {t.connectWallet}
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-800 p-8 rounded-3xl border border-gray-700 shadow-2xl relative overflow-hidden">
            <h2 className="text-xl text-gray-400 mb-6 font-medium">{t.assetInfoTitle}</h2>
            <div className="mb-8">
              <p className="text-sm text-gray-500 mb-1">{t.assetValuation} (Chainlink Live)</p>
              {/* 💸 魔法发生的地方：不再写死 1000 万，而是动态渲染真实计算出的美元估值 */}
              <p className="text-4xl font-bold tracking-tight text-emerald-400">
                ${realWorldValuation ? Number(realWorldValuation).toLocaleString() : '---,---'}
              </p>
            </div>
            <div className="flex justify-between items-center pb-6 border-b border-gray-700 mb-6">
              <span className="text-gray-400">{t.totalIssued}</span>
              <span className="font-semibold text-lg">{totalSupply ? formatEther(totalSupply) : '0'}</span>
            </div>
            <button onClick={handleDeposit} className="w-full bg-blue-600/20 text-blue-400 border border-blue-600/50 hover:bg-blue-600 hover:text-white py-4 rounded-xl font-semibold transition-all duration-300">
              {t.simulateAdmin}
            </button>
          </div>

          <div className="bg-gray-800 p-8 rounded-3xl border border-gray-700 shadow-2xl flex flex-col justify-between">
            <div>
              <h2 className="text-xl text-gray-400 mb-6 font-medium">{t.myPortfolio}</h2>
              <div className="bg-gray-900/50 p-6 rounded-2xl mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">{t.holdings}</span>
                  <span className="text-2xl font-bold text-white">{balance ? formatEther(balance) : '0'} PRES</span>
                </div>
              </div>
              <div className="bg-gray-900/50 p-6 rounded-2xl mb-8 border border-emerald-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">{t.claimableYield}</span>
                  <span className="text-3xl font-extrabold text-emerald-400">{claimable ? formatEther(claimable) : '0.0'} ETH</span>
                </div>
              </div>
            </div>
            <button onClick={handleClaim} className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white py-4 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 hover:scale-[1.02]">
              {t.claimButton}
            </button>
          </div>
        </div>

        <div className="bg-gray-800 p-8 rounded-3xl border border-gray-700 shadow-2xl">
          <h2 className="text-xl text-gray-400 mb-6 font-medium flex items-center gap-2">
             {t.transferTitle}
          </h2>
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              placeholder={t.recipientAddress}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
            <input 
              type="number" 
              placeholder={t.transferAmount}
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="w-full md:w-48 bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button 
              onClick={handleTransfer}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 whitespace-nowrap shadow-lg"
            >
              {t.confirmTransfer}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}