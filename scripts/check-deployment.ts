import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createPublicClient,
  getAddress,
  http,
  parseUnits,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";

type DeploymentManifest = {
  chainId: number;
  address: Address;
  deployer: Address;
  deploymentTransactionHash: Hex;
  valuationTransactionHash: Hex;
  constructorArguments: {
    ethUsdOracle: Address;
    oracleMaxAgeSeconds: string;
  };
  verification: {
    etherscan: boolean;
    sourcify: boolean;
  };
  abi: Abi;
};

const rpcUrl = process.env.SEPOLIA_RPC_URL;
if (!rpcUrl) {
  throw new Error("SEPOLIA_RPC_URL is required.");
}

const manifest = JSON.parse(
  await readFile("deployments/sepolia/PropertyToken.json", "utf8"),
) as DeploymentManifest;
assert.equal(manifest.chainId, sepolia.id);

const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
const sourcifyLookupUrl = `https://sourcify.dev/server/v2/contract/${sepolia.id}/${manifest.address}`;
const [deploymentReceipt, valuationReceipt, bytecode, sourcifyResponse] = await Promise.all([
  client.getTransactionReceipt({ hash: manifest.deploymentTransactionHash }),
  client.getTransactionReceipt({ hash: manifest.valuationTransactionHash }),
  client.getCode({ address: manifest.address }),
  fetch(sourcifyLookupUrl),
]);

assert.equal(deploymentReceipt.status, "success");
assert.equal(valuationReceipt.status, "success");
assert.equal(getAddress(deploymentReceipt.contractAddress!), getAddress(manifest.address));
assert.ok(bytecode && bytecode !== "0x", "deployed runtime bytecode is missing");
assert.equal(sourcifyResponse.ok, true, "Sourcify contract lookup failed");
const sourcify = (await sourcifyResponse.json()) as {
  match: string;
  creationMatch: string;
  runtimeMatch: string;
  verifiedAt: string;
};
assert.equal(sourcify.match, "exact_match");
assert.equal(sourcify.creationMatch, "exact_match");
assert.equal(sourcify.runtimeMatch, "exact_match");

const read = <T>(functionName: string, args?: readonly unknown[]) =>
  client.readContract({
    address: manifest.address,
    abi: manifest.abi,
    functionName,
    args,
  }) as Promise<T>;

const [
  name,
  symbol,
  totalSupply,
  deployerBalance,
  totalYieldDeposited,
  totalYieldClaimed,
  contractEthBalance,
  defaultAdmin,
  oracle,
  maxAge,
  valuation,
  paused,
] =
  await Promise.all([
    read<string>("name"),
    read<string>("symbol"),
    read<bigint>("totalSupply"),
    read<bigint>("balanceOf", [manifest.deployer]),
    read<bigint>("totalYieldDeposited"),
    read<bigint>("totalYieldClaimed"),
    client.getBalance({ address: manifest.address }),
    read<Address>("defaultAdmin"),
    read<Address>("ethUsdOracle"),
    read<bigint>("oracleMaxAge"),
    read<bigint>("getRealWorldValuation"),
    read<boolean>("paused"),
  ]);

assert.equal(name, "Prime Real Estate Share");
assert.equal(symbol, "PRES");
assert.equal(totalSupply, parseUnits("10000", 18));
assert.equal(getAddress(defaultAdmin), getAddress(manifest.deployer));
assert.equal(getAddress(oracle), getAddress(manifest.constructorArguments.ethUsdOracle));
assert.equal(maxAge, BigInt(manifest.constructorArguments.oracleMaxAgeSeconds));
assert.equal(valuation, parseUnits("10000000", 18));
assert.equal(paused, false);

for (const roleName of [
  "COMPLIANCE_ROLE",
  "DIVIDEND_DISTRIBUTOR_ROLE",
  "VALUATION_ROLE",
  "ORACLE_MANAGER_ROLE",
  "PAUSER_ROLE",
]) {
  const role = await read<Hex>(roleName);
  assert.equal(await read<boolean>("hasRole", [role, manifest.deployer]), true);
}

console.log(
  JSON.stringify(
    {
      network: sepolia.name,
      address: manifest.address,
      deploymentBlock: deploymentReceipt.blockNumber.toString(),
      deploymentTransaction: manifest.deploymentTransactionHash,
      valuationTransaction: manifest.valuationTransactionHash,
      runtimeBytecodeBytes: (bytecode.length - 2) / 2,
      name,
      symbol,
      totalSupply: totalSupply.toString(),
      deployerBalance: deployerBalance.toString(),
      totalYieldDeposited: totalYieldDeposited.toString(),
      totalYieldClaimed: totalYieldClaimed.toString(),
      contractEthBalance: contractEthBalance.toString(),
      defaultAdmin,
      oracle,
      oracleMaxAgeSeconds: maxAge.toString(),
      valuationUsd18: valuation.toString(),
      paused,
      verification: manifest.verification,
      sourcify: { ...sourcify, url: sourcifyLookupUrl },
    },
    null,
    2,
  ),
);
