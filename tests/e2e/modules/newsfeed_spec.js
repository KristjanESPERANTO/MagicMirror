const fs = require("node:fs");
const helpers = require("../helpers/global-setup");

const runTests = async () => {
	describe("Default configuration", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/newsfeed/default.js");
			await helpers.getDocument();
		});

		it("should show the newsfeed title", async () => {
			await expect(helpers.expectTextContent(".newsfeed .newsfeed-source", { contains: "Rodrigo Ramirez Blog" })).resolves.toBe(true);
		});

		it("should show the newsfeed article", async () => {
			await expect(helpers.expectTextContent(".newsfeed .newsfeed-title", { contains: "QPanel" })).resolves.toBe(true);
		});

		it("should NOT show the newsfeed description", async () => {
			await helpers.waitForElement(".newsfeed");
			const elem = await helpers.querySelector(".newsfeed .newsfeed-desc");
			expect(elem).toBeNull();
		});
	});

	describe("Custom configuration", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/newsfeed/prohibited_words.js");
			await helpers.getDocument();
		});

		it("should not show articles with prohibited words", async () => {
			await expect(helpers.expectTextContent(".newsfeed .newsfeed-title", { contains: "Problema VirtualBox" })).resolves.toBe(true);
		});

		it("should show the newsfeed description", async () => {
			await expect(helpers.expectTextContent(".newsfeed .newsfeed-desc", { matches: /\S/ })).resolves.toBe(true);
		});
	});

	describe("Invalid configuration", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/newsfeed/incorrect_url.js");
			await helpers.getDocument();
		});

		it("should show malformed url warning", async () => {
			const elem = await helpers.waitForElement(".newsfeed .small", "No news at the moment.");
			expect(elem).not.toBeNull();
			await expect(helpers.expectTextContent(elem, { contains: "Error in the Newsfeed module. Malformed url." })).resolves.toBe(true);
		});
	});

	describe("Ignore items", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/newsfeed/ignore_items.js");
			await helpers.getDocument();
		});

		it("should show empty items info message", async () => {
			const elem = await helpers.waitForElement(".newsfeed .small");
			expect(elem).not.toBeNull();
			await expect(helpers.expectTextContent(elem, { contains: "No news at the moment." })).resolves.toBe(true);
		});
	});
};

describe("Newsfeed module", () => {
	afterAll(async () => {
		await helpers.stopApplication();
	});

	runTests();
});

describe("Newsfeed module located in config directory", () => {
	beforeAll(() => {
		fs.cpSync(`${global.root_path}/modules/default/newsfeed`, `${global.root_path}/config/newsfeed`, { recursive: true });
		process.env.MM_MODULES_DIR = "config";
	});

	afterAll(async () => {
		await helpers.stopApplication();
	});

	runTests();
});
