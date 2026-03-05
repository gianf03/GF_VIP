// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IZKPVerifier
 * @notice Interface that your colleague's ZKP verifier contract must implement.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  HOW ZKP INTEGRATION WORKS (high-level)                         │
 * │                                                                 │
 * │  1. Your colleague builds a ZKP circuit (e.g. in Circom).       │
 * │     The circuit takes as *private* inputs: the full credential  │
 * │     data (student, grade, university, …).                       │
 * │     It takes as *public* inputs: the commitment hash that is    │
 * │     already stored on-chain in CredentialIssuer.                │
 * │                                                                 │
 * │  2. The circuit proves: "I know data D such that                │
 * │     keccak256(D) == commitment  AND  D.grade >= 100"            │
 * │     — without revealing D itself.                               │
 * │                                                                 │
 * │  3. A ZKP proof (a_,b_,c_ in Groth16) is generated off-chain   │
 * │     and submitted to this verifier.                             │
 * │                                                                 │
 * │  4. CredentialVerifier.verifyProof() calls                      │
 * │     IZKPVerifier.verify() to perform the on-chain math check.  │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Your colleague's contract should:
 *   1. Implement this interface.
 *   2. Be deployed independently.
 *   3. Its address is then set on CredentialVerifier via setVerifier().
 */
interface IZKPVerifier {
    /**
     * @notice Verify a ZKP proof.
     *
     * @param commitment   The on-chain commitment (keccak256 hash) that was stored
     *                     when the credential was issued. This is the single public
     *                     input that links the proof to the on-chain credential.
     *
     * @param proof        Encoded proof bytes. The exact encoding depends on the
     *                     proof system your colleague uses:
     *                       - Groth16:  abi.encode(uint[2] a, uint[2][2] b, uint[2] c)
     *                       - PLONK:    abi.encode(bytes proof)
     *                     Using `bytes` keeps this interface generic across schemes.
     *
     * @param publicInputs ABI-encoded array of additional public inputs to the circuit,
     *                     beyond the commitment itself (e.g. the minimum grade threshold
     *                     that was proven). Pass an empty bytes value if none.
     *
     * @return True if the proof is cryptographically valid, false otherwise.
     */
    function verify(
        bytes32 commitment,
        bytes calldata proof,
        bytes calldata publicInputs
    ) external view returns (bool);
}
