import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

const TOKEN_UNIT = 10n ** 18n;
const INITIAL_SUPPLY = 20_000_000n * TOKEN_UNIT;
const DAILY_REWARD_LIMIT = 3_000n * TOKEN_UNIT;
const REWARD_DAY = 20260706n;

function batchId(value) {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function assertSameAddress(actual, expected) {
  assert.equal(actual.toLowerCase(), expected.toLowerCase());
}

describe("RewardDistributor", async function () {
  const { viem } = await network.create();
  const [owner, operator, newOperator, recipient, anotherRecipient] =
    await viem.getWalletClients();

  async function deployRewardDistributor({ fundRewardPool = true } = {}) {
    const token = await viem.deployContract("KeyringToken");
    const distributor = await viem.deployContract("RewardDistributor", [
      token.address,
      operator.account.address,
    ]);

    if (fundRewardPool) {
      await token.write.transfer([distributor.address, INITIAL_SUPPLY]);
    }

    const distributorAsOperator = await viem.getContractAt(
      "RewardDistributor",
      distributor.address,
      {
        client: {
          wallet: operator,
        },
      },
    );

    return { token, distributor, distributorAsOperator };
  }

  it("stores the reward token and operator", async function () {
    const { token, distributor } = await deployRewardDistributor();

    assertSameAddress(await distributor.read.rewardToken(), token.address);
    assertSameAddress(await distributor.read.operator(), operator.account.address);
    assertSameAddress(await distributor.read.owner(), owner.account.address);
    assert.equal(await distributor.read.DAILY_REWARD_LIMIT(), DAILY_REWARD_LIMIT);
    assert.equal(await distributor.read.rewardBalance(), INITIAL_SUPPLY);
    assert.equal(await token.read.balanceOf([distributor.address]), INITIAL_SUPPLY);
  });

  it("allows the owner to update the operator", async function () {
    const { distributor } = await deployRewardDistributor();

    await distributor.write.setOperator([newOperator.account.address]);

    assertSameAddress(await distributor.read.operator(), newOperator.account.address);
  });

  it("rejects operator updates from non-owner accounts", async function () {
    const { distributor } = await deployRewardDistributor();
    const distributorAsOperator = await viem.getContractAt(
      "RewardDistributor",
      distributor.address,
      {
        client: {
          wallet: operator,
        },
      },
    );

    await viem.assertions.revertWithCustomErrorWithArgs(
      distributorAsOperator.write.setOperator([newOperator.account.address]),
      distributor,
      "OwnableUnauthorizedAccount",
      [operator.account.address],
    );
  });

  it("distributes rewards from the reward pool", async function () {
    const { token, distributor, distributorAsOperator } =
      await deployRewardDistributor();
    const firstReward = 5n * TOKEN_UNIT;
    const secondReward = 1n * TOKEN_UNIT;
    const totalReward = firstReward + secondReward;
    const currentBatchId = batchId(1);

    await distributorAsOperator.write.distributeRewards([
      currentBatchId,
      REWARD_DAY,
      [recipient.account.address, anotherRecipient.account.address],
      [firstReward, secondReward],
    ]);

    assert.equal(await token.read.balanceOf([recipient.account.address]), firstReward);
    assert.equal(
      await token.read.balanceOf([anotherRecipient.account.address]),
      secondReward,
    );
    assert.equal(
      await token.read.balanceOf([distributor.address]),
      INITIAL_SUPPLY - totalReward,
    );
    assert.equal(await distributor.read.processedBatches([currentBatchId]), true);
    assert.equal(
      await distributor.read.distributedAmountByDay([REWARD_DAY]),
      totalReward,
    );
  });

  it("rejects reward distribution from non-operator accounts", async function () {
    const { distributor } = await deployRewardDistributor();
    const rewardAmount = TOKEN_UNIT;

    await viem.assertions.revertWithCustomErrorWithArgs(
      distributor.write.distributeRewards([
        batchId(2),
        REWARD_DAY,
        [recipient.account.address],
        [rewardAmount],
      ]),
      distributor,
      "UnauthorizedOperator",
      [owner.account.address],
    );
  });

  it("rejects duplicate reward batches", async function () {
    const { distributor, distributorAsOperator } = await deployRewardDistributor();
    const currentBatchId = batchId(3);
    const rewardAmount = TOKEN_UNIT;

    await distributorAsOperator.write.distributeRewards([
      currentBatchId,
      REWARD_DAY,
      [recipient.account.address],
      [rewardAmount],
    ]);

    await viem.assertions.revertWithCustomErrorWithArgs(
      distributorAsOperator.write.distributeRewards([
        currentBatchId,
        REWARD_DAY,
        [anotherRecipient.account.address],
        [rewardAmount],
      ]),
      distributor,
      "BatchAlreadyProcessed",
      [currentBatchId],
    );
  });

  it("rejects rewards above the daily limit", async function () {
    const { distributor, distributorAsOperator } = await deployRewardDistributor();
    const rewardAmount = DAILY_REWARD_LIMIT + TOKEN_UNIT;

    await viem.assertions.revertWithCustomErrorWithArgs(
      distributorAsOperator.write.distributeRewards([
        batchId(4),
        REWARD_DAY,
        [recipient.account.address],
        [rewardAmount],
      ]),
      distributor,
      "DailyRewardLimitExceeded",
      [REWARD_DAY, rewardAmount, DAILY_REWARD_LIMIT],
    );
  });

  it("rejects rewards when the reward pool has insufficient balance", async function () {
    const { distributor, distributorAsOperator } = await deployRewardDistributor({
      fundRewardPool: false,
    });
    const rewardAmount = TOKEN_UNIT;

    await viem.assertions.revertWithCustomErrorWithArgs(
      distributorAsOperator.write.distributeRewards([
        batchId(5),
        REWARD_DAY,
        [recipient.account.address],
        [rewardAmount],
      ]),
      distributor,
      "InsufficientRewardBalance",
      [0n, rewardAmount],
    );
  });

  it("rejects malformed reward requests", async function () {
    const { distributor, distributorAsOperator } = await deployRewardDistributor();

    await viem.assertions.revertWithCustomError(
      distributorAsOperator.write.distributeRewards([
        batchId(6),
        REWARD_DAY,
        [recipient.account.address],
        [],
      ]),
      distributor,
      "RewardLengthMismatch",
    );

    await viem.assertions.revertWithCustomError(
      distributorAsOperator.write.distributeRewards([
        batchId(7),
        REWARD_DAY,
        [recipient.account.address],
        [0n],
      ]),
      distributor,
      "InvalidRewardAmount",
    );
  });
});
