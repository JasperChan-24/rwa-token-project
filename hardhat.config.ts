import "dotenv/config";

import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import hardhatViem from "@nomicfoundation/hardhat-viem";
import hardhatViemAssertions from "@nomicfoundation/hardhat-viem-assertions";
import { configVariable, defineConfig } from "hardhat/config";

const sepoliaPrivateKey = process.env.SEPOLIA_PRIVATE_KEY;

export default defineConfig({
  plugins: [
    hardhatViem,
    hardhatViemAssertions,
    hardhatNetworkHelpers,
    hardhatNodeTestRunner,
    hardhatVerify,
  ],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11_155_111,
      url: configVariable("SEPOLIA_RPC_URL"),
      // Source verification only needs an RPC connection. Keep the signer optional
      // so verification never requires exposing the deployment private key.
      accounts: sepoliaPrivateKey ? [sepoliaPrivateKey] : [],
    },
  },
  verify: {
    blockscout: {
      enabled: false,
    },
    etherscan: {
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
    sourcify: {
      enabled: true,
    },
  },
});
