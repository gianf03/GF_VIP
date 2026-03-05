// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CredentialIssuer.sol";
import "./interfaces/IZKPVerifier.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CredentialVerifier
 * @notice Provides on-chain verification of ZKP proofs against issued credentials.
 *         Acts as the bridge between this blockchain system and the ZKP circuits
 *         built by your colleague.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  INTEGRATION GUIDE FOR YOUR COLLEAGUE                                │
 * │                                                                      │
 * │  Step 1: Implement IZKPVerifier in a separate Solidity contract.     │
 * │          Your verify() function receives:                            │
 * │            - commitment:   the bytes32 hash stored on-chain          │
 * │            - proof:        the Groth16 / PLONK proof bytes           │
 * │            - publicInputs: any additional public signals             │
 * │          Return true if the proof is valid, false otherwise.         │
 * │                                                                      │
 * │  Step 2: Deploy your verifier contract.                              │
 * │                                                                      │
 * │  Step 3: The owner of THIS contract calls                            │
 * │          setVerifier(yourVerifierAddress)                            │
 * │          to activate full ZKP verification.                         │
 * │                                                                      │
 * │  Until a verifier is set, verifyProof() performs commitment          │
 * │  existence / revocation checks only (no ZK math).                   │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Typical verification flow:
 *   1. Student generates ZKP proof off-chain (e.g. using snarkjs).
 *   2. Anyone calls verifyProof() with the credentialId + proof bytes.
 *   3. Contract checks: credential exists, not revoked, ZKP is valid.
 *   4. Returns bool result (and optionally records the verification on-chain).
 */
