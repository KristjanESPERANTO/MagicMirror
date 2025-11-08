const { expect } = require("playwright/test");
const helpers = require("../helpers/global-setup");

describe("Compliments module", () => {
	let page;

	/**
	 * move similar tests in function doTest
	 * @param {Array} complimentsArray The array of compliments.
	 * @returns {boolean} result
	 */
	const doTest = async (complimentsArray) => {
		await expect(page.locator(".compliments")).toBeVisible();
		const contentLocator = page.locator(".module-content");
		await contentLocator.waitFor({ state: "visible" });
		const content = await contentLocator.textContent();
		expect(complimentsArray).toContain(content);
		return true;
	};

	afterAll(async () => {
		await helpers.stopApplication();
	});

	describe("Feature anytime in compliments module", () => {
		describe("Set anytime and empty compliments for morning, evening and afternoon", () => {
			beforeAll(async () => {
				await helpers.startApplication("tests/configs/modules/compliments/compliments_anytime.js");
				await helpers.getDocument();
				page = helpers.getPage();
			});

			it("shows anytime because if configure empty parts of day compliments and set anytime compliments", async () => {
				await expect(doTest(["Anytime here"])).resolves.toBe(true);
			});
		});

		describe("Only anytime present in configuration compliments", () => {
			beforeAll(async () => {
				await helpers.startApplication("tests/configs/modules/compliments/compliments_only_anytime.js");
				await helpers.getDocument();
				page = helpers.getPage();
			});

			it("shows anytime compliments", async () => {
				await expect(doTest(["Anytime here"])).resolves.toBe(true);
			});
		});
	});

	describe("remoteFile option", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/compliments/compliments_remote.js");
			await helpers.getDocument();
			page = helpers.getPage();
		});

		it("should show compliments from a remote file", async () => {
			await expect(doTest(["Remote compliment file works!"])).resolves.toBe(true);
		});
	});

	describe("Feature specialDayUnique in compliments module", () => {
		describe("specialDayUnique is false", () => {
			beforeAll(async () => {
				await helpers.startApplication("tests/configs/modules/compliments/compliments_specialDayUnique_false.js");
				await helpers.getDocument();
				page = helpers.getPage();
			});

			it("compliments array can contain all values", async () => {
				await expect(doTest(["Special day message", "Typical message 1", "Typical message 2", "Typical message 3"])).resolves.toBe(true);
			});
		});

		describe("specialDayUnique is true", () => {
			beforeAll(async () => {
				await helpers.startApplication("tests/configs/modules/compliments/compliments_specialDayUnique_true.js");
				await helpers.getDocument();
				page = helpers.getPage();
			});

			it("compliments array contains only special value", async () => {
				await expect(doTest(["Special day message"])).resolves.toBe(true);
			});
		});

		describe("cron type key", () => {
			beforeAll(async () => {
				await helpers.startApplication("tests/configs/modules/compliments/compliments_e2e_cron_entry.js");
				await helpers.getDocument();
				page = helpers.getPage();
			});

			it("compliments array contains only special value", async () => {
				await expect(doTest(["anytime cron"])).resolves.toBe(true);
			});
		});
	});

	describe("Feature remote compliments file", () => {
		describe("get list from remote file", () => {
			beforeAll(async () => {
				await helpers.startApplication("tests/configs/modules/compliments/compliments_file.js");
				await helpers.getDocument();
				page = helpers.getPage();
			});
			it("shows 'Remote compliment file works!' as only anytime list set", async () => {
				//await helpers.startApplication("tests/configs/modules/compliments/compliments_file.js", "01 Jan 2022 10:00:00 GMT");
				await expect(doTest(["Remote compliment file works!"])).resolves.toBe(true);
			});
			//			afterAll(async () =>{
			//				await helpers.stopApplication()
			//			});
		});

		describe("get list from remote file w update", () => {
			beforeAll(async () => {
				await helpers.startApplication("tests/configs/modules/compliments/compliments_file_change.js");
				await helpers.getDocument();
				page = helpers.getPage();
			});
			it("shows 'test in morning' as test time set to 10am", async () => {
				//await helpers.startApplication("tests/configs/modules/compliments/compliments_file_change.js", "01 Jan 2022 10:00:00 GMT");
				await expect(doTest(["Remote compliment file works!"])).resolves.toBe(true);
				await new Promise((r) => setTimeout(r, 10000));
				await expect(doTest(["test in morning"])).resolves.toBe(true);
			});
			//			afterAll(async () =>{
			//				await helpers.stopApplication()
			//			});
		});
	});

});
