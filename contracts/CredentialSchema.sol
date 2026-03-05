// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Authority.sol";

/**
 * @title CredentialSchema
 * @notice Manages the catalogue of credential types (schemas) that authorized universities
 *         can define and later use when issuing credentials.
 *
 * A "schema" is a named template describing a category of credential,
 * e.g. "Laurea Triennale in Informatica" or "Master in Cybersecurity".
 * By requiring a valid schemaId at issuance time we ensure that every
 * credential follows a recognized, well-defined template.
 *
 * Access control:
 *   - Only addresses authorized in UniversityRegistry may create schemas.
 *   - The schema's creator (or any other authorized university) can deactivate it.
 *   - Any address can read schema data (view functions).
 */
contract CredentialSchema {
    // ─────────────────────────────────────────────
    //  Data structures
    // ─────────────────────────────────────────────

    /// @notice Represents a single credential type
    struct Schema {
        uint256 id; // Auto-incremented unique identifier
        string name; // Full name, e.g. "Laurea Triennale in Informatica"
        string schemaCode; // Short code, e.g. "LT_INF"
        address creator; // University that registered this schema
        uint256 createdAt; // Block timestamp of creation
        bool isActive; // Can be deactivated if deprecated/replaced
    }

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    /// @notice Reference to the registry that controls who is authorized
    UniversityRegistry public immutable registry;

    /// @notice Counter used to generate unique schema IDs (starts at 1)
    uint256 private _nextSchemaId;

    /// @notice Lookup a schema by its ID
    mapping(uint256 => Schema) private _schemas;

    /// @notice All schema IDs ever created (active and inactive)
    uint256[] private _allSchemaIds;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    /// @notice Emitted when a new schema is created
    event SchemaCreated(
        uint256 indexed schemaId,
        string name,
        string schemaCode,
        address indexed creator,
        uint256 timestamp
    );

    /// @notice Emitted when a schema is deactivated
    event SchemaDeactivated(
        uint256 indexed schemaId,
        address indexed by,
        uint256 timestamp
    );

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────

    /**
     * @dev Reverts if the caller is not an active authorized university.
     *      We call the registry contract to perform this check.
     */
    modifier onlyAuthorizedUniversity() {
        require(
            registry.isAuthorizedUniversity(msg.sender),
            "Schema: caller is not an authorized university"
        );
        _;
    }

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    /**
     * @notice Deploy the CredentialSchema contract.
     * @param _registry  Address of the already-deployed UniversityRegistry contract.
     */
    constructor(address _registry) {
        require(_registry != address(0), "Schema: zero registry address");
        registry = UniversityRegistry(_registry);
        _nextSchemaId = 1; // IDs start at 1 so that 0 can signal "not found"
    }

    // ─────────────────────────────────────────────
    //  University-only write functions
    // ─────────────────────────────────────────────

    /**
     * @notice Register a new credential schema.
     * @param _name        Full name of the credential type.
     * @param _schemaCode  Short, unique code (e.g. "BSC_CS"). Purely informational.
     * @return schemaId    The unique ID assigned to this schema.
     *
     * Requirements:
     * - Caller must be an authorized university.
     * - `_name` and `_schemaCode` must not be empty strings.
     */
    function createSchema(
        string calldata _name,
        string calldata _schemaCode
    ) external onlyAuthorizedUniversity returns (uint256 schemaId) {
        require(bytes(_name).length > 0, "Schema: name is empty");
        require(bytes(_schemaCode).length > 0, "Schema: schemaCode is empty");

        schemaId = _nextSchemaId++;

        _schemas[schemaId] = Schema({
            id: schemaId,
            name: _name,
            schemaCode: _schemaCode,
            creator: msg.sender,
            createdAt: block.timestamp,
            isActive: true
        });

        _allSchemaIds.push(schemaId);

        emit SchemaCreated(
            schemaId,
            _name,
            _schemaCode,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Deactivate an existing schema (e.g. when it is replaced by a newer version).
     *         Deactivated schemas cannot be used for new credential issuance.
     *         Already-issued credentials that referenced this schema remain valid.
     * @param _schemaId  ID of the schema to deactivate.
     *
     * Requirements:
     * - Caller must be an authorized university.
     * - Schema must currently be active.
     */
    function deactivateSchema(
        uint256 _schemaId
    ) external onlyAuthorizedUniversity {
        require(
            _schemas[_schemaId].isActive,
            "Schema: already inactive or does not exist"
        );
        _schemas[_schemaId].isActive = false;
        emit SchemaDeactivated(_schemaId, msg.sender, block.timestamp);
    }

    // ─────────────────────────────────────────────
    //  View functions
    // ─────────────────────────────────────────────

    /**
     * @notice Retrieve full data for a schema by ID.
     * @param _schemaId  ID to look up.
     * @return The Schema struct. If the ID was never created, all fields are zero/false.
     */
    function getSchema(
        uint256 _schemaId
    ) external view returns (Schema memory) {
        return _schemas[_schemaId];
    }

    /**
     * @notice Check whether a schema ID exists and is currently active.
     *         Used by CredentialIssuer to validate issuance requests.
     * @param _schemaId  ID to check.
     * @return True if active.
     */
    function isActiveSchema(uint256 _schemaId) external view returns (bool) {
        return _schemas[_schemaId].isActive;
    }

    /**
     * @notice Return the list of all schema IDs ever created.
     * @return Array of schema IDs.
     */
    function getAllSchemaIds() external view returns (uint256[] memory) {
        return _allSchemaIds;
    }

    /**
     * @notice Total number of schemas ever created (active + inactive).
     */
    function totalSchemas() external view returns (uint256) {
        return _allSchemaIds.length;
    }
}
