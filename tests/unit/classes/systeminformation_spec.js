const { default: SystemInformation } = await import("../../../js/systeminformation.mjs"); // eslint-disable-line import-x/extensions -- ESM file requires the extension

describe("SystemInformation", () => {
	it("should output system information", async () => {
		await expect(SystemInformation()).resolves.toContain("platform: linux");
	});
});
