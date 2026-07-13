import { network } from "hardhat";
import {
  formatUnits,
  isAddress,
  keccak256,
  parseUnits,
  stringToHex,
} from "viem";

const DISTRIBUTOR_ADDRESS_ENV_BY_NETWORK = {
  sepolia: "SEPOLIA_REWARD_DISTRIBUTOR_ADDRESS",
  baseSepolia: "BASE_SEPOLIA_REWARD_DISTRIBUTOR_ADDRESS",
};

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseCsv(name) {
  return getRequiredEnv(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseRewardDay() {
  const value = getRequiredEnv("REWARD_DAY");

  if (!/^\d{8}$/.test(value)) {
    throw new Error("REWARD_DAY must use the YYYYMMDD format.");
  }

  return BigInt(value);
}

function parseRecipients() {
  const recipients = parseCsv("REWARD_RECIPIENTS");
  const invalidRecipient = recipients.find((recipient) => !isAddress(recipient));

  if (invalidRecipient) {
    throw new Error(`Invalid recipient address: ${invalidRecipient}`);
  }

  return recipients;
}

function parseAmounts() {
  return parseCsv("REWARD_AMOUNTS").map((value) => {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)) {
      throw new Error(`Invalid KRT amount: ${value}`);
    }

    const amount = parseUnits(value, 18);

    if (amount === 0n) {
      throw new Error("Reward amounts must be greater than zero.");
    }

    return amount;
  });
}

function createBatchId(value) {
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) {
    return value;
  }

  return keccak256(stringToHex(value));
}

function isSameAddress(first, second) {
  return first.toLowerCase() === second.toLowerCase();
}

async function main() {
  const { networkName, viem } = await network.create();
  const distributorAddressEnv =
    DISTRIBUTOR_ADDRESS_ENV_BY_NETWORK[networkName];

  if (!distributorAddressEnv) {
    throw new Error(
      `Reward distribution is not configured for network: ${networkName}`,
    );
  }

  const distributorAddress = getRequiredEnv(distributorAddressEnv);

  if (!isAddress(distributorAddress)) {
    throw new Error(`Invalid RewardDistributor address: ${distributorAddress}`);
  }

  const batchLabel = getRequiredEnv("REWARD_BATCH_ID");
  const batchId = createBatchId(batchLabel);
  const rewardDay = parseRewardDay();
  const recipients = parseRecipients();
  const amounts = parseAmounts();

  if (recipients.length !== amounts.length) {
    throw new Error(
      "REWARD_RECIPIENTS and REWARD_AMOUNTS must contain the same number of values.",
    );
  }

  const publicClient = await viem.getPublicClient();
  const [operatorWallet] = await viem.getWalletClients();

  if (!operatorWallet) {
    throw new Error("No operator wallet is configured for this network.");
  }

  const rewardDistributor = await viem.getContractAt(
    "RewardDistributor",
    distributorAddress,
    {
      client: {
        public: publicClient,
        wallet: operatorWallet,
      },
    },
  );

  const configuredOperator = await rewardDistributor.read.operator();
  const signerAddress = operatorWallet.account.address;

  if (!isSameAddress(configuredOperator, signerAddress)) {
    throw new Error(
      `The configured wallet is not the RewardDistributor operator. Expected ${configuredOperator}, received ${signerAddress}.`,
    );
  }

  const totalAmount = amounts.reduce((total, amount) => total + amount, 0n);
  const args = [batchId, rewardDay, recipients, amounts];

  console.log(`Network: ${networkName}`);
  console.log(`RewardDistributor: ${distributorAddress}`);
  console.log(`Operator: ${signerAddress}`);
  console.log(`Batch: ${batchLabel} (${batchId})`);
  console.log(`Reward day: ${rewardDay}`);
  console.log(`Recipients: ${recipients.length}`);
  console.log(`Total reward: ${formatUnits(totalAmount, 18)} KRT`);

  await rewardDistributor.simulate.distributeRewards(args, {
    account: operatorWallet.account,
  });

  const transactionHash =
    await rewardDistributor.write.distributeRewards(args);

  console.log(`Transaction submitted: ${transactionHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
  });

  if (receipt.status !== "success") {
    throw new Error(`Reward distribution reverted: ${transactionHash}`);
  }

  console.log(`Reward distribution confirmed in block ${receipt.blockNumber}.`);
}

main().catch((error) => {
  console.error(error.shortMessage ?? error.message ?? error);
  process.exitCode = 1;
});
