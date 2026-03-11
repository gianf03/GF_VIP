/**
 * deploy-and-save.js
 *
 * Deploys the core contract set to a local Hardhat node and saves
 * addresses to frontend/deploy-config.json so the frontend auto-loads them.
 *
 * Contract set:
 *   1. UniversityRegistry  — owner whitelists universities
 *   2. CredentialIssuer    — universities publish Merkle roots (no personal data)
 *   3. CircuitRegistry     — owner stores ZoKrates verification keys per circuit
 *
 * Usage:
 *   Terminal 1 → npx hardhat node
 *   Terminal 2 → node scripts/deploy-and-save.js
 *
 *   Then open the frontend with:  npx serve frontend
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Hardhat's default local RPC
const RPC_URL = "http://127.0.0.1:8545";
// Hardhat's first test account private key (always the same on local node)
const OWNER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const owner = new ethers.Wallet(OWNER_KEY, provider);

    console.log("Deploying with owner:", owner.address);

    // Fetch the starting nonce once to avoid race conditions with Hardhat automining.
    let nonce = await provider.getTransactionCount(owner.address, "pending");
    const deployOpts = () => ({ nonce: nonce++ });

    // ── 1. UniversityRegistry ──────────────────────────────────────────────
    const RegistryArtifact = require("../artifacts/contracts/Authority.sol/UniversityRegistry.json");
    const RegistryFactory = new ethers.ContractFactory(RegistryArtifact.abi, RegistryArtifact.bytecode, owner);
    const registry = await RegistryFactory.deploy(deployOpts());
    await registry.waitForDeployment();
    const registryAddr = await registry.getAddress();
    console.log("✅ UniversityRegistry:", registryAddr);

    // ── 2. CredentialIssuer ────────────────────────────────────────────────
    const IssuerArtifact = require("../artifacts/contracts/CredentialIssuer.sol/CredentialIssuer.json");
    const IssuerFactory = new ethers.ContractFactory(IssuerArtifact.abi, IssuerArtifact.bytecode, owner);
    const issuer = await IssuerFactory.deploy(registryAddr, deployOpts());
    await issuer.waitForDeployment();
    const issuerAddr = await issuer.getAddress();
    console.log("✅ CredentialIssuer: ", issuerAddr);

    // ── 3. CircuitRegistry ─────────────────────────────────────────────────
    const CircuitArtifact = require("../artifacts/contracts/CircuitRegistry.sol/CircuitRegistry.json");
    const CircuitFactory = new ethers.ContractFactory(CircuitArtifact.abi, CircuitArtifact.bytecode, owner);
    const circuitRegistry = await CircuitFactory.deploy(deployOpts());
    await circuitRegistry.waitForDeployment();
    const circuitRegistryAddr = await circuitRegistry.getAddress();
    console.log("✅ CircuitRegistry:  ", circuitRegistryAddr);

    // ── Save to frontend/deploy-config.json ───────────────────────────────
    const config = {
        UniversityRegistry: registryAddr,
        CredentialIssuer: issuerAddr,
        CircuitRegistry: circuitRegistryAddr,
        ownerAddress: owner.address,
        deployedAt: new Date().toISOString(),
    };

    const outPath = path.join(__dirname, "..", "frontend", "deploy-config.json");
    fs.writeFileSync(outPath, JSON.stringify(config, null, 2));
    console.log("\n📄 Saved to frontend/deploy-config.json");

    console.log("\n🚀 Open the frontend with:");
    console.log("   npx serve frontend");
    console.log("\n🔑 Hardhat test accounts for MetaMask:");
    console.log("   Network: Hardhat Localhost · RPC: http://127.0.0.1:8545 · Chain ID: 31337");
    console.log("   Account 0 (owner) PK: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
    console.log("   Account 1 (uni)   PK: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
    console.log("   Account 2 (uni2)  PK: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
}

main().catch(err => {
    console.error("Deploy failed:", err.message);
    process.exit(1);
});
