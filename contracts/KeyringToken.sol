// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title KeyringToken
 * @dev ERC-20 token used for ECO-KNOCK rewards
 */
contract KeyringToken is ERC20Capped, Ownable {
    uint256 public constant TOKEN_UNIT = 10 ** 18;
    uint256 public constant INITIAL_SUPPLY = 20_000_000 * TOKEN_UNIT;
    uint256 public constant MAX_SUPPLY = 50_000_000 * TOKEN_UNIT;

    constructor()
        ERC20("Keyring Token", "KRT") // Sets tokenName, Symbol
        ERC20Capped(MAX_SUPPLY)       // Sets Max. Token Supply
        Ownable(msg.sender)           // Sets the deployer(=msg.sender) as the contract owner
    {
        _mint(msg.sender, INITIAL_SUPPLY); // Mints the initial supply to the deployer
    }

    // Allows the current owner to mint additional tokens up to the max. supply cap
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}