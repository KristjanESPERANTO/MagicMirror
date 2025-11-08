const helpers = require("../helpers/global-setup");

describe("Clock set to german language module", () => {
	afterAll(async () => {
		await helpers.stopApplication();
	});

	describe("with showWeek config enabled", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/clock/de/clock_showWeek.js");
			await helpers.getDocument();
		});

		it("shows week with correct format", async () => {
			const weekRegex = /^[0-9]{1,2}. Kalenderwoche$/;
			const elem = await helpers.waitForElement(".clock .week");
			expect(elem).not.toBeNull();
			const text = await elem.textContent();
			expect(text).not.toBeNull();
			expect(text).toMatch(weekRegex);
		});
	});

	describe("with showWeek short config enabled", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/clock/de/clock_showWeek_short.js");
			await helpers.getDocument();
		});

		it("shows week with correct format", async () => {
			const weekRegex = /^[0-9]{1,2}KW$/;
			const elem = await helpers.waitForElement(".clock .week");
			expect(elem).not.toBeNull();
			const text = await elem.textContent();
			expect(text).not.toBeNull();
			expect(text).toMatch(weekRegex);
		});
	});
});
