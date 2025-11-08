const helpers = require("./helpers/global-setup");

describe("Check configuration without modules", () => {
	beforeAll(async () => {
		await helpers.startApplication("tests/configs/without_modules.js");
		await helpers.getDocument();
	});
	afterAll(async () => {
		await helpers.stopApplication();
	});

	it("shows the message MagicMirror² title", async () => {
		await expect(
			helpers.expectTextContent("#module_1_helloworld .module-content", { contains: "MagicMirror²" })
		).resolves.toBe(true);
	});

	it("shows the project URL", async () => {
		await expect(
			helpers.expectTextContent("#module_5_helloworld .module-content", { contains: "https://magicmirror.builders/" })
		).resolves.toBe(true);
	});
});
