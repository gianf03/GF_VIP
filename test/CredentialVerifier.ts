import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

/**
 * Tests for CredentialVerifier
 *
 * Because the real ZKP verifier is built by your colleague and does not exist yet,
 * we test the verifier in TWO MODES:
 *
 *   MODE A (no ZKP verifier set):
 *     verifyProof() passes if the credential exists and is not revoked.
 *     This is the "blockchain anchor" mode — useful before ZKP integration.
 *
 *   MODE B (mock ZKP verifier set):
 *     We deploy a tiny MockZKPVerifier that lets us control the result.
 *     This lets us test the full code path that calls IZKPVerifier.verify().
 *
 * We also test:
 *   - setVerifier access control
 *   - Commitment-not-found rejection
 *   - Revoked-credential rejection
 *   - On-chain verification records
 */
describe("CredentialVerifier", function () {
    // ──────────────────────────────────────────────────────────────────────
    //  Fixture: deploy the full stack
    // ──────────────────────────────────────────────────────────────────────

    async function deployVerifierFixture() {
        const [owner, university1, student, stranger] =
            await hre.ethers.getSigners();

        // ── Deploy all real contracts in order ──
        const Registry = await hre.ethers.getContractFactory("UniversityRegistry");
        const registry = await Registry.deploy();

        const SchemaContract = await hre.ethers.getContractFactory("CredentialSchema");
        const schemaContract = await SchemaContract.deploy(await registry.getAddress());

        const Issuer = await hre.ethers.getContractFactory("CredentialIssuer");
        const issuer = await Issuer.deploy(
            await registry.getAddress(),
            await schemaContract.getAddress()
        );

        const Verifier = await hre.ethers.getContractFactory("CredentialVerifier");
        const verifier = await Verifier.deploy(await issuer.getAddress());

        // ── Also deploy the mock ZKP verifier ──
        const MockVerifier = await hre.ethers.getContractFactory("MockZKPVerifier");
        const mockVerifier = await MockVerifier.deploy();

        // ── Setup: authorize university, create schema, issue one credential ──
        await registry.authorizeUniversity(university1.address, "UniRoma");
        await schemaContract.connect(university1).createSchema("BSC CS", "BSC_CS");

        const commitment = hre.ethers.solidityPackedKeccak256(
            ["address", "uint256", "uint8", "uint8", "uint256", "bytes32"],
            [student.address, 1n, 110, 110, 1700000000, hre.ethers.hexlify(hre.ethers.randomBytes(32))]
        );
        await issuer.connect(university1).issueCredential(student.address, 1, commitment);

        return {
            registry,
            schemaContract,
            issuer,
            verifier,
            mockVerifier,
            owner,
            university1,
            student,
            stranger,
            commitment,
        };
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Deployment
    // ──────────────────────────────────────────────────────────────────────

    describe("Deployment", function () {
        it("Stores the correct issuer address", async function () {
            const { verifier, issuer } = await loadFixture(deployVerifierFixture);
            expect(await verifier.issuer()).to.equal(await issuer.getAddress());
        });

        it("Starts with no ZKP verifier set", async function () {
            const { verifier } = await loadFixture(deployVerifierFixture);
            expect(await verifier.hasZKPVerifier()).to.be.false;
        });

        it("Starts with zero verifications", async function () {
            const { verifier } = await loadFixture(deployVerifierFixture);
            expect(await verifier.totalVerifications()).to.equal(0);
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  setVerifier (owner-only)
    // ──────────────────────────────────────────────────────────────────────

    describe("setVerifier", function () {
        it("Owner can set the ZKP verifier", async function () {
            const { verifier, mockVerifier } = await loadFixture(deployVerifierFixture);

            await verifier.setVerifier(await mockVerifier.getAddress());
            expect(await verifier.hasZKPVerifier()).to.be.true;
            expect(await verifier.zkpVerifier()).to.equal(await mockVerifier.getAddress());
        });

        it("Non-owner cannot set the verifier", async function () {
            const { verifier, mockVerifier, stranger } =
                await loadFixture(deployVerifierFixture);

            await expect(
                verifier.connect(stranger).setVerifier(await mockVerifier.getAddress())
            ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
        });

        it("Emits VerifierUpdated event", async function () {
            const { verifier, mockVerifier } = await loadFixture(deployVerifierFixture);

            await expect(verifier.setVerifier(await mockVerifier.getAddress()))
                .to.emit(verifier, "VerifierUpdated")
                .withArgs(hre.ethers.ZeroAddress, await mockVerifier.getAddress());
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  verifyProof — MODE A: no ZKP verifier set
    // ──────────────────────────────────────────────────────────────────────

    describe("verifyProof (no ZKP verifier)", function () {
        it("Passes for a valid, non-revoked credential", async function () {
            const { verifier, stranger } = await loadFixture(deployVerifierFixture);

            // credentialId = 1, proof = empty, publicInputs = empty
            const [valid] = await verifier.connect(stranger).verifyProof.staticCall(
                1, "0x", "0x"
            );
            expect(valid).to.be.true;
        });

        it("Reverts if credential does not exist", async function () {
            const { verifier } = await loadFixture(deployVerifierFixture);

            await expect(
                verifier.verifyProof(999, "0x", "0x")
            ).to.be.revertedWith("Verifier: credential does not exist");
        });

        it("Reverts if credential has been revoked", async function () {
            const { verifier, issuer, university1 } = await loadFixture(deployVerifierFixture);

            await issuer.connect(university1).revokeCredential(1);

            await expect(
                verifier.verifyProof(1, "0x", "0x")
            ).to.be.revertedWith("Verifier: credential is revoked");
        });

        it("Records verification on-chain and emits ProofVerified", async function () {
            const { verifier, owner } = await loadFixture(deployVerifierFixture);

            await expect(verifier.verifyProof(1, "0x", "0x"))
                .to.emit(verifier, "ProofVerified")
                .withArgs(1n, 1n, owner.address, anyValue);

            expect(await verifier.totalVerifications()).to.equal(1);
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  verifyProof — MODE B: mock ZKP verifier set
    // ──────────────────────────────────────────────────────────────────────

    describe("verifyProof (with MockZKPVerifier)", function () {
        it("Returns true when mock returns true", async function () {
            const { verifier, mockVerifier } = await loadFixture(deployVerifierFixture);

            await verifier.setVerifier(await mockVerifier.getAddress());
            await mockVerifier.setShouldReturn(true);

            const [valid] = await verifier.verifyProof.staticCall(1, "0xdeadbeef", "0x");
            expect(valid).to.be.true;
        });

        it("Returns false and does not record verification when mock returns false", async function () {
            const { verifier, mockVerifier } = await loadFixture(deployVerifierFixture);

            await verifier.setVerifier(await mockVerifier.getAddress());
            await mockVerifier.setShouldReturn(false);

            const [valid, verificationId] = await verifier.verifyProof.staticCall(
                1, "0xdeadbeef", "0x"
            );
            expect(valid).to.be.false;
            expect(verificationId).to.equal(0n);
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  Verification records
    // ──────────────────────────────────────────────────────────────────────

    describe("Verification records", function () {
        it("getVerification returns correct record", async function () {
            const { verifier, owner } = await loadFixture(deployVerifierFixture);

            await verifier.verifyProof(1, "0x", "0x");
            const record = await verifier.getVerification(1);

            expect(record.credentialId).to.equal(1n);
            expect(record.verifiedBy).to.equal(owner.address);
        });

        it("getCredentialVerifications lists all verification IDs for a credential", async function () {
            const { verifier } = await loadFixture(deployVerifierFixture);

            await verifier.verifyProof(1, "0x", "0x");
            await verifier.verifyProof(1, "0x", "0x");

            const ids = await verifier.getCredentialVerifications(1);
            expect(ids).to.deep.equal([1n, 2n]);
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  isEligibleForVerification
    // ──────────────────────────────────────────────────────────────────────

    describe("isEligibleForVerification", function () {
        it("Returns true for a valid credential", async function () {
            const { verifier } = await loadFixture(deployVerifierFixture);
            expect(await verifier.isEligibleForVerification(1)).to.be.true;
        });

        it("Returns false for unknown credential", async function () {
            const { verifier } = await loadFixture(deployVerifierFixture);
            expect(await verifier.isEligibleForVerification(999)).to.be.false;
        });

        it("Returns false for revoked credential", async function () {
            const { verifier, issuer, university1 } = await loadFixture(deployVerifierFixture);
            await issuer.connect(university1).revokeCredential(1);
            expect(await verifier.isEligibleForVerification(1)).to.be.false;
        });
    });
});

async function latestTimestamp(): Promise<number> {
    const block = await hre.ethers.provider.getBlock("latest");
    return block!.timestamp;
}
