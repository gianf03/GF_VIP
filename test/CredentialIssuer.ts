import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

/**
 * Tests for CredentialIssuer
 *
 * What we test:
 *  - Deployment with correct references
 *  - issueCredential: success, access control, invalid schema, duplicate commitment
 *  - revokeCredential: success, access control, wrong issuer, double-revocation
 *  - View functions: getCredential, getCommitment, isCredentialValid,
 *                    getStudentCredentials, getIssuerCredentials, totalCredentials
 *  - Full end-to-end flow: authorize → create schema → issue credential → revoke
 */
describe("CredentialIssuer", function () {
    // ──────────────────────────────────────────────────────────────────────
    //  Fixture
    // ──────────────────────────────────────────────────────────────────────

    async function deployIssuerFixture() {
        const [owner, university1, university2, student, stranger] =
            await hre.ethers.getSigners();

        const Registry = await hre.ethers.getContractFactory("UniversityRegistry");
        const registry = await Registry.deploy();

        const SchemaContract = await hre.ethers.getContractFactory("CredentialSchema");
        const schemaContract = await SchemaContract.deploy(await registry.getAddress());

        const Issuer = await hre.ethers.getContractFactory("CredentialIssuer");
        const issuer = await Issuer.deploy(
            await registry.getAddress(),
            await schemaContract.getAddress()
        );

        // Set up: authorize university1, create schema 1
        await registry.authorizeUniversity(university1.address, "UniRoma");
        await schemaContract.connect(university1).createSchema("BSC CS", "BSC_CS");

        return {
            registry,
            schemaContract,
            issuer,
            owner,
            university1,
            university2,
            student,
            stranger,
        };
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Helper: compute a well-formed commitment the same way contracts expect it
    //  (keccak256 of ABI-packed fields)
    // ──────────────────────────────────────────────────────────────────────

    function makeCommitment(
        studentAddr: string,
        schemaId: bigint,
        gradeNum: number,
        gradeDen: number,
        issuanceDate: number,
        salt: string
    ): string {
        return hre.ethers.solidityPackedKeccak256(
            ["address", "uint256", "uint8", "uint8", "uint256", "bytes32"],
            [studentAddr, schemaId, gradeNum, gradeDen, issuanceDate, salt]
        );
    }

    function randomSalt(): string {
        return hre.ethers.hexlify(hre.ethers.randomBytes(32));
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Deployment
    // ──────────────────────────────────────────────────────────────────────

    describe("Deployment", function () {
        it("Stores the correct registry address", async function () {
            const { issuer, registry } = await loadFixture(deployIssuerFixture);
            expect(await issuer.registry()).to.equal(await registry.getAddress());
        });

        it("Stores the correct schema address", async function () {
            const { issuer, schemaContract } = await loadFixture(deployIssuerFixture);
            expect(await issuer.schemaRegistry()).to.equal(await schemaContract.getAddress());
        });

        it("Starts with zero credentials", async function () {
            const { issuer } = await loadFixture(deployIssuerFixture);
            expect(await issuer.totalCredentials()).to.equal(0);
        });

        it("Reverts with zero registry address", async function () {
            const Issuer = await hre.ethers.getContractFactory("CredentialIssuer");

            const { schemaContract } = await loadFixture(deployIssuerFixture);
            await expect(
                Issuer.deploy(hre.ethers.ZeroAddress, await schemaContract.getAddress())
            ).to.be.revertedWith("Issuer: zero registry address");
        });

        it("Reverts with zero schema address", async function () {
            const Issuer = await hre.ethers.getContractFactory("CredentialIssuer");

            const { registry } = await loadFixture(deployIssuerFixture);
            await expect(
                Issuer.deploy(await registry.getAddress(), hre.ethers.ZeroAddress)
            ).to.be.revertedWith("Issuer: zero schema address");
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  issueCredential
    // ──────────────────────────────────────────────────────────────────────

    describe("issueCredential", function () {
        it("Authorized university can issue a credential", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);

            const commitment = makeCommitment(student.address, 1n, 110, 110, 1700000000, randomSalt());
            await issuer.connect(university1).issueCredential(student.address, 1, commitment);

            expect(await issuer.totalCredentials()).to.equal(1);
        });

        it("Stores credential data correctly", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);

            const commitment = makeCommitment(student.address, 1n, 110, 110, 1700000000, randomSalt());
            await issuer.connect(university1).issueCredential(student.address, 1, commitment);

            const cred = await issuer.getCredential(1);
            expect(cred.credentialId).to.equal(1n);
            expect(cred.issuer).to.equal(university1.address);
            expect(cred.student).to.equal(student.address);
            expect(cred.schemaId).to.equal(1n);
            expect(cred.commitment).to.equal(commitment);
            expect(cred.isRevoked).to.be.false;
        });

        it("Returns incrementing credential IDs", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);

            const c1 = makeCommitment(student.address, 1n, 110, 110, 1700000001, randomSalt());
            const c2 = makeCommitment(student.address, 1n, 105, 110, 1700000002, randomSalt());

            const id1 = await issuer.connect(university1).issueCredential.staticCall(
                student.address, 1, c1
            );
            await issuer.connect(university1).issueCredential(student.address, 1, c1);

            const id2 = await issuer.connect(university1).issueCredential.staticCall(
                student.address, 1, c2
            );

            expect(id1).to.equal(1n);
            expect(id2).to.equal(2n);
        });

        it("Unauthorized address is rejected", async function () {
            const { issuer, student, stranger } = await loadFixture(deployIssuerFixture);

            const commitment = makeCommitment(student.address, 1n, 110, 110, 1700000000, randomSalt());
            await expect(
                issuer.connect(stranger).issueCredential(student.address, 1, commitment)
            ).to.be.revertedWith("Issuer: caller is not an authorized university");
        });

        it("Reverts on zero student address", async function () {
            const { issuer, university1 } = await loadFixture(deployIssuerFixture);

            await expect(
                issuer.connect(university1).issueCredential(
                    hre.ethers.ZeroAddress,
                    1,
                    hre.ethers.hexlify(hre.ethers.randomBytes(32))
                )
            ).to.be.revertedWith("Issuer: zero student address");
        });

        it("Reverts on empty (zero) commitment", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);

            await expect(
                issuer.connect(university1).issueCredential(
                    student.address,
                    1,
                    hre.ethers.ZeroHash
                )
            ).to.be.revertedWith("Issuer: empty commitment");
        });

        it("Reverts on inactive or non-existent schema", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);

            const commitment = makeCommitment(student.address, 999n, 110, 110, 1700000000, randomSalt());
            await expect(
                issuer.connect(university1).issueCredential(student.address, 999, commitment)
            ).to.be.revertedWith("Issuer: schema not active");
        });

        it("Reverts on duplicate commitment", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);

            const commitment = makeCommitment(student.address, 1n, 110, 110, 1700000000, randomSalt());
            await issuer.connect(university1).issueCredential(student.address, 1, commitment);

            await expect(
                issuer.connect(university1).issueCredential(student.address, 1, commitment)
            ).to.be.revertedWith("Issuer: commitment already used");
        });

        it("Marks commitment as used after issuance", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);

            const commitment = makeCommitment(student.address, 1n, 110, 110, 1700000000, randomSalt());
            await issuer.connect(university1).issueCredential(student.address, 1, commitment);

            expect(await issuer.commitmentUsed(commitment)).to.be.true;
        });

        it("Emits CredentialIssued event", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);

            const commitment = makeCommitment(student.address, 1n, 110, 110, 1700000000, randomSalt());
            await expect(
                issuer.connect(university1).issueCredential(student.address, 1, commitment)
            )
                .to.emit(issuer, "CredentialIssued")
                .withArgs(1n, university1.address, student.address, 1n, commitment, anyValue);
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  revokeCredential
    // ──────────────────────────────────────────────────────────────────────

    describe("revokeCredential", function () {
        async function issueOne(issuer: any, university1: any, student: any) {
            const commitment = makeCommitment(
                student.address, 1n, 110, 110, 1700000000, randomSalt()
            );
            await issuer.connect(university1).issueCredential(student.address, 1, commitment);
        }

        it("Issuing university can revoke a credential", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);
            await issueOne(issuer, university1, student);

            await issuer.connect(university1).revokeCredential(1);
            expect(await issuer.isRevoked(1)).to.be.true;
        });

        it("isCredentialValid returns false after revocation", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);
            await issueOne(issuer, university1, student);
            await issuer.connect(university1).revokeCredential(1);

            expect(await issuer.isCredentialValid(1)).to.be.false;
        });

        it("Non-issuing university cannot revoke", async function () {
            const { registry, issuer, university1, university2, student } =
                await loadFixture(deployIssuerFixture);

            await issueOne(issuer, university1, student);
            await registry.authorizeUniversity(university2.address, "UniMilano");

            await expect(
                issuer.connect(university2).revokeCredential(1)
            ).to.be.revertedWith("Issuer: only issuer can revoke");
        });

        it("Reverts on non-existent credential", async function () {
            const { issuer, university1 } = await loadFixture(deployIssuerFixture);

            await expect(
                issuer.connect(university1).revokeCredential(999)
            ).to.be.revertedWith("Issuer: credential does not exist");
        });

        it("Reverts on double revocation", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);
            await issueOne(issuer, university1, student);
            await issuer.connect(university1).revokeCredential(1);

            await expect(
                issuer.connect(university1).revokeCredential(1)
            ).to.be.revertedWith("Issuer: already revoked");
        });

        it("Emits CredentialRevoked event", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);
            await issueOne(issuer, university1, student);

            await expect(issuer.connect(university1).revokeCredential(1))
                .to.emit(issuer, "CredentialRevoked")
                .withArgs(1n, university1.address, anyValue);
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────────────────────────────

    describe("View functions", function () {
        it("getStudentCredentials returns correct IDs", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);

            const c1 = makeCommitment(student.address, 1n, 110, 110, 1700000001, randomSalt());
            const c2 = makeCommitment(student.address, 1n, 105, 110, 1700000002, randomSalt());
            await issuer.connect(university1).issueCredential(student.address, 1, c1);
            await issuer.connect(university1).issueCredential(student.address, 1, c2);

            const ids = await issuer.getStudentCredentials(student.address);
            expect(ids).to.deep.equal([1n, 2n]);
        });

        it("getIssuerCredentials returns correct IDs", async function () {
            const { issuer, university1, student } = await loadFixture(deployIssuerFixture);

            const c1 = makeCommitment(student.address, 1n, 110, 110, 1700000001, randomSalt());
            await issuer.connect(university1).issueCredential(student.address, 1, c1);

            const ids = await issuer.getIssuerCredentials(university1.address);
            expect(ids).to.deep.equal([1n]);
        });

        it("isCredentialValid returns false for non-existent ID", async function () {
            const { issuer } = await loadFixture(deployIssuerFixture);
            expect(await issuer.isCredentialValid(999)).to.be.false;
        });

        it("getCommitment returns bytes32(0) for unknown ID", async function () {
            const { issuer } = await loadFixture(deployIssuerFixture);
            expect(await issuer.getCommitment(999)).to.equal(hre.ethers.ZeroHash);
        });
    });
});

async function latestTimestamp(): Promise<number> {
    const block = await hre.ethers.provider.getBlock("latest");
    return block!.timestamp;
}
