import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * DeployAll — Hardhat Ignition deployment module.
 *
 * Deploys all four contracts in dependency order:
 *   1. UniversityRegistry   (no dependencies)
 *   2. CredentialSchema     (needs registry address)
 *   3. CredentialIssuer     (needs registry + schema addresses)
 *   4. CredentialVerifier   (needs issuer address)
 *
 * Usage:
 *   npx hardhat ignition deploy ignition/modules/DeployAll.ts --network <network>
 *
 * After deployment you'll see the four contract addresses in the console.
 * Pass the CredentialIssuer address to your colleague so they can build
 * the ZKP verifier that reads commitments from it.
 */
const DeployAll = buildModule("DeployAll", (m) => {
    // ── 1. UniversityRegistry ──────────────────────────────────────────────
    // No constructor arguments — the deploying account becomes the owner.
    const registry = m.contract("UniversityRegistry");

    // ── 2. CredentialSchema ───────────────────────────────────────────────
    // Needs the registry address to check university authorization.
    const schema = m.contract("CredentialSchema", [registry]);

    // ── 3. CredentialIssuer ───────────────────────────────────────────────
    // Needs both the registry (for access control) and the schema contract
    // (to validate schemaIds at issuance time).
    const issuer = m.contract("CredentialIssuer", [registry, schema]);

    // ── 4. CredentialVerifier ─────────────────────────────────────────────
    // Needs the issuer to look up commitments and revocation status.
    // No ZKP verifier is set at deployment — add it later via setVerifier().
    const verifier = m.contract("CredentialVerifier", [issuer]);

    return { registry, schema, issuer, verifier };
});

export default DeployAll;