contract CredentialVerifier is Ownable {
    // ─────────────────────────────────────────────
    //  Data structures
    // ─────────────────────────────────────────────

    /**
     * @notice On-chain record of a successful proof verification.
     *         Storing this allows third parties (employers, etc.) to audit
     *         who has been verified, without needing to resubmit the proof.
     */
    struct VerificationRecord {
        uint256 credentialId; // The credential that was proven about
        address verifiedBy; // Who submitted the proof (could be the student or a third party)
        uint256 verifiedAt; // Timestamp
        bytes32 proofHash; // keccak256(proof) — a compact fingerprint for audit purposes
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    /// @notice Reference to the issuance contract (source of truth for credentials)
    CredentialIssuer public immutable issuer;

    /**
     * @notice Optional ZKP verifier contract set by the owner.
     *         Zero address means "ZKP verification not yet integrated".
     *         Once your colleague's verifier is ready, set it here.
     */
    IZKPVerifier public zkpVerifier;

    uint256 private _nextVerificationId;

    /// @notice All on-chain verification records
    mapping(uint256 => VerificationRecord) private _verifications;

    /// @notice Verification IDs grouped by credential ID
    mapping(uint256 => uint256[]) private _credentialVerifications;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    /// @notice Emitted when the ZKP verifier contract address is updated
    event VerifierUpdated(
        address indexed oldVerifier,
        address indexed newVerifier
    );

    /**
     * @notice Emitted when a proof is successfully verified.
     * @param verificationId  Unique ID of this verification record.
     * @param credentialId    Credential that was proven about.
     * @param verifiedBy      Caller who submitted the proof.
     * @param timestamp       Block timestamp.
     */
    event ProofVerified(
        uint256 indexed verificationId,
        uint256 indexed credentialId,
        address indexed verifiedBy,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    /**
     * @param _issuer   Address of the deployed CredentialIssuer contract.
     */
    constructor(address _issuer) Ownable(msg.sender) {
        require(_issuer != address(0), "Verifier: zero issuer address");
        issuer = CredentialIssuer(_issuer);
        _nextVerificationId = 1;
    }

    // ─────────────────────────────────────────────
    //  Owner-only configuration
    // ─────────────────────────────────────────────

    /**
     * @notice Set (or update) the ZKP verifier contract.
     *         Can only be called by the contract owner.
     *         To remove the verifier (revert to commitment-only mode), pass address(0).
     * @param _verifier  Address of the IZKPVerifier implementation.
     */
    function setVerifier(address _verifier) external onlyOwner {
        emit VerifierUpdated(address(zkpVerifier), _verifier);
        zkpVerifier = IZKPVerifier(_verifier);
    }

    // ─────────────────────────────────────────────
    //  Core verification
    // ─────────────────────────────────────────────

    /**
     * @notice Verify a ZKP proof for a given credential.
     *
     * Performs the following checks IN ORDER:
     *   1. Credential exists (credentialId > 0 and commitment != 0).
     *   2. Credential has not been revoked.
     *   3. If a ZKP verifier has been set: run the cryptographic proof check.
     *
     * If all checks pass, a VerificationRecord is written on-chain and an
     * event is emitted so third parties can audit verifications without
     * rerunning the proof.
     *
     * @param _credentialId  ID of the credential being proven about.
     * @param _proof         Encoded ZKP proof bytes (format defined by IZKPVerifier).
     * @param _publicInputs  Encoded public inputs for the circuit (e.g. min grade).
     *                       Pass `""` (empty bytes) if the circuit has no extra inputs.
     * @return valid         True if all checks pass.
     * @return verificationId  Unique ID of the on-chain record (0 if proof failed).
     */
    function verifyProof(
        uint256 _credentialId,
        bytes calldata _proof,
        bytes calldata _publicInputs
    ) external returns (bool valid, uint256 verificationId) {
        // ── Step 1: retrieve the commitment from CredentialIssuer ──
        bytes32 commitment = issuer.getCommitment(_credentialId);
        require(
            commitment != bytes32(0),
            "Verifier: credential does not exist"
        );

        // ── Step 2: revocation check ──
        require(
            !issuer.isRevoked(_credentialId),
            "Verifier: credential is revoked"
        );

        // ── Step 3: ZKP check (if verifier is set) ──
        if (address(zkpVerifier) != address(0)) {
            valid = zkpVerifier.verify(commitment, _proof, _publicInputs);
            if (!valid) {
                return (false, 0);
            }
        } else {
            // No ZKP verifier set yet — commitment existence + non-revocation
            // is the only guarantee we can offer at this stage.
            // This is intentional: the commitment anchor is still useful for
            // basic lookups before the ZKP circuit is integrated.
            valid = true;
        }

        // ── Step 4: record the successful verification on-chain ──
        verificationId = _nextVerificationId++;

        _verifications[verificationId] = VerificationRecord({
            credentialId: _credentialId,
            verifiedBy: msg.sender,
            verifiedAt: block.timestamp,
            proofHash: keccak256(_proof)
        });

        _credentialVerifications[_credentialId].push(verificationId);

        emit ProofVerified(
            verificationId,
            _credentialId,
            msg.sender,
            block.timestamp
        );
    }

    // ─────────────────────────────────────────────
    //  View functions
    // ─────────────────────────────────────────────

    /**
     * @notice Quick pre-check: is a credential eligible for ZKP verification?
     *         Returns false if it doesn't exist or is revoked.
     * @param _credentialId  ID to check.
     */
    function isEligibleForVerification(
        uint256 _credentialId
    ) external view returns (bool) {
        bytes32 commitment = issuer.getCommitment(_credentialId);
        if (commitment == bytes32(0)) return false;
        if (issuer.isRevoked(_credentialId)) return false;
        return true;
    }

    /**
     * @notice Retrieve details of a specific verification record.
     * @param _verificationId  ID of the record to fetch.
     */
    function getVerification(
        uint256 _verificationId
    ) external view returns (VerificationRecord memory) {
        return _verifications[_verificationId];
    }

    /**
     * @notice Get all verification IDs for a given credential.
     *         Useful for auditing how many times and by whom a credential was verified.
     * @param _credentialId  Credential to query.
     */
    function getCredentialVerifications(
        uint256 _credentialId
    ) external view returns (uint256[] memory) {
        return _credentialVerifications[_credentialId];
    }

    /**
     * @notice True if a ZKP verifier contract has been set.
     */
    function hasZKPVerifier() external view returns (bool) {
        return address(zkpVerifier) != address(0);
    }

    /**
     * @notice Total number of successful verifications recorded.
     */
    function totalVerifications() external view returns (uint256) {
        return _nextVerificationId - 1;
    }
}
