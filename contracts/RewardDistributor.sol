// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RewardDistributor
 * @dev Holds the entire KRT Token and transfers rewards to user wallets
 */
contract RewardDistributor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant TOKEN_UNIT = 10 ** 18;
    uint256 public constant DAILY_REWARD_LIMIT = 3_000 * TOKEN_UNIT;

    IERC20 public immutable rewardToken; // ERC-20 Token used as the reward currency (=KeyringToken)
    address public operator;             // BE wallet address authorized to distribute rewards

    mapping(bytes32 batchId => bool processed) public processedBatches;
    mapping(uint256 rewardDay => uint256 amount) public distributedAmountByDay;

    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event RewardPaid(bytes32 indexed batchId, uint256 indexed rewardDay, address indexed recipient, uint256 amount);
    event RewardsDistributed(
        bytes32 indexed batchId,
        uint256 indexed rewardDay,
        uint256 totalAmount,
        uint256 recipientCount
    );

    error InvalidAddress();
    error InvalidBatchId();
    error InvalidRewardDay();
    error EmptyRewards();
    error RewardLengthMismatch();
    error InvalidRewardAmount();
    error UnauthorizedOperator(address caller);
    error InvalidRecipient(address recipient);
    error BatchAlreadyProcessed(bytes32 batchId);
    error DailyRewardLimitExceeded(uint256 rewardDay, uint256 attemptedAmount, uint256 limit);
    error InsufficientRewardBalance(uint256 available, uint256 required);

    /*
    * rewardToken_: KeyringToken Contract Address
    */
    constructor(IERC20 rewardToken_, address initialOperator) Ownable(msg.sender) {
        // reverts deployment if rewardToken_ or operator address is empty 
        if (address(rewardToken_) == address(0) || initialOperator == address(0))
            revert InvalidAddress();

        rewardToken = rewardToken_;
        operator = initialOperator;

        emit OperatorUpdated(address(0), initialOperator);
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert UnauthorizedOperator(msg.sender);
        _;
    }

    function setOperator(address newOperator) external onlyOwner { // changes BE wallet address
        if (newOperator == address(0)) revert InvalidAddress();


        address previousOperator = operator;
        operator = newOperator;

        emit OperatorUpdated(previousOperator, newOperator);
    }

    function rewardBalance() external view returns (uint256) {
        return rewardToken.balanceOf(address(this));
    }

    /*
    * batchId: Unique ID for this reward distribution batch
    * rewardDay: Date kery used to track the daily reward limit
    * recipients[]: Wallet addresses that will receive rewards
    * amounts[]: Reward amounts matched by index with recipients
    */
    function distributeRewards(
        bytes32 batchId,
        uint256 rewardDay,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOperator nonReentrant {
        // Reject an empty batchID to ensure every distribution is traceable
        if (batchId == bytes32(0)) revert InvalidBatchId();

        // Reject an empty rewardDay because daily limits are tracked by this key
        if (rewardDay == 0) revert InvalidRewardDay();

        // Prevent the same reward batch from being processed more than once
        if (processedBatches[batchId]) revert BatchAlreadyProcessed(batchId);

        if (recipients.length == 0) revert EmptyRewards();

        if (recipients.length != amounts.length) revert RewardLengthMismatch();

        // Validate recipients and amounts, then calculate the total reward amount
        uint256 totalAmount = _validateAndSumRewards(recipients, amounts);
        uint256 attemptedDailyAmount = distributedAmountByDay[rewardDay] + totalAmount;

        // Enforce the daily reward distribution limit(=3,000KRT)
        if (attemptedDailyAmount > DAILY_REWARD_LIMIT)
            revert DailyRewardLimitExceeded(rewardDay, attemptedDailyAmount, DAILY_REWARD_LIMIT);

        // Ensure the reward pool has enough tokens for this batch
        uint256 availableBalance = rewardToken.balanceOf(address(this)); // Check how many reward tokens this contract currently holds
        if (availableBalance < totalAmount)
            revert InsufficientRewardBalance(availableBalance, totalAmount);


        processedBatches[batchId] = true;
        distributedAmountByDay[rewardDay] = attemptedDailyAmount;

        // Transfer the matched reward amount to each recipient
        for (uint256 i = 0; i < recipients.length; i++) {
            rewardToken.safeTransfer(recipients[i], amounts[i]);
            emit RewardPaid(batchId, rewardDay, recipients[i], amounts[i]);
        }

        emit RewardsDistributed(batchId, rewardDay, totalAmount, recipients.length);
    }

    function _validateAndSumRewards(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) private pure returns (uint256 totalAmount) {
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0))
                revert InvalidRecipient(recipients[i]);

            if (amounts[i] == 0)
                revert InvalidRewardAmount();

            totalAmount += amounts[i];
        }
    }
}