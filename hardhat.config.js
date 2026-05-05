import { defineConfig } from "hardhat/config";

process.loadEnvFile?.(".env");

const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;
const privateKey = process.env.PRIVATE_KEY;

export default defineConfig({
  solidity: {
    version: "0.8.28",
  },
  networks: {
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
  },
});
