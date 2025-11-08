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
			await expect(helpers.expectTextContent(".helloworld", { contains: "Test HelloWorld Module" })).resolves.toBe(true);
		});
	});

	describe("helloworld default config text", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/helloworld/helloworld_default.js");
			await helpers.getDocument();
		});

		it("Test message helloworld module", async () => {
			await expect(helpers.expectTextContent(".helloworld", { contains: "Hello World!" })).resolves.toBe(true);
		});
	});
});
