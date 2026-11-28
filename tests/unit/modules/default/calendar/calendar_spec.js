import moment from "moment-timezone";
import CalendarUtils from "../../../../../defaultmodules/calendar/calendarutils.mjs";

const createElement = () => ({ style: {}, children: [], classList: { add () {} }, appendChild (child) { this.children.push(child); } });

describe("calendar module", () => {
	let calendar;

	const receive = (notification, payload) => calendar.socketNotificationReceived(notification, { id: calendar.identifier, ...payload });
	const futureEvent = { title: "Event", startDate: String(moment().add(2, "hours").valueOf()), endDate: String(moment().add(3, "hours").valueOf()) };
	const lastRowText = (dom) => dom.children.at(-1).children[0].innerHTML;

	beforeEach(async () => {
		vi.resetModules();
		globalThis.moment = moment;
		globalThis.CalendarUtils = CalendarUtils;
		globalThis.config = { language: "en", timeFormat: 24 };
		globalThis.Log = { info: vi.fn(), debug: vi.fn() };
		globalThis.document = { createElement };
		globalThis.Module = { register: (name, definition) => { calendar = definition; } };

		await import("../../../../../defaultmodules/calendar/calendar.js");

		Object.assign(calendar, {
			name: "calendar",
			identifier: "calendar_1",
			config: { ...calendar.defaults, calendars: [] },
			sendNotification: vi.fn(),
			updateDom: vi.fn(),
			translate: (key) => key,
			selfUpdate: vi.fn()
		});
		calendar.start();
	});

	afterEach(() => {
		for (const name of ["moment", "CalendarUtils", "config", "Log", "document", "Module"]) {
			delete globalThis[name];
		}
	});

	it("shows events and a warning when another calendar fails", () => {
		receive("CALENDAR_ERROR", { url: "https://failing.example.com", error_type: "MODULE_ERROR_UNSPECIFIED" });
		receive("CALENDAR_EVENTS", { url: "https://working.example.com", events: [futureEvent], checksum: 1 });

		const dom = calendar.getDom();
		expect(dom.children).toHaveLength(2);
		expect(lastRowText(dom)).toBe("MODULE_CONFIG_ERROR");
	});

	it("shows the warning when there are no events", () => {
		receive("CALENDAR_ERROR", { url: "https://failing.example.com", error_type: "MODULE_ERROR_UNSPECIFIED" });

		const dom = calendar.getDom();
		expect(dom.children).toHaveLength(1);
		expect(lastRowText(dom)).toBe("MODULE_CONFIG_ERROR");
	});

	it("removes the warning when the failing calendar recovers", () => {
		const url = "https://failing.example.com";
		receive("CALENDAR_ERROR", { url, error_type: "MODULE_ERROR_UNSPECIFIED" });
		receive("CALENDAR_EVENTS", { url, events: [futureEvent], checksum: 1 });

		expect(calendar.getDom().children).toHaveLength(1);
	});
});
