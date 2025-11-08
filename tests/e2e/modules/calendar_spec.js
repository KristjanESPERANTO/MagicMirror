const helpers = require("../helpers/global-setup");
const serverBasicAuth = require("../helpers/basic-auth");

const getPage = () => helpers.getPage();

describe("Calendar module", () => {

	/**
	 * Assert the number of matching elements.
	 * @param {string} selector css selector
	 * @param {number} expectedLength expected number of elements
	 * @param {string} [not] optional negation marker (use "not" to negate)
	 * @returns {Promise<boolean>} assertion outcome
	 */
	const testElementLength = async (selector, expectedLength, not) => {
		const locator = getPage().locator(selector);
		if (expectedLength === 0 && not !== "not") {
			const count = await locator.count();
			expect(count).toBe(0);
			return true;
		}

		await locator.first().waitFor({ state: "attached" });
		const count = await locator.count();
		if (not === "not") {
			expect(count).not.toBe(expectedLength);
		} else {
			expect(count).toBe(expectedLength);
		}
		return true;
	};

	const testTextContain = async (element, text) => {
		const locator = await helpers.waitForElement(element, "undefinedLoading");
		await helpers.expectTextContent(locator, { contains: text });
		return true;
	};

	afterAll(async () => {
		await helpers.stopApplication();
	});

	describe("Default configuration", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/calendar/default.js");
			await helpers.getDocument();
		});

		it("should show the default maximumEntries of 10", async () => {
			await expect(testElementLength(".calendar .event", 10)).resolves.toBe(true);
		});

		it("should show the default calendar symbol in each event", async () => {
			await expect(testElementLength(".calendar .event .fa-calendar-days", 0, "not")).resolves.toBe(true);
		});
	});

	describe("Custom configuration", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/calendar/custom.js");
			await helpers.getDocument();
		});

		it("should show the custom maximumEntries of 5", async () => {
			await expect(testElementLength(".calendar .event", 5)).resolves.toBe(true);
		});

		it("should show the custom calendar symbol in four events", async () => {
			await expect(testElementLength(".calendar .event .fa-birthday-cake", 4)).resolves.toBe(true);
		});

		it("should show a customEvent calendar symbol in one event", async () => {
			await expect(testElementLength(".calendar .event .fa-dice", 1)).resolves.toBe(true);
		});

		it("should show a customEvent calendar eventClass in one event", async () => {
			await expect(testElementLength(".calendar .event.undo", 1)).resolves.toBe(true);
		});

		it("should show two custom icons for repeating events", async () => {
			await expect(testElementLength(".calendar .event .fa-undo", 2)).resolves.toBe(true);
		});

		it("should show two custom icons for day events", async () => {
			await expect(testElementLength(".calendar .event .fa-calendar-day", 2)).resolves.toBe(true);
		});
	});

	describe("Recurring event", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/calendar/recurring.js");
			await helpers.getDocument();
		});

		it("should show the recurring birthday event 6 times", async () => {
			await expect(testElementLength(".calendar .event", 6)).resolves.toBe(true);
		});
	});

	//Will contain everyday an fullDayEvent that starts today and ends tomorrow, and one starting tomorrow and ending the day after tomorrow
	describe("FullDayEvent over several days should show how many days are left from the from the starting date on", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/calendar/long-fullday-event.js");
			await helpers.getDocument();
		});

		it("should contain text 'Ends in' with the left days", async () => {
			await expect(testTextContain(".calendar .today .time", "Ends in")).resolves.toBe(true);
			await expect(testTextContain(".calendar .yesterday .time", "Today")).resolves.toBe(true);
			await expect(testTextContain(".calendar .tomorrow .time", "Tomorrow")).resolves.toBe(true);
		});
		it("should contain in total three events", async () => {
			await expect(testElementLength(".calendar .event", 3)).resolves.toBe(true);
		});
	});

	describe("FullDayEvent Single day, should show Today", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/calendar/single-fullday-event.js");
			await helpers.getDocument();
		});

		it("should contain text 'Today'", async () => {
			await expect(testTextContain(".calendar .time", "Today")).resolves.toBe(true);
		});
		it("should contain in total two events", async () => {
			await expect(testElementLength(".calendar .event", 2)).resolves.toBe(true);
		});
	});

	describe("Changed port", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/calendar/changed-port.js");
			serverBasicAuth.listen(8010);
			await helpers.getDocument();
		});

		afterAll(async () => {
			await serverBasicAuth.close();
		});

		it("should return TestEvents", async () => {
			await expect(testElementLength(".calendar .event", 0, "not")).resolves.toBe(true);
		});
	});

	describe("Basic auth", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/calendar/basic-auth.js");
			await helpers.getDocument();
		});

		it("should return TestEvents", async () => {
			await expect(testElementLength(".calendar .event", 0, "not")).resolves.toBe(true);
		});
	});

	describe("Basic auth by default", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/calendar/auth-default.js");
			await helpers.getDocument();
		});

		it("should return TestEvents", async () => {
			await expect(testElementLength(".calendar .event", 0, "not")).resolves.toBe(true);
		});
	});

	describe("Basic auth backward compatibility configuration: DEPRECATED", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/calendar/old-basic-auth.js");
			await helpers.getDocument();
		});

		it("should return TestEvents", async () => {
			await expect(testElementLength(".calendar .event", 0, "not")).resolves.toBe(true);
		});
	});

	describe("Fail Basic auth", () => {
		beforeAll(async () => {
			await helpers.startApplication("tests/configs/modules/calendar/fail-basic-auth.js");
			serverBasicAuth.listen(8020);
			await helpers.getDocument();
		});

		afterAll(async () => {
			await serverBasicAuth.close();
		});

		it("should show Unauthorized error", async () => {
			await expect(testTextContain(".calendar", "Error in the calendar module. Authorization failed")).resolves.toBe(true);
		});
	});
});
