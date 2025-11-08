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
		const elem = await helpers.waitForElement("#module_1_helloworld .module-content");
		expect(elem).not.toBeNull();
		const text = await elem.textContent();
		expect(text).not.toBeNull();
		expect(text).toContain("MagicMirror²");
	});

	it("shows the project URL", async () => {
		const elem = await helpers.waitForElement("#module_5_helloworld .module-content");
		expect(elem).not.toBeNull();
		const text = await elem.textContent();
		expect(text).not.toBeNull();
		expect(text).toContain("https://magicmirror.builders/");
	});
});
