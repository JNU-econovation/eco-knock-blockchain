import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("RewardDistributorModule", (m) => {
  const operator = m.getParameter("operator", m.getAccount(0));

  const keyringToken = m.contract("KeyringToken");
  const rewardDistributor = m.contract("RewardDistributor", [
    keyringToken,
    operator,
  ]);

  const initialSupply = m.staticCall(keyringToken, "INITIAL_SUPPLY");

  m.call(keyringToken, "transfer", [rewardDistributor, initialSupply], {
    id: "FundRewardDistributor",
  });

  return { keyringToken, rewardDistributor };
});
