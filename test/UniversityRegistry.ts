import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

/**
 * Tests for UniversityRegistry (Authority.sol)
 *
 * What we test:
 *  - Deployment: owner is set correctly
 *  - authorizeUniversity: success cases, access control, input validation
 *  - revokeUniversity: success cases, access control
 *  - Events: emitted with correct arguments
 *  - View functions: getUniversity, getAllUniversityAddresses, counters
 */
describe("UniversityRegistry", function () {
    // ──────────────────────────────────────────────────────────────────────
    //  Fixture: deploy a fresh registry before each test
    // ──────────────────────────────────────────────────────────────────────

    /**
     * A "fixture" is a setup function. Hardhat snapshots the blockchain state
     * after the fixture runs, then resets to that snapshot before each test.
     * This is much faster than redeploying from scratch each time.
     */
    async function deployRegistryFixture() {
        const [owner, university1, university2, stranger] =
            await hre.ethers.getSigners();

        const Registry = await hre.ethers.getContractFactory("UniversityRegistry");
        const registry = await Registry.deploy();

        return { registry, owner, university1, university2, stranger };
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Deployment
    // ──────────────────────────────────────────────────────────────────────

    describe("Deployment", function () {
        it("Should set the deployer as owner", async function () {
            const { registry, owner } = await loadFixture(deployRegistryFixture);
            expect(await registry.owner()).to.equal(owner.address);
        });

        it("Should start with zero active universities", async function () {
            const { registry } = await loadFixture(deployRegistryFixture);
            expect(await registry.activeUniversityCount()).to.equal(0);
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  authorizeUniversity
    // ──────────────────────────────────────────────────────────────────────

    describe("authorizeUniversity", function () {
        it("Owner can authorize a university", async function () {
            const { registry, university1 } = await loadFixture(deployRegistryFixture);

            await registry.authorizeUniversity(university1.address, "UniRoma");
            expect(await registry.isAuthorizedUniversity(university1.address)).to.be.true;
        });

        it("Increments activeUniversityCount", async function () {
            const { registry, university1, university2 } =
                await loadFixture(deployRegistryFixture);

            await registry.authorizeUniversity(university1.address, "UniRoma");
            await registry.authorizeUniversity(university2.address, "UniMilano");

            expect(await registry.activeUniversityCount()).to.equal(2);
        });

        it("Stores university metadata correctly", async function () {
            const { registry, university1 } = await loadFixture(deployRegistryFixture);

            await registry.authorizeUniversity(university1.address, "Università La Sapienza");
            const uni = await registry.getUniversity(university1.address);

            expect(uni.name).to.equal("Università La Sapienza");
            expect(uni.addr).to.equal(university1.address);
            expect(uni.isActive).to.be.true;
            expect(uni.authorizedAt).to.be.greaterThan(0);
        });

        it("Non-owner cannot authorize a university", async function () {
            const { registry, university1, stranger } =
                await loadFixture(deployRegistryFixture);

            await expect(
                registry.connect(stranger).authorizeUniversity(university1.address, "FakeUni")
            ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
        });

        it("Reverts on zero address", async function () {
            const { registry } = await loadFixture(deployRegistryFixture);

            await expect(
                registry.authorizeUniversity(hre.ethers.ZeroAddress, "BadUni")
            ).to.be.revertedWith("Registry: zero address");
        });

        it("Reverts if university is already authorized", async function () {
            const { registry, university1 } = await loadFixture(deployRegistryFixture);

            await registry.authorizeUniversity(university1.address, "UniRoma");
            await expect(
                registry.authorizeUniversity(university1.address, "UniRoma Again")
            ).to.be.revertedWith("Registry: already authorized");
        });

        it("Emits UniversityAuthorized event with correct args", async function () {
            const { registry, university1 } = await loadFixture(deployRegistryFixture);

            await expect(
                registry.authorizeUniversity(university1.address, "UniRoma")
            )
                .to.emit(registry, "UniversityAuthorized")
                .withArgs(university1.address, "UniRoma", anyValue);
        });

        it("Appends address to the list only once even after re-authorization", async function () {
            const { registry, university1 } = await loadFixture(deployRegistryFixture);

            // Authorize → revoke → re-authorize
            await registry.authorizeUniversity(university1.address, "UniRoma");
            await registry.revokeUniversity(university1.address);
            await registry.authorizeUniversity(university1.address, "UniRoma v2");

            const list = await registry.getAllUniversityAddresses();
            // The address should appear only once in the list
            expect(list.filter((a: string) => a === university1.address).length).to.equal(1);
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  revokeUniversity
    // ──────────────────────────────────────────────────────────────────────

    describe("revokeUniversity", function () {
        it("Owner can revoke an authorized university", async function () {
            const { registry, university1 } = await loadFixture(deployRegistryFixture);

            await registry.authorizeUniversity(university1.address, "UniRoma");
            await registry.revokeUniversity(university1.address);

            expect(await registry.isAuthorizedUniversity(university1.address)).to.be.false;
        });

        it("Decrements activeUniversityCount", async function () {
            const { registry, university1 } = await loadFixture(deployRegistryFixture);

            await registry.authorizeUniversity(university1.address, "UniRoma");
            await registry.revokeUniversity(university1.address);

            expect(await registry.activeUniversityCount()).to.equal(0);
        });

        it("Non-owner cannot revoke", async function () {
            const { registry, university1, stranger } =
                await loadFixture(deployRegistryFixture);

            await registry.authorizeUniversity(university1.address, "UniRoma");
            await expect(
                registry.connect(stranger).revokeUniversity(university1.address)
            ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
        });

        it("Reverts if university is not currently authorized", async function () {
            const { registry, university1 } = await loadFixture(deployRegistryFixture);

            await expect(
                registry.revokeUniversity(university1.address)
            ).to.be.revertedWith("Registry: not authorized");
        });

        it("Emits UniversityRevoked event", async function () {
            const { registry, university1 } = await loadFixture(deployRegistryFixture);

            await registry.authorizeUniversity(university1.address, "UniRoma");
            await expect(registry.revokeUniversity(university1.address))
                .to.emit(registry, "UniversityRevoked")
                .withArgs(university1.address, anyValue);
        });
    });

    // ──────────────────────────────────────────────────────────────────────
    //  View helpers
    // ──────────────────────────────────────────────────────────────────────

    describe("View functions", function () {
        it("getAllUniversityAddresses returns all registered addresses", async function () {
            const { registry, university1, university2 } =
                await loadFixture(deployRegistryFixture);

            await registry.authorizeUniversity(university1.address, "UniRoma");
            await registry.authorizeUniversity(university2.address, "UniMilano");

            const list = await registry.getAllUniversityAddresses();
            expect(list).to.deep.equal([university1.address, university2.address]);
        });

        it("totalRegisteredUniversities counts all (including revoked)", async function () {
            const { registry, university1, university2 } =
                await loadFixture(deployRegistryFixture);

            await registry.authorizeUniversity(university1.address, "UniRoma");
            await registry.authorizeUniversity(university2.address, "UniMilano");
            await registry.revokeUniversity(university1.address);

            // 2 total, even though 1 is revoked
            expect(await registry.totalRegisteredUniversities()).to.equal(2);
        });
    });
});

// ──────────────────────────────────────────────────────────────────────
//  Helper: get the latest block timestamp
// ──────────────────────────────────────────────────────────────────────

async function latestTimestamp(): Promise<number> {
    const block = await hre.ethers.provider.getBlock("latest");
    return block!.timestamp;
}
