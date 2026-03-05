// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Authority.sol";
import "./CredentialSchema.sol";

/**
 * @title CredentialIssuer
 * @notice Core contract for issuing academic credentials on-chain.
 *
 * ┌────────────────────────────────────────────────────────────────────┐
 * │  PRIVACY BY DESIGN — WHY WE STORE A COMMITMENT, NOT PLAINTEXT     │
 * │                                                                    │
 * │  If we stored "Alice Rossi, grade: 110, UniRoma, BSC_CS, 2025"   │
 * │  everyone could read it — zero privacy.                            │
 * │                                                                    │
 * │  Instead, the university computes:                                 │
 * │    commitment = keccak256(abi.encodePacked(                       │
 * │        studentAddress, schemaId, gradeNumerator,                  │
 * │        gradeDenominator, issuanceDate, salt                       │
 * │    ))                                                              │
 * │  … OFF-CHAIN, and submits only the 32-byte commitment.            │
 * │                                                                    │
 * │  The student keeps their private data (+ the salt).               │
 * │  Later, a ZKP circuit proves properties about that data           │
 * │  without revealing it.                                             │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Key operations:
 *   issueCredential()  — university records a new credential commitment
 *   revokeCredential() — university marks a credential as revoked (fraud, error, …)
 *
 * Access control:
 *   - Only addresses authorized in UniversityRegistry may issue/revoke credentials.
 *   - A credential can only be revoked by the university that issued it.
 *   - Read functions are public.
 */
