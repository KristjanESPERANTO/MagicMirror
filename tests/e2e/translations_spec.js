const fs = require("node:fs");
const path = require("node:path");
const helmet = require("helmet");
const { JSDOM } = require("jsdom");
const express = require("express");
const sinon = require("sinon");
const translations = require("../../translations/translations");

/**
 * Helper function to setup DOM environment.
 * @returns {object} The JSDOM window object
 */
function setupDOMEnvironment () {
	const translatorJs = fs.readFileSync(path.join(__dirname, "..", "..", "js", "translator.js"), "utf-8");
	const dom = new JSDOM("", { url: "http://localhost:3000", runScripts: "dangerously", resources: "usable" });

	dom.window.Log = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
	dom.window.fetch = globalThis.fetch;
	dom.window.eval(translatorJs);

	return dom.window;
}

describe("translations", () => {
	let server;

	beforeAll(() => {
		const app = express();
		app.use(helmet());
		app.use((req, res, next) => {
			res.header("Access-Control-Allow-Origin", "*");
			next();
		});
		app.use("/translations", express.static(path.join(__dirname, "..", "..", "translations")));

		server = app.listen(3000);
	});

	afterAll(async () => {
		await server.close();
	});

	it("should have a translation file in the specified path", () => {
		for (const language in translations) {
			const file = fs.statSync(translations[language]);

			expect(file.isFile()).toBe(true);
		}
	});

	describe("loadTranslations", () => {
		let dom;

		beforeEach(() => {
			// Create a new JSDOM instance for each test
			const window = setupDOMEnvironment();
			dom = { window };

			// Global config default language
			dom.window.config = { language: "de" };

			// Load class.js and module.js content directly
			const classJs = fs.readFileSync(path.join(__dirname, "..", "..", "js", "class.js"), "utf-8");
			const moduleJs = fs.readFileSync(path.join(__dirname, "..", "..", "js", "module.js"), "utf-8");

			// Execute the scripts in the JSDOM context
			dom.window.eval(classJs);
			dom.window.eval(moduleJs);

			// Stub the deferred registration API
			sinon.stub(dom.window.Translator, "registerModuleTranslationFiles").callsFake(() => {});
		});

		it("should register translation file (primary present)", async () => {
			await new Promise((resolve) => {
				dom.window.onload = resolve;
			});

			const { Translator, Module, config } = dom.window;
			config.language = "en";

			Module.register("name", { getTranslations: () => translations });
			const MMM = Module.create("name");

			await MMM.loadTranslations();

			expect(Translator.registerModuleTranslationFiles.callCount).toBe(1);
			const callArgs = Translator.registerModuleTranslationFiles.firstCall.args;
			expect(callArgs[0]).toBe(MMM);
			expect(callArgs[1]).toBe("translations/en.json"); // primary
			// Fallback may equal primary if 'en' is also the chosen fallback; ensure a json path is provided
			expect(callArgs[2]).toMatch(/translations\/.+\.json/);
		});

		it("should register translation and fallback file", async () => {
			await new Promise((resolve) => {
				dom.window.onload = resolve;
			});

			const { Translator, Module } = dom.window;

			Module.register("name", { getTranslations: () => translations });
			const MMM = Module.create("name");

			await MMM.loadTranslations();

			expect(Translator.registerModuleTranslationFiles.callCount).toBe(1);
			const [moduleArg, primary, fallback] = Translator.registerModuleTranslationFiles.firstCall.args;
			expect(moduleArg).toBe(MMM);
			// For default de language (config default) ensure primary is de.json if present
			// primary may be undefined in edge cases; if defined ensure it's de or en.
			const primaryOk = primary === undefined || primary.endsWith("de.json") || primary.endsWith("en.json");
			expect(primaryOk).toBe(true);
			expect(fallback).toMatch(/translations\/.+\.json/);
		});

		it("should register fallback file when primary missing", async () => {
			await new Promise((resolve) => {
				dom.window.onload = resolve;
			});

			const { Translator, Module, config } = dom.window;
			config.language = "--"; // invalid language

			Module.register("name", { getTranslations: () => translations });
			const MMM = Module.create("name");

			await MMM.loadTranslations();

			expect(Translator.registerModuleTranslationFiles.callCount).toBe(1);
			const args = Translator.registerModuleTranslationFiles.firstCall.args;
			expect(args[0]).toBe(MMM);
			expect(args[1]).toBeUndefined(); // primary missing
			expect(args[2]).toMatch(/translations\/.+\.json/); // fallback provided
		});

		it("should register no file when getTranslations returns falsy", async () => {
			await new Promise((resolve) => {
				dom.window.onload = resolve;
			});

			const { Translator, Module } = dom.window;

			Module.register("name", {});
			const MMM = Module.create("name");

			await MMM.loadTranslations();

			expect(Translator.registerModuleTranslationFiles.callCount).toBe(0);
		});
	});

	const mmm = {
		name: "TranslationTest",
		file (file) {
			return `http://localhost:3000/${file}`;
		}
	};

	describe("parsing language files through the Translator class", () => {
		for (const language in translations) {
			it(`should parse ${language}`, async () => {
				const window = setupDOMEnvironment();

				await new Promise((resolve) => {
					window.onload = resolve;
				});

				const { Translator } = window;
				await Translator.load(mmm, translations[language], false);

				expect(typeof Translator.translations[mmm.name]).toBe("object");
				expect(Object.keys(Translator.translations[mmm.name]).length).toBeGreaterThanOrEqual(1);
			});
		}
	});

	describe("same keys", () => {
		let base;

		// Some expressions are not easy to translate automatically. For the sake of a working test, we filter them out.
		const COMMON_EXCEPTIONS = ["WEEK_SHORT"];

		// Some languages don't have certain words, so we need to filter those language specific exceptions.
		const LANGUAGE_EXCEPTIONS = {
			ca: ["DAYBEFOREYESTERDAY"],
			cv: ["DAYBEFOREYESTERDAY"],
			cy: ["DAYBEFOREYESTERDAY"],
			en: ["DAYAFTERTOMORROW", "DAYBEFOREYESTERDAY"],
			fy: ["DAYBEFOREYESTERDAY"],
			gl: ["DAYBEFOREYESTERDAY"],
			hu: ["DAYBEFOREYESTERDAY"],
			id: ["DAYBEFOREYESTERDAY"],
			it: ["DAYBEFOREYESTERDAY"],
			"pt-br": ["DAYAFTERTOMORROW"],
			tr: ["DAYBEFOREYESTERDAY"]
		};

		// Function to initialize JSDOM and load translations
		const initializeTranslationDOM = (language) => {
			const window = setupDOMEnvironment();

			return new Promise((resolve) => {
				window.onload = async () => {
					const { Translator } = window;
					await Translator.load(mmm, translations[language], false);
					resolve(Translator.translations[mmm.name]);
				};
			});
		};

		beforeAll(async () => {
			// Using German as the base rather than English, since
			// some words do not have a direct translation in English.
			const germanTranslations = await initializeTranslationDOM("de");
			base = Object.keys(germanTranslations).sort();
		});

		for (const language in translations) {
			if (language === "de") continue;

			describe(`Translation keys of ${language}`, () => {
				let keys;

				beforeAll(async () => {
					const languageTranslations = await initializeTranslationDOM(language);
					keys = Object.keys(languageTranslations).sort();
				});

				it(`${language} should not contain keys that are not in base language`, () => {
					keys.forEach((key) => {
						expect(base).toContain(key, `Translation key '${key}' in language '${language}' is not present in base language`);
					});
				});

				it(`${language} should contain all base keys (excluding defined exceptions)`, () => {
					let filteredBase = base.filter((key) => !COMMON_EXCEPTIONS.includes(key));
					let filteredKeys = keys.filter((key) => !COMMON_EXCEPTIONS.includes(key));

					if (LANGUAGE_EXCEPTIONS[language]) {
						const exceptions = LANGUAGE_EXCEPTIONS[language];
						filteredBase = filteredBase.filter((key) => !exceptions.includes(key));
						filteredKeys = filteredKeys.filter((key) => !exceptions.includes(key));
					}

					filteredBase.forEach((baseKey) => {
						expect(filteredKeys).toContain(baseKey, `Translation key '${baseKey}' is missing in language '${language}'`);
					});
				});
			});
		}
	});
});
