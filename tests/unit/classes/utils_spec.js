const fs = require("node:fs");

const Log = require("../../../js/logger");
const { checkConfigFile, ConfigError, resolveModuleConfigs } = require("../../../js/utils");

const createConfigObject = (modules, configContentFull = "module.exports = { modules: [] };") => ({
	configFilename: "config.js",
	configContentFull,
	fullConf: { modules }
});

const runCheck = (modules, configContentFull) => {
	checkConfigFile(createConfigObject(modules, configContentFull));
};

const expectConfigErrorForModules = (modules) => {
	expect(() => {
		runCheck(modules);
	}).toThrow(ConfigError);
	expect(process.exit).not.toHaveBeenCalled();
};

describe("utils", () => {
	let originalReadFileSync;

	beforeEach(() => {
		originalReadFileSync = fs.readFileSync;

		vi.spyOn(fs, "readFileSync").mockImplementation((fileName, ...args) => {
			if (fileName === "index.html") {
				return "<div class=\"region top_bar\"></div>\n<div class=\"region lower_third\"></div>";
			}

			return originalReadFileSync.call(fs, fileName, ...args);
		});

		vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
		vi.spyOn(Log, "info").mockImplementation(() => {});
		vi.spyOn(Log, "warn").mockImplementation(() => {});
		vi.spyOn(Log, "error").mockImplementation(() => {});
		vi.spyOn(process, "exit").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("accepts valid module entries", () => {
		expect(() => {
			runCheck([
				{ module: "clock", position: "top_bar" },
				{ module: "newsfeed" }
			]);
		}).not.toThrow();
		expect(Log.error).not.toHaveBeenCalled();
	});

	it("throws when modules is not an array", () => {
		expectConfigErrorForModules("not-an-array");
		expect(Log.error).not.toHaveBeenCalled();
	});

	it("throws when module field is missing or not a string", () => {
		expectConfigErrorForModules([{ module: 123, position: "top_bar" }]);
		expect(Log.error).not.toHaveBeenCalled();
	});

	it("warns for unknown positions without exiting", () => {
		expect(() => {
			runCheck([{ module: "clock", position: "made_up_region" }]);
		}).not.toThrow();
		expect(process.exit).not.toHaveBeenCalled();
		expect(Log.warn).toHaveBeenCalled();
		expect(Log.warn.mock.calls[0][0]).toContain("uses unknown position");
	});

	it("throws syntax errors with their lint details", () => {
		expect(() => {
			runCheck([], "module.exports = { modules: [ };");
		}).toThrow(/Your configuration file contains syntax errors/);
		expect(process.exit).not.toHaveBeenCalled();
	});

	it("merges extracted module defaults on the server", () => {
		const originalRootPath = global.root_path;
		const originalDefaultModulesDir = global.defaultModulesDir;
		global.root_path = process.cwd();
		global.defaultModulesDir = "defaultmodules";

		try {
			const config = resolveModuleConfigs({
				modules: [
					{
						module: "updatenotification",
						configDeepMerge: true,
						config: {
							updateInterval: 1000,
							ignoreModules: ["MMM-Test"]
						}
					}
				]
			});

			expect(config.modules[0].config.updateInterval).toBe(1000);
			expect(config.modules[0].config.refreshInterval).toBe(24 * 60 * 60 * 1000);
			expect(config.modules[0].config.ignoreModules).toEqual(["MMM-Test"]);
			expect(config.modules[0].config.updates).toEqual([]);
		} finally {
			global.root_path = originalRootPath;
			global.defaultModulesDir = originalDefaultModulesDir;
		}
	});

	it("warns when a module has no server-side defaults", () => {
		global.root_path = process.cwd();
		global.defaultModulesDir = "defaultmodules";

		resolveModuleConfigs({ modules: [{ module: "not-migrated" }] });

		expect(Log.warn).toHaveBeenCalledWith("Module not-migrated does not load its configuration from the server. Extract its defaults to defaults.mjs.");
	});
});
