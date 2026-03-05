# MicroChain — Permissioned Blockchain for Microcredentials

A permissioned blockchain system where **recognized universities** issue academic credentials on-chain and **students** can later prove possession of those credentials via Zero Knowledge Proofs (ZKP).

## Architecture

| Contract | Purpose |
|---|---|
| `UniversityRegistry` | Owner manages which university addresses are authorized |
| `CredentialSchema` | Authorized universities define credential types (name + code) |
| `CredentialIssuer` | Universities issue credentials as keccak256 commitments |
| `CredentialVerifier` | Verifies credentials, integrates with ZKP verifier |

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [MetaMask](https://metamask.io/) browser extension

## Install

```bash
npm install
```

## Compile contracts

```bash
npx hardhat compile
```

## Run tests

```bash
npx hardhat test
```

All 76 tests should pass covering all four contracts.

## Run the frontend (local development)

### 1. Start a local Hardhat node

```bash
npx hardhat node
```

Leave this terminal running. It starts a local Ethereum node at `http://127.0.0.1:8545` with 20 funded test accounts.

### 2. Deploy the contracts

In a **new terminal**:

```bash
npx hardhat ignition deploy ignition/modules/DeployAll.ts --network localhost
```

This deploys all 4 contracts in order and prints their addresses. The addresses are saved to `ignition/deployments/chain-31337/deployed_addresses.json`, which the frontend reads automatically.

> **Alternative:** you can also deploy with `node scripts/deploy-and-save.js`, which writes a `frontend/deploy-config.json` file instead.

### 3. Serve the frontend

In a **new terminal**:

```bash
npx serve frontend
```

Open the URL shown (usually `http://localhost:3000`) in your browser.

### 4. Configure MetaMask

1. **Add the Hardhat network** — go to MetaMask → Settings → Networks → Add a network manually:

   | Field | Value |
   |---|---|
   | Network Name | `Hardhat` |
   | RPC URL | `http://127.0.0.1:8545` |
   | Chain ID | `31337` |
   | Currency Symbol | `ETH` |

2. **Import a test account** — MetaMask → Import Account → paste one of these private keys:

   | Account | Role | Private Key |
   |---|---|---|
   | #0 | Owner | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
   | #1 | University | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
   | #2 | University | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |

   > ⚠️ These keys are publicly known Hardhat test keys. Never use them on a real network.

3. **Switch to the Hardhat network** in MetaMask's network selector.

### 5. Use the frontend

1. Click **Connect MetaMask** — your wallet connects and contract addresses are auto-loaded.
2. Click **Load Contracts** — your role (Owner / University / Guest) is detected automatically.
3. Use the tabs:
   - **🏛️ Universities** — the owner can authorize/revoke university addresses.
   - **📋 Credential Types** — authorized universities can create/deactivate credential schemas.

### Troubleshooting

If you get a `BAD_DATA` or `could not decode result data` error:

- **Check the contract addresses** — if you restarted the node and redeployed, the addresses may have changed. Delete `ignition/deployments/chain-31337` and redeploy.
- **Clear MetaMask cache** — MetaMask → Settings → Advanced → **Clear activity and nonce data**. This resets stale RPC cache from previous node sessions.
- **Verify ChainID** — the Hardhat network in MetaMask must use Chain ID **31337**, not 1337.

## Project structure

```
contracts/
├── Authority.sol            # UniversityRegistry
├── CredentialSchema.sol     # Credential type definitions
├── CredentialIssuer.sol     # Commitment-based credential issuance
├── CredentialVerifier.sol   # On-chain verification + ZKP bridge
├── interfaces/
│   └── IZKPVerifier.sol     # Interface for ZKP integration
└── test/
    └── MockZKPVerifier.sol  # Mock verifier for testing

test/
├── UniversityRegistry.ts
├── CredentialSchema.ts
├── CredentialIssuer.ts
└── CredentialVerifier.ts

frontend/
├── index.html               # Admin dashboard UI
├── style.css                 # Dark glassmorphism design system
└── app.js                    # Contract interaction logic + ABIs

ignition/modules/
└── DeployAll.ts              # Hardhat Ignition deployment module

scripts/
└── deploy-and-save.js        # Alternative deploy script
```

## ZKP Integration

The `IZKPVerifier` interface in `contracts/interfaces/IZKPVerifier.sol` is the integration point for Zero Knowledge Proof verification. A separate verifier contract implementing this interface can be connected via `CredentialVerifier.setZKPVerifier()`.
