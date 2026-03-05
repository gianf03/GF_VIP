import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

/**
 * Tests for CredentialSchema
 *
 * What we test:
 *  - Deployment: correct registry reference
 *  - createSchema: success, access control, empty-string validation
 *  - deactivateSchema: success, access control, double-deactivation
 *  - View functions: getSchema, isActiveSchema, getAllSchemaIds, totalSchemas
 */
describe("CredentialSchema", function () {
    // ──────────────────────────────────────────────────────────────────────
    //  Fixture
    // ──────────────────────────────────────────────────────────────────────

    async function deploySchemaFixture() {
        const [owner, university1, university2, stranger] =
            await hre.ethers.getSigners();

        const Registry = await hre.ethers.getContractFactory("UniversityRegistry");
        const registry = await Registry.deploy();

        const Schema = await hre.ethers.getContractFactory("CredentialSchema");
        const schema = await Schema.deploy(await registry.getAddress());

        // Authorize university1 for all tests that need it
        await registry.authorizeUniversity(university1.address, "UniRoma");

        return { registry, schema, owner, university1, university2, stranger };
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Deployment
    // ──────────────────────────────────────────────────────────────────────

    describe("Deployment", function () {
        it("Stores the correct registry address", async function () {
            const { schema, registry } = await loadFixture(deploySchemaFixture);
            expect(await schema.registry()).to.equal(await registry.getAddress());
        });

        it("Starts with zero schemas", async function () {
            const { schema } = await loadFixture(deploySchemaFixture);
            expect(await schema.totalSchemas()).to.equal(0);
        });

        it("Reverts with zero registry address", async function () {
            const Schema = await hre.ethers.getContractFactory("CredentialSchema");
            await expect(
                Schema.deploy(hre.ethers.ZeroAddress)
            ).to.be.revertedWith("Schema: zero registry address");
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  createSchema
    // ──────────────────────────────────────────────────────────────────────

    describe("createSchema", function () {
        it("Authorized university can create a schema", async function () {
            const { schema, university1 } = await loadFixture(deploySchemaFixture);

            await schema.connect(university1).createSchema(
                "Laurea Triennale in Informatica",
                "LT_INF"
            );

            expect(await schema.totalSchemas()).to.equal(1);
        });

        it("Returns incrementing IDs (1, 2, …)", async function () {
            const { schema, university1 } = await loadFixture(deploySchemaFixture);

            // Use staticCall to read the return value without sending a tx
            const id1 = await schema.connect(university1).createSchema.staticCall(
                "Schema One", "S1"
            );
            await schema.connect(university1).createSchema("Schema One", "S1");

            const id2 = await schema.connect(university1).createSchema.staticCall(
                "Schema Two", "S2"
            );

            expect(id1).to.equal(1n);
            expect(id2).to.equal(2n);
        });

        it("Stores schema data correctly", async function () {
            const { schema, university1 } = await loadFixture(deploySchemaFixture);

            await schema.connect(university1).createSchema("BSC Computer Science", "BSC_CS");
            const s = await schema.getSchema(1);

            expect(s.id).to.equal(1n);
            expect(s.name).to.equal("BSC Computer Science");
            expect(s.schemaCode).to.equal("BSC_CS");
            expect(s.creator).to.equal(university1.address);
            expect(s.isActive).to.be.true;
        });

        it("Unauthorized address cannot create schema", async function () {
            const { schema, stranger } = await loadFixture(deploySchemaFixture);

            await expect(
                schema.connect(stranger).createSchema("Fake Schema", "FAKE")
            ).to.be.revertedWith("Schema: caller is not an authorized university");
        });

        it("Reverted university loses access", async function () {
            const { registry, schema, university1 } =
                await loadFixture(deploySchemaFixture);

            // university1 starts authorized; revoke it
            await registry.revokeUniversity(university1.address);

            await expect(
                schema.connect(university1).createSchema("Revoked Schema", "REV")
            ).to.be.revertedWith("Schema: caller is not an authorized university");
        });

        it("Reverts on empty name", async function () {
            const { schema, university1 } = await loadFixture(deploySchemaFixture);

            await expect(
                schema.connect(university1).createSchema("", "CODE")
            ).to.be.revertedWith("Schema: name is empty");
        });

        it("Reverts on empty schemaCode", async function () {
            const { schema, university1 } = await loadFixture(deploySchemaFixture);

            await expect(
                schema.connect(university1).createSchema("Name", "")
            ).to.be.revertedWith("Schema: schemaCode is empty");
        });

        it("Emits SchemaCreated event with correct args", async function () {
            const { schema, university1 } = await loadFixture(deploySchemaFixture);

            await expect(
                schema.connect(university1).createSchema("BSC CS", "BSC_CS")
            )
                .to.emit(schema, "SchemaCreated")
                .withArgs(1n, "BSC CS", "BSC_CS", university1.address, anyValue);
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  deactivateSchema
    // ──────────────────────────────────────────────────────────────────────

    describe("deactivateSchema", function () {
        it("Authorized university can deactivate a schema", async function () {
            const { schema, university1 } = await loadFixture(deploySchemaFixture);

            await schema.connect(university1).createSchema("Old Schema", "OLD");
            await schema.connect(university1).deactivateSchema(1);

            expect(await schema.isActiveSchema(1)).to.be.false;
        });

        it("Reverts if schema is already inactive", async function () {
            const { schema, university1 } = await loadFixture(deploySchemaFixture);

            await schema.connect(university1).createSchema("Old Schema", "OLD");
            await schema.connect(university1).deactivateSchema(1);

            await expect(
                schema.connect(university1).deactivateSchema(1)
            ).to.be.revertedWith("Schema: already inactive or does not exist");
        });

        it("Reverts for non-existent schema ID", async function () {
            const { schema, university1 } = await loadFixture(deploySchemaFixture);

            await expect(
                schema.connect(university1).deactivateSchema(999)
            ).to.be.revertedWith("Schema: already inactive or does not exist");
        });

        it("Emits SchemaDeactivated event", async function () {
            const { schema, university1 } = await loadFixture(deploySchemaFixture);

            await schema.connect(university1).createSchema("Old Schema", "OLD");

            await expect(schema.connect(university1).deactivateSchema(1))
                .to.emit(schema, "SchemaDeactivated")
                .withArgs(1n, university1.address, anyValue);
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────────────────────────────

    describe("View functions", function () {
        it("isActiveSchema returns false for unknown ID", async function () {
            const { schema } = await loadFixture(deploySchemaFixture);
            expect(await schema.isActiveSchema(42)).to.be.false;
        });

        it("getAllSchemaIds returns all created IDs", async function () {
            const { schema, university1 } = await loadFixture(deploySchemaFixture);

            await schema.connect(university1).createSchema("S1", "S1");
            await schema.connect(university1).createSchema("S2", "S2");
            await schema.connect(university1).createSchema("S3", "S3");

            const ids = await schema.getAllSchemaIds();
            expect(ids).to.deep.equal([1n, 2n, 3n]);
        });
    });
});

async function latestTimestamp(): Promise<number> {
    const block = await hre.ethers.provider.getBlock("latest");
    return block!.timestamp;
}
