const helpers = require("../helpers/global-setup");

describe("Test helloworld module", () => {
	afterAll(async () => {
		await helpers.stopApplication();
	});

	describe("helloworld set config text", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/helloworld/helloworld.js");
			await helpers.getDocument();
		});

		it("Test message helloworld module", async () => {
			const elem = await helpers.waitForElement(".helloworld");
			expect(elem).not.toBeNull();
			const text = await elem.textContent();
			expect(text).not.toBeNull();
			expect(text).toContain("Test HelloWorld Module");
		});
	});

	describe("helloworld default config text", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/helloworld/helloworld_default.js");
			await helpers.getDocument();
		});

		it("Test message helloworld module", async () => {
			const elem = await helpers.waitForElement(".helloworld");
			expect(elem).not.toBeNull();
			const text = await elem.textContent();
			expect(text).not.toBeNull();
			expect(text).toContain("Hello World!");
		});
	});
});
