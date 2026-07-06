import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

const TOKEN_UNIT = 10n ** 18n;
const INITIAL_SUPPLY = 20_000_000n * TOKEN_UNIT;
const MAX_SUPPLY = 50_000_000n * TOKEN_UNIT;

describe("KeyringToken", async function () {
  const { viem } = await network.create();
  const [owner, otherAccount, receiver] = await viem.getWalletClients();

  async function deployKeyringToken() {
    return await viem.deployContract("KeyringToken");
  }

  it("sets the token metadata", async function () {
    const token = await deployKeyringToken();

    assert.equal(await token.read.name(), "Keyring Token");
    assert.equal(await token.read.symbol(), "KRT");
  });

  it("mints the initial supply to the deployer", async function () {
    const token = await deployKeyringToken();

    assert.equal(await token.read.totalSupply(), INITIAL_SUPPLY);
    assert.equal(await token.read.balanceOf([owner.account.address]), INITIAL_SUPPLY);
    assert.equal(await token.read.cap(), MAX_SUPPLY);
    assert.equal(
      (await token.read.owner()).toLowerCase(),
      owner.account.address.toLowerCase(),
    );
  });

  it("allows the owner to mint additional tokens up to the max supply cap", async function () {
    const token = await deployKeyringToken();
    const mintAmount = 10_000n * TOKEN_UNIT;

    await token.write.mint([receiver.account.address, mintAmount]);

    assert.equal(await token.read.balanceOf([receiver.account.address]), mintAmount);
    assert.equal(await token.read.totalSupply(), INITIAL_SUPPLY + mintAmount);
  });

  it("rejects minting by non-owner accounts", async function () {
    const token = await deployKeyringToken();
    const tokenAsOtherAccount = await viem.getContractAt(
      "KeyringToken",
      token.address,
      {
        client: {
          wallet: otherAccount,
        },
      },
    );

    await viem.assertions.revertWithCustomErrorWithArgs(
      tokenAsOtherAccount.write.mint([receiver.account.address, TOKEN_UNIT]),
      token,
      "OwnableUnauthorizedAccount",
      [otherAccount.account.address],
    );
  });

  it("rejects minting above the max supply cap", async function () {
    const token = await deployKeyringToken();
    const mintAmount = 30_000_001n * TOKEN_UNIT;

    await viem.assertions.revertWithCustomErrorWithArgs(
      token.write.mint([receiver.account.address, mintAmount]),
      token,
      "ERC20ExceededCap",
      [INITIAL_SUPPLY + mintAmount, MAX_SUPPLY],
    );
  });
});
