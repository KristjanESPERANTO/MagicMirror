import Module from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const loadCalendarNodeHelper = async () => {
	vi.resetModules();

	const loggerMock = {
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	};
	const fetcherInstances = [];
	const originalRequire = Module.prototype.require;

	Module.prototype.require = function (id) {
		if (id === "node_helper") {
			return {
				create: vi.fn((definition) => definition)
			};
		}

		if (id === "logger") {
			return loggerMock;
		}

		if (id === "./calendarfetcher") {
			return class MockCalendarFetcher {
				constructor (...args) {
					this.url = args[0];
					this.onReceive = vi.fn();
					this.onError = vi.fn();
					this.fetchCalendar = vi.fn();
					this.shouldRefetch = vi.fn(() => false);
					this.broadcastEvents = vi.fn();
					fetcherInstances.push(this);
				}
			};
		}

		return originalRequire.apply(this, arguments);
	};

	let helper;
	try {
		const helperModule = await import("../../../../../defaultmodules/calendar/node_helper");
		helper = helperModule.default || helperModule;
	} finally {
		Module.prototype.require = originalRequire;
	}

	helper.start();
	helper.sendSocketNotification = vi.fn();
	return { helper, fetcherInstances };
};

afterEach(() => {
	vi.resetAllMocks();
	vi.resetModules();
});

describe("calendar node_helper", () => {
	it("stores and fetches calendar fetchers by key", async () => {
		const { helper, fetcherInstances } = await loadCalendarNodeHelper();
		const url = "https://example.com/calendar.ics";
		const identifier = "__proto__";

		helper.createFetcher(url, 60000, [], 10, 365, null, false, false, identifier);

		expect(helper.fetchers).toBeInstanceOf(Map);
		expect(helper.fetchers.size).toBe(1);
		helper.socketNotificationReceived("FETCH_CALENDAR", { id: identifier, url });
		expect(fetcherInstances[0].fetchCalendar).toHaveBeenCalledTimes(2);
	});
});