contract CredentialIssuer {
    // ─────────────────────────────────────────────
    //  Data structures
    // ─────────────────────────────────────────────

    /**
     * @notice Represents a credential issued to a student.
     *
     * Fields:
     *   credentialId  — unique auto-incremented ID
     *   issuer        — university address that issued this credential
     *   student       — student's Ethereum address (their DID / wallet)
     *   schemaId      — references CredentialSchema for the credential type
     *   commitment    — keccak256 hash of the private credential data
     *   issuedAt      — block timestamp of issuance
     *   isRevoked     — true after the issuer revokes this credential
     */
    struct Credential {
        uint256 credentialId;
        address issuer;
        address student;
        uint256 schemaId;
        bytes32 commitment;
        uint256 issuedAt;
        bool isRevoked;
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    UniversityRegistry public immutable registry;
    CredentialSchema public immutable schemaRegistry;

    uint256 private _nextCredentialId;

    /// @notice All credentials by ID
    mapping(uint256 => Credential) private _credentials;

    /// @notice Prevent the same commitment being registered twice
    mapping(bytes32 => bool) public commitmentUsed;

    /// @notice credentialId → true once revoked (redundant with Credential.isRevoked but cheaper to read)
    mapping(uint256 => bool) public isRevoked;

    /// @notice List of credential IDs belonging to each student address
    mapping(address => uint256[]) private _studentCredentials;

    /// @notice List of credential IDs issued by each university address
    mapping(address => uint256[]) private _issuerCredentials;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    /**
     * @notice Emitted when a new credential is issued.
     * @param credentialId  Unique ID of this credential.
     * @param issuer        University that issued it.
     * @param student       Recipient student.
     * @param schemaId      Credential type schema ID.
     * @param commitment    keccak256 commitment hash of the private data.
     * @param timestamp     Block timestamp of issuance.
     */
    event CredentialIssued(
        uint256 indexed credentialId,
        address indexed issuer,
        address indexed student,
        uint256 schemaId,
        bytes32 commitment,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a credential is revoked.
     * @param credentialId  ID of the revoked credential.
     * @param revokedBy     University that performed the revocation.
     * @param timestamp     Block timestamp of revocation.
     */
    event CredentialRevoked(
        uint256 indexed credentialId,
        address indexed revokedBy,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────

    modifier onlyAuthorizedUniversity() {
        require(
            registry.isAuthorizedUniversity(msg.sender),
            "Issuer: caller is not an authorized university"
        );
        _;
    }

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    /**
     * @param _registry        Address of the deployed UniversityRegistry contract.
     * @param _schemaRegistry  Address of the deployed CredentialSchema contract.
     */
    constructor(address _registry, address _schemaRegistry) {
        require(_registry != address(0), "Issuer: zero registry address");
        require(_schemaRegistry != address(0), "Issuer: zero schema address");

        registry = UniversityRegistry(_registry);
        schemaRegistry = CredentialSchema(_schemaRegistry);
        _nextCredentialId = 1;
    }

    // ─────────────────────────────────────────────
    //  University-only write functions
    // ─────────────────────────────────────────────

    /**
     * @notice Issue a new credential to a student.
     *
     * HOW TO COMPUTE THE COMMITMENT (off-chain, e.g. in ethers.js):
     *   const commitment = ethers.utils.solidityKeccak256(
     *       ["address", "uint256", "uint8", "uint8", "uint256", "bytes32"],
     *       [studentAddr, schemaId, gradeNum, gradeDen, issuanceDateUnix, salt]
     *   );
     *
     * @param _student     Ethereum address of the student recipient.
     * @param _schemaId    ID of the credential schema (must be active).
     * @param _commitment  keccak256 hash of the full private credential data.
     * @return credentialId  The unique ID assigned to this credential.
     *
     * Requirements:
     * - Caller must be an authorized university.
     * - `_student` must not be the zero address.
     * - `_schemaId` must reference an active schema.
     * - `_commitment` must not have been used before (prevents duplicates).
     */
    function issueCredential(
        address _student,
        uint256 _schemaId,
        bytes32 _commitment
    ) external onlyAuthorizedUniversity returns (uint256 credentialId) {
        require(_student != address(0), "Issuer: zero student address");
        require(_commitment != bytes32(0), "Issuer: empty commitment");
        require(
            !commitmentUsed[_commitment],
            "Issuer: commitment already used"
        );
        require(
            schemaRegistry.isActiveSchema(_schemaId),
            "Issuer: schema not active"
        );

        credentialId = _nextCredentialId++;

        _credentials[credentialId] = Credential({
            credentialId: credentialId,
            issuer: msg.sender,
            student: _student,
            schemaId: _schemaId,
            commitment: _commitment,
            issuedAt: block.timestamp,
            isRevoked: false
        });

        commitmentUsed[_commitment] = true;
        _studentCredentials[_student].push(credentialId);
        _issuerCredentials[msg.sender].push(credentialId);

        emit CredentialIssued(
            credentialId,
            msg.sender,
            _student,
            _schemaId,
            _commitment,
            block.timestamp
        );
    }

    /**
     * @notice Revoke a previously issued credential.
     *         Use cases: discovered fraud, data entry error, accreditation withdrawal.
     *         Revoked credentials will fail ZKP verification checks.
     *
     * @param _credentialId  ID of the credential to revoke.
     *
     * Requirements:
     * - Caller must be the university that originally issued this credential.
     * - Credential must not already be revoked.
     */
    function revokeCredential(
        uint256 _credentialId
    ) external onlyAuthorizedUniversity {
        Credential storage cred = _credentials[_credentialId];

        require(cred.credentialId != 0, "Issuer: credential does not exist");
        require(cred.issuer == msg.sender, "Issuer: only issuer can revoke");
        require(!cred.isRevoked, "Issuer: already revoked");

        cred.isRevoked = true;
        isRevoked[_credentialId] = true;

        emit CredentialRevoked(_credentialId, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  View functions
    // ─────────────────────────────────────────────

    /**
     * @notice Retrieve a credential by its ID.
     * @param _credentialId  ID to look up.
     * @return The full Credential struct.
     */
    function getCredential(
        uint256 _credentialId
    ) external view returns (Credential memory) {
        return _credentials[_credentialId];
    }

    /**
     * @notice Get the commitment stored for a given credential ID.
     *         Used by CredentialVerifier to look up the commitment before
     *         running ZKP verification.
     * @param _credentialId  ID to look up.
     * @return commitment  32-byte commitment hash, bytes32(0) if credential doesn't exist.
     */
    function getCommitment(
        uint256 _credentialId
    ) external view returns (bytes32) {
        return _credentials[_credentialId].commitment;
    }

    /**
     * @notice Check whether a credential is valid (exists, not revoked).
     * @param _credentialId  ID to check.
     * @return True if the credential exists and has not been revoked.
     */
    function isCredentialValid(
        uint256 _credentialId
    ) external view returns (bool) {
        Credential storage cred = _credentials[_credentialId];
        return cred.credentialId != 0 && !cred.isRevoked;
    }

    /**
     * @notice Get all credential IDs issued to a specific student.
     * @param _student  Student address.
     * @return Array of credential IDs.
     */
    function getStudentCredentials(
        address _student
    ) external view returns (uint256[] memory) {
        return _studentCredentials[_student];
    }

    /**
     * @notice Get all credential IDs issued by a specific university.
     * @param _issuer  University address.
     * @return Array of credential IDs.
     */
    function getIssuerCredentials(
        address _issuer
    ) external view returns (uint256[] memory) {
        return _issuerCredentials[_issuer];
    }

    /**
     * @notice Total number of credentials ever issued (including revoked).
     */
    function totalCredentials() external view returns (uint256) {
        return _nextCredentialId - 1;
    }
}
