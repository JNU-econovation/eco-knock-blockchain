import { defineConfig } from "hardhat/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";

process.loadEnvFile?.(".env");

const baseSepoliaRpcUrl = process.env.BASE_SEPOLIA_RPC_URL;
const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;
const privateKey = process.env.PRIVATE_KEY;

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    version: "0.8.28",
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    ...(sepoliaRpcUrl
      ? {
          sepolia: {
            type: "http",
            chainType: "l1",
            url: sepoliaRpcUrl,
            accounts: privateKey ? [privateKey] : "remote",
          },
        }
      : {}),
    ...(baseSepoliaRpcUrl
      ? {
          baseSepolia: {
            type: "http",
            chainType: "op",
            url: baseSepoliaRpcUrl,
            accounts: privateKey ? [privateKey] : "remote",
          },
        }
      : {}),
  },
});
