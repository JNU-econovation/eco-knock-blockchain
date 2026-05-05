// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract HelloEcoKnock {
    string public message;
    address public owner;

    constructor(string memory initialMessage) {
        message = initialMessage;
        owner = msg.sender;
    }

    error NotOwner(address caller);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    function setMessage(string calldata newMessage) external onlyOwner { message = newMessage; }
}