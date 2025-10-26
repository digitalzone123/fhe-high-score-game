// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEHighScoreGame
 * @notice Contract for managing players' score history using Fully Homomorphic Encryption (FHE).
 *         Each player can submit encrypted scores, and all scores are stored privately.
 *         The highest score is not stored; only the score history is maintained.
 *
 * @dev - Each submitted score is allowed to be decrypted by the submitting player.
 *      - Score data is fully encrypted; plaintext is not revealed on-chain.
 */
contract FHEHighScoreGame is SepoliaConfig {
    /// @dev Mapping storing score history for each player
    mapping(address => euint32[]) private _scoreHistory;

    /**
     * @notice Submit a new (encrypted) score for a player.
     * @param scoreEncrypted The score submitted as an `externalEuint32` (encrypted).
     * @param proof Zero-knowledge proof accompanying the encrypted score for validation.
     *
     * @dev - Converts value from `externalEuint32` → internal `euint32`.
     *      - Saves it in the submitting player's history.
     *      - Allows the submitting player to decrypt this score.
     */
    function submitScore(externalEuint32 scoreEncrypted, bytes calldata proof) external {
        // 1️⃣ Convert from external → internal FHE
        euint32 score = FHE.fromExternal(scoreEncrypted, proof);

        // 2️⃣ Allow the contract to operate on the ciphertext internally
        FHE.allowThis(score);

        // 3️⃣ Save the score in the player's history
        _scoreHistory[msg.sender].push(score);

        // 4️⃣ Allow the submitting player to decrypt the newly submitted score
        FHE.allow(score, msg.sender);
    }

    /**
     * @notice Retrieve the full score history of a player.
     * @param user The player's address.
     * @return An array of submitted scores as `euint32`.
     */
    function getScoreHistory(address user) external view returns (euint32[] memory) {
        return _scoreHistory[user];
    }

    /**
     * @notice Get the number of score submissions of a player.
     * @param user The player's address.
     * @return The total number of submitted scores.
     */
    function getSubmitCount(address user) external view returns (uint256) {
        return _scoreHistory[user].length;
    }
}
