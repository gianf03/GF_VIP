// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UniversityRegistry
 * @notice Permissioned registry of authorized universities.
 *         Only the contract owner (central authority, e.g. Ministry of Education)
 *         can authorize or revoke universities.
 *         Other contracts in the system call `isAuthorizedUniversity` to enforce access control.
 */
contract UniversityRegistry is Ownable {
    // ─────────────────────────────────────────────
    //  Data structures
    // ─────────────────────────────────────────────

    /// @notice Represents an authorized university in the system
    struct University {
        string name; // Human-readable name, e.g. "Università La Sapienza"
        address addr; // Ethereum address used to sign credential transactions
        uint256 authorizedAt; // Block timestamp when authorization was granted
        bool isActive; // Whether the university is currently authorized
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    /// @notice Lookup university data by its Ethereum address
    mapping(address => University) private _universities;

    /// @notice Ordered list of all university addresses ever registered (including revoked)
    address[] private _universityList;

    /// @notice Count of currently active (authorized) universities
    uint256 public activeUniversityCount;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    /// @notice Emitted when a new university is authorized
    event UniversityAuthorized(
        address indexed university,
        string name,
        uint256 timestamp
    );

    /// @notice Emitted when a university's authorization is revoked
    event UniversityRevoked(address indexed university, uint256 timestamp);

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    /**
     * @notice Deploys the registry.
     *         The deploying account becomes the owner (central authority).
     */
    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    //  Owner-only functions
    // ─────────────────────────────────────────────

    /**
     * @notice Authorize a university to issue credentials.
     * @param _university  Ethereum address of the university's signing wallet.
     * @param _name        Human-readable name of the institution.
     *
     * Requirements:
     * - Caller must be the contract owner.
     * - `_university` must not be the zero address.
     * - `_university` must not already be active.
     */
    function authorizeUniversity(
        address _university,
        string calldata _name
    ) external onlyOwner {
        require(_university != address(0), "Registry: zero address");
        require(
            !_universities[_university].isActive,
            "Registry: already authorized"
        );

        // If this address was never seen before, append it to the list
        if (_universities[_university].authorizedAt == 0) {
            _universityList.push(_university);
        }

        _universities[_university] = University({
            name: _name,
            addr: _university,
            authorizedAt: block.timestamp,
            isActive: true
        });

        activeUniversityCount++;

        emit UniversityAuthorized(_university, _name, block.timestamp);
    }

    /**
     * @notice Revoke a university's authorization.
     * @param _university  Ethereum address of the university to revoke.
     *
     * Requirements:
     * - Caller must be the contract owner.
     * - `_university` must currently be active.
     */
    function revokeUniversity(address _university) external onlyOwner {
        require(
            _universities[_university].isActive,
            "Registry: not authorized"
        );

        _universities[_university].isActive = false;
        activeUniversityCount--;

        emit UniversityRevoked(_university, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  View functions (read-only, no gas cost off-chain)
    // ─────────────────────────────────────────────

    /**
     * @notice Check whether an address is a currently active authorized university.
     * @param _university  Address to check.
     * @return True if the university is active.
     */
    function isAuthorizedUniversity(
        address _university
    ) external view returns (bool) {
        return _universities[_university].isActive;
    }

    /**
     * @notice Retrieve full metadata for a university.
     * @param _university  Address of the university.
     * @return The University struct with name, address, timestamp, and active status.
     */
    function getUniversity(
        address _university
    ) external view returns (University memory) {
        return _universities[_university];
    }

    /**
     * @notice Return the list of all university addresses ever registered.
     *         Includes both active and revoked universities.
     * @return Array of addresses.
     */
    function getAllUniversityAddresses()
        external
        view
        returns (address[] memory)
    {
        return _universityList;
    }

    /**
     * @notice Return total number of universities ever registered (active + revoked).
     */
    function totalRegisteredUniversities() external view returns (uint256) {
        return _universityList.length;
    }
}
