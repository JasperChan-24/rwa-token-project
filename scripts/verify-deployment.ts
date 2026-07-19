import { readFile, writeFile } from "node:fs/promises";

import { verifyContract } from "@nomicfoundation/hardhat-verify/verify";
import hre from "hardhat";
import type { Address } from "viem";

const SEPOLIA_CHAIN_ID = 11_155_111;
const manifestPath = "deployments/sepolia/PropertyToken.json";

type DeploymentManifest = {
  chainId: number;
  address: Address;
  constructorArguments: {
    initialAdmin: Address;
    treasury: Address;
    ethUsdOracle: Address;
    oracleMaxAgeSeconds: string;
  };
  urls: {
    etherscan: string;
    sourcify: string;
  };
  verification: {
    etherscan: boolean;
    sourcify: boolean;
  };
  [key: string]: unknown;
};

if (!process.env.ETHERSCAN_API_KEY) {
  throw new Error("ETHERSCAN_API_KEY is required for Etherscan verification.");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as DeploymentManifest;
const connection = await hre.network.create();
const chainId = await (await connection.viem.getPublicClient()).getChainId();
if (connection.networkName !== "sepolia" || chainId !== SEPOLIA_CHAIN_ID) {
  throw new Error(`Refusing to verify on ${connection.networkName} (${chainId}).`);
}
if (manifest.chainId !== chainId) {
  throw new Error(`Manifest chain ${manifest.chainId} does not match RPC chain ${chainId}.`);
}

const args = manifest.constructorArguments;
const constructorArgs = [
  args.initialAdmin,
  args.treasury,
  args.ethUsdOracle,
  BigInt(args.oracleMaxAgeSeconds),
];

const verification = { ...manifest.verification };
for (const provider of ["etherscan", "sourcify"] as const) {
  if (verification[provider]) {
    console.log(`${provider}: already recorded as verified`);
    continue;
  }
  try {
    await verifyContract(
      { address: manifest.address, constructorArgs, provider },
      hre,
    );
    verification[provider] = true;
    console.log(`${provider}: verified`);
  } catch (error) {
    verification[provider] = false;
    console.error(`${provider}: verification failed`, error);
  }
}

await writeFile(
  manifestPath,
  `${JSON.stringify({ ...manifest, verification }, null, 2)}\n`,
  "utf8",
);

console.log(`Etherscan: ${manifest.urls.etherscan}`);
console.log(`Sourcify: ${manifest.urls.sourcify}`);
if (!verification.etherscan || !verification.sourcify) {
  process.exitCode = 2;
}
