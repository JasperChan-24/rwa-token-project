import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { verifyContract } from "@nomicfoundation/hardhat-verify/verify";
import hre from "hardhat";
import { formatEther, formatUnits, keccak256, parseUnits, stringToHex } from "viem";

const SEPOLIA_CHAIN_ID = 11_155_111;
const SEPOLIA_ETH_USD_FEED = "0x694AA1769357215DE4FAC081bf1f309aDC325306" as const;
const ORACLE_MAX_AGE = 3n * 60n * 60n;
const INITIAL_VALUATION_USD = parseUnits("10000000", 18);
const DEMO_REPORT_HASH = keccak256(
  stringToHex("SEPOLIA_DEMO_ONLY_NO_LEGAL_APPRAISAL_OR_OWNERSHIP_CLAIM"),
);

async function verify(
  provider: "etherscan" | "sourcify",
  address: `0x${string}`,
  constructorArgs: readonly [
    `0x${string}`,
    `0x${string}`,
    `0x${string}`,
    bigint,
  ],
): Promise<boolean> {
  try {
    await verifyContract({ address, constructorArgs: [...constructorArgs], provider }, hre);
    console.log(`Verified with ${provider}.`);
    return true;
  } catch (error) {
    console.error(`${provider} verification failed:`, error);
    return false;
  }
}

async function main(): Promise<void> {
  if (!process.env.SEPOLIA_PRIVATE_KEY) {
    throw new Error("SEPOLIA_PRIVATE_KEY is required for deployment.");
  }

  const connection = await hre.network.create();
  const { networkName, viem } = connection;
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();
  const chainId = await publicClient.getChainId();

  if (networkName !== "sepolia" || chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Refusing to deploy: expected Sepolia (${SEPOLIA_CHAIN_ID}), got ${networkName} (${chainId}).`,
    );
  }

  const balance = await publicClient.getBalance({ address: deployer.account.address });
  if (balance === 0n) {
    throw new Error(`Deployer ${deployer.account.address} has no Sepolia ETH.`);
  }

  const constructorArgs = [
    deployer.account.address,
    deployer.account.address,
    SEPOLIA_ETH_USD_FEED,
    ORACLE_MAX_AGE,
  ] as const;

  console.log(`Network: ${networkName} (${chainId})`);
  console.log(`Deployer / treasury / demo roles: ${deployer.account.address}`);
  console.log(`Deployer balance: ${formatEther(balance)} ETH`);

  const { contract, deploymentTransaction } = await viem.sendDeploymentTransaction(
    "PropertyToken",
    [...constructorArgs],
  );
  console.log(`Deployment transaction: ${deploymentTransaction.hash}`);

  const deploymentReceipt = await publicClient.waitForTransactionReceipt({
    hash: deploymentTransaction.hash,
    confirmations: 3,
  });
  if (deploymentReceipt.status !== "success") {
    throw new Error(`Deployment reverted: ${deploymentTransaction.hash}`);
  }

  const deploymentBlock = await publicClient.getBlock({
    blockNumber: deploymentReceipt.blockNumber,
  });
  const valuationTransactionHash = await contract.write.updateRealWorldValuation([
    INITIAL_VALUATION_USD,
    deploymentBlock.timestamp,
    DEMO_REPORT_HASH,
  ]);
  const valuationReceipt = await publicClient.waitForTransactionReceipt({
    hash: valuationTransactionHash,
    confirmations: 2,
  });
  if (valuationReceipt.status !== "success") {
    throw new Error(`Valuation initialization reverted: ${valuationTransactionHash}`);
  }

  const artifact = await hre.artifacts.readArtifact("PropertyToken");
  const etherscanUrl = `https://sepolia.etherscan.io/address/${contract.address}#code`;
  const transactionUrl = `https://sepolia.etherscan.io/tx/${deploymentTransaction.hash}`;
  const sourcifyUrl = `https://repo.sourcify.dev/${chainId}/${contract.address}`;
  const sourcifyApiUrl = `https://sourcify.dev/server/v2/contract/${chainId}/${contract.address}`;

  const manifestPath = resolve("deployments/sepolia/PropertyToken.json");
  await mkdir(resolve("deployments/sepolia"), { recursive: true });

  const baseManifest = {
    schemaVersion: 1,
    network: networkName,
    chainId,
    address: contract.address,
    deployer: deployer.account.address,
    treasury: deployer.account.address,
    deploymentTransactionHash: deploymentTransaction.hash,
    deploymentBlockNumber: deploymentReceipt.blockNumber.toString(),
    valuationTransactionHash,
    constructorArguments: {
      initialAdmin: deployer.account.address,
      treasury: deployer.account.address,
      ethUsdOracle: SEPOLIA_ETH_USD_FEED,
      oracleMaxAgeSeconds: ORACLE_MAX_AGE.toString(),
    },
    initialization: {
      valuationUsd18: INITIAL_VALUATION_USD.toString(),
      valuationUsd: formatUnits(INITIAL_VALUATION_USD, 18),
      valuationEffectiveAt: deploymentBlock.timestamp.toString(),
      reportHash: DEMO_REPORT_HASH,
      disclaimer: "Sepolia demo data; not a legal appraisal or ownership claim.",
    },
    compiler: {
      version: "0.8.28",
      buildProfile: "production",
      optimizer: { enabled: true, runs: 200 },
    },
    urls: {
      etherscan: etherscanUrl,
      deploymentTransaction: transactionUrl,
      sourcify: sourcifyUrl,
      sourcifyApi: sourcifyApiUrl,
    },
    verification: { etherscan: false, sourcify: false },
    abi: artifact.abi,
  };

  await writeFile(manifestPath, `${JSON.stringify(baseManifest, null, 2)}\n`, "utf8");

  const etherscanVerified = process.env.ETHERSCAN_API_KEY
    ? await verify("etherscan", contract.address, constructorArgs)
    : false;
  if (!process.env.ETHERSCAN_API_KEY) {
    console.warn("ETHERSCAN_API_KEY is absent; Etherscan verification was skipped.");
  }
  const sourcifyVerified = await verify("sourcify", contract.address, constructorArgs);

  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        ...baseManifest,
        verification: { etherscan: etherscanVerified, sourcify: sourcifyVerified },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`PropertyToken: ${contract.address}`);
  console.log(`Etherscan: ${etherscanUrl}`);
  console.log(`Deployment transaction: ${transactionUrl}`);
  console.log(`Sourcify: ${sourcifyUrl}`);
  console.log(`Deployment manifest: ${manifestPath}`);

  if (!etherscanVerified || !sourcifyVerified) {
    process.exitCode = 2;
  }
}

await main();
