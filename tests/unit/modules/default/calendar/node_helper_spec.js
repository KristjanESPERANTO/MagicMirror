const fetchers = vi.hoisted(() => []);

vi.mock("node_helper", () => ({ default: { create: (definition) => definition } }));
vi.mock("logger", () => ({ default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../../defaultmodules/calendar/calendarfetcher.js", () => ({
	CalendarFetcher: class {
		constructor (url) {
			this.url = url;
			fetchers.push(this);
		}

		onReceive () {}

		onError (callback) {
			this.triggerError = (errorInfo) => callback(this, errorInfo);
		}

		fetchCalendar () {}
	}
}));

import helper from "../../../../../defaultmodules/calendar/node_helper.js";

describe("calendar node_helper", () => {
	const id = "calendar_1";
	const url = "https://example.com/calendar.ics";

	beforeEach(() => {
		fetchers.length = 0;
		helper.fetchers = {};
		helper.sendSocketNotification = vi.fn();
	});

	it("includes the calendar URL in fetch errors", () => {
		helper.createFetcher(url, 60000, [], 10, 365, null, false, false, id);
		fetchers[0].triggerError({ translationKey: "MODULE_ERROR_UNSPECIFIED" });

		expect(helper.sendSocketNotification).toHaveBeenCalledWith("CALENDAR_ERROR", {
			id,
			url,
			error_type: "MODULE_ERROR_UNSPECIFIED"
		});
	});

	it("includes the calendar ID and URL in malformed URL errors", () => {
		helper.createFetcher("not a url", 60000, [], 10, 365, null, false, false, id);

		expect(helper.sendSocketNotification).toHaveBeenCalledWith("CALENDAR_ERROR", {
			id,
			url: "not a url",
			error_type: "MODULE_ERROR_MALFORMED_URL"
		});
	});
});
