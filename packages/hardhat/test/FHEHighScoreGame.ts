import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FHEHighScoreGame, FHEHighScoreGame__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FHEHighScoreGame")) as FHEHighScoreGame__factory;
  const gameContract = (await factory.deploy()) as FHEHighScoreGame;
  const gameAddress = await gameContract.getAddress();

  return { gameContract, gameAddress };
}

describe("FHEHighScoreGame", function () {
  let signers: Signers;
  let gameContract: FHEHighScoreGame;
  let gameAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs only in local FHEVM mock mode");
      this.skip();
    }

    ({ gameContract, gameAddress } = await deployFixture());
  });

  it("should start with empty score history for new users", async function () {
    const history = await gameContract.getScoreHistory(signers.alice.address);
    expect(history.length).to.eq(0);
  });

  it("should allow submitting a score and store it in history", async function () {
    const encryptedScore = await fhevm.createEncryptedInput(gameAddress, signers.alice.address).add32(100).encrypt();

    const tx = await gameContract
      .connect(signers.alice)
      .submitScore(encryptedScore.handles[0], encryptedScore.inputProof);
    await tx.wait();

    const history = await gameContract.getScoreHistory(signers.alice.address);
    expect(history.length).to.eq(1);

    const clearScore = await fhevm.userDecryptEuint(FhevmType.euint32, history[0], gameAddress, signers.alice);
    expect(clearScore).to.eq(100);
  });

  it("should maintain history order correctly", async function () {
    const scores = [10, 20, 30];
    for (const s of scores) {
      const encrypted = await fhevm.createEncryptedInput(gameAddress, signers.alice.address).add32(s).encrypt();
      const tx = await gameContract.connect(signers.alice).submitScore(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();
      await ethers.provider.send("evm_mine", []);
    }

    const history = await gameContract.getScoreHistory(signers.alice.address);
    expect(history.length).to.eq(scores.length);

    for (let i = 0; i < scores.length; i++) {
      const clear = await fhevm.userDecryptEuint(FhevmType.euint32, history[i], gameAddress, signers.alice);
      expect(clear).to.eq(scores[i]);
    }
  });

  it("should correctly return submit count", async function () {
    let count = await gameContract.getSubmitCount(signers.alice.address);
    expect(count).to.eq(0);

    for (const s of [42, 99]) {
      const encrypted = await fhevm.createEncryptedInput(gameAddress, signers.alice.address).add32(s).encrypt();
      const tx = await gameContract.connect(signers.alice).submitScore(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();
    }

    count = await gameContract.getSubmitCount(signers.alice.address);
    expect(count).to.eq(2);
  });

  it("should handle multiple users independently", async function () {
    const aliceEnc = await fhevm.createEncryptedInput(gameAddress, signers.alice.address).add32(300).encrypt();
    await gameContract.connect(signers.alice).submitScore(aliceEnc.handles[0], aliceEnc.inputProof);

    const bobEnc = await fhevm.createEncryptedInput(gameAddress, signers.bob.address).add32(150).encrypt();
    await gameContract.connect(signers.bob).submitScore(bobEnc.handles[0], bobEnc.inputProof);

    const aliceHistory = await gameContract.getScoreHistory(signers.alice.address);
    const bobHistory = await gameContract.getScoreHistory(signers.bob.address);

    expect(aliceHistory.length).to.eq(1);
    expect(bobHistory.length).to.eq(1);

    const aliceScore = await fhevm.userDecryptEuint(FhevmType.euint32, aliceHistory[0], gameAddress, signers.alice);
    const bobScore = await fhevm.userDecryptEuint(FhevmType.euint32, bobHistory[0], gameAddress, signers.bob);

    expect(aliceScore).to.eq(300);
    expect(bobScore).to.eq(150);
  });

  it("should handle duplicate scores correctly", async function () {
    const scores = [50, 50, 50];
    for (const s of scores) {
      const encrypted = await fhevm.createEncryptedInput(gameAddress, signers.alice.address).add32(s).encrypt();
      const tx = await gameContract.connect(signers.alice).submitScore(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();
    }

    const history = await gameContract.getScoreHistory(signers.alice.address);
    expect(history.length).to.eq(scores.length);

    for (let i = 0; i < scores.length; i++) {
      const clear = await fhevm.userDecryptEuint(FhevmType.euint32, history[i], gameAddress, signers.alice);
      expect(clear).to.eq(scores[i]);
    }
  });

  it("should correctly handle very large score values", async function () {
    const largeScore = 2 ** 32 - 1; // Max euint32
    const encrypted = await fhevm.createEncryptedInput(gameAddress, signers.alice.address).add32(largeScore).encrypt();
    const tx = await gameContract.connect(signers.alice).submitScore(encrypted.handles[0], encrypted.inputProof);
    await tx.wait();

    const history = await gameContract.getScoreHistory(signers.alice.address);
    const clearScore = await fhevm.userDecryptEuint(FhevmType.euint32, history[0], gameAddress, signers.alice);
    expect(clearScore).to.eq(largeScore);
  });

  it("should allow multiple submissions and maintain correct history length", async function () {
    const submissions = [5, 15, 25, 35, 45];
    for (const s of submissions) {
      const encrypted = await fhevm.createEncryptedInput(gameAddress, signers.alice.address).add32(s).encrypt();
      const tx = await gameContract.connect(signers.alice).submitScore(encrypted.handles[0], encrypted.inputProof);
      await tx.wait();
    }

    const history = await gameContract.getScoreHistory(signers.alice.address);
    expect(history.length).to.eq(submissions.length);

    // Decrypt last and first to check order
    const firstScore = await fhevm.userDecryptEuint(FhevmType.euint32, history[0], gameAddress, signers.alice);
    const lastScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      history[history.length - 1],
      gameAddress,
      signers.alice,
    );
    expect(firstScore).to.eq(submissions[0]);
    expect(lastScore).to.eq(submissions[submissions.length - 1]);
  });
});
