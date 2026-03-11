// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Authority.sol";

/**
 * @title CircuitRegistry
 * @notice Stores ZoKrates verification keys on-chain for each ZKP circuit.
 *
 * WHY STORE KEYS ON-CHAIN?
 * ─────────────────────────────────────────────────────────────────────
 * Third parties (e.g. recruiters) need the verification key to validate
 * a ZoKrates proof locally. By publishing keys here, they can:
 *   1. Fetch the verification key from the blockchain (public, trustless).
 *   2. Run `zokrates verify` or equivalent JS locally — zero gas cost.
 *   3. Be certain the key has not been tampered with.
 *
 * Only the contract owner (the ministry of magic) can add or update keys.
 *
 * Supported circuits (matching PROOF_GENERATION/zokrates/ subdirs):
 *   "grade"  — proves finalGrade >= threshold
 *   "gpa"    — proves gpaX100 >= threshold
 *   "eqf"    — proves EQFlevel >= threshold
 *   "isced"  — proves iscedDetailed == code
 */
contract CircuitRegistry is Ownable {
    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    /// @notice Verification key bytes for each circuit, keyed by circuit name.
    ///         The bytes are the raw content of the ZoKrates `verification.key` file.
    mapping(string => bytes) private _verificationKeys;

    /// @notice Ordered list of circuit names ever registered.
    string[] private _circuitNames;

    /// @notice Track which names have been added to avoid duplicates in the list.
    mapping(string => bool) private _circuitExists;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    /// @notice Emitted when a verification key is added or updated.
    event VerificationKeySet(
        string indexed circuitName,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    //  Owner-only write functions
    // ─────────────────────────────────────────────

    /**
     * @notice Publish or update the verification key for a circuit.
     *
     * HOW TO GET THE KEY (from the PROOF_GENERATION directory):
     *   The file is at:  PROOF_GENERATION/zokrates/<circuitName>/verification.key
     *   Read its raw bytes and pass them as `_key`.
     *
     * @param _circuitName  Name of the circuit (e.g. "grade", "gpa", "eqf", "isced").
     * @param _key          Raw bytes of the ZoKrates verification key file.
     *
     * Requirements:
     * - Caller must be the contract owner.
     * - `_circuitName` must not be empty.
     * - `_key` must not be empty.
     */
    function setVerificationKey(
        string calldata _circuitName,
        bytes calldata _key
    ) external onlyOwner {
        require(bytes(_circuitName).length > 0, "Circuit: name is empty");
        require(_key.length > 0, "Circuit: key is empty");

        if (!_circuitExists[_circuitName]) {
            _circuitNames.push(_circuitName);
            _circuitExists[_circuitName] = true;
        }

        _verificationKeys[_circuitName] = _key;

        emit VerificationKeySet(_circuitName, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  View functions
    // ─────────────────────────────────────────────

    /**
     * @notice Retrieve the verification key for a given circuit.
     * @param _circuitName  Name of the circuit.
     * @return Raw bytes of the verification key. Empty if not set.
     */
    function getVerificationKey(
        string calldata _circuitName
    ) external view returns (bytes memory) {
        return _verificationKeys[_circuitName];
    }

    /**
     * @notice Check whether a verification key has been published for a circuit.
     * @param _circuitName  Name of the circuit.
     * @return True if a key exists for this circuit name.
     */
    function hasVerificationKey(
        string calldata _circuitName
    ) external view returns (bool) {
        return _verificationKeys[_circuitName].length > 0;
    }

    /**
     * @notice Return the list of all circuit names that have been registered.
     * @return Array of circuit name strings.
     */
    function getAllCircuitNames() external view returns (string[] memory) {
        return _circuitNames;
    }

    /**
     * @notice Total number of circuits registered.
     */
    function totalCircuits() external view returns (uint256) {
        return _circuitNames.length;
    }
}
