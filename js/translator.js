import "../translations/translations.js";

const getOwnPropertyDescriptor = (object, key) => {
	if (object === null || typeof object !== "object") {
		return undefined;
	}
	return Object.getOwnPropertyDescriptor(object, key);
};

/**
 * Load a JSON file via fetch.
 * @param {string} file Path of the file we want to load.
 * @returns {Promise<object>} the translations in the specified file
 */
const loadJSON = async (file) => {
	const baseHref = document.baseURI;
	const url = new URL(file, baseHref);

	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Unexpected response status: ${response.status}`);
		}
		return await response.json();
	} catch {
		Log.error(`Loading json file =${file} failed`);
		return null;
	}
};

export const Translator = {
	coreTranslations: {},
	coreTranslationsFallback: {},
	translations: {},
	translationsFallback: {},

	/**
	 * Load a translation for a given key for a given module.
	 * @param {Module} module The module to load the translation for.
	 * @param {string} key The key of the text to translate.
	 * @param {object} variables The variables to use within the translation template (optional)
	 * @returns {string} the translated key
	 */
	translate (module, key, variables = {}) {

		/**
		 * Combines template and variables like:
		 * template: "Please wait for {timeToWait} before continuing with {work}."
		 * variables: {timeToWait: "2 hours", work: "painting"}
		 * to: "Please wait for 2 hours before continuing with painting."
		 * @param {string} template Text with placeholder
		 * @param {object} variables Variables for the placeholder
		 * @returns {string} the template filled with the variables
		 */
		const createStringFromTemplate = (template, variables) => {
			if (Object.prototype.toString.call(template) !== "[object String]") {
				return template;
			}
			let templateToUse = template;
			const fallback = getOwnPropertyDescriptor(variables, "fallback")?.value;
			if (fallback && !template.match(new RegExp("{.+}"))) {
				templateToUse = fallback;
			}
			return templateToUse.replace(new RegExp("{([^}]+)}", "g"), (_unused, varName) => {
				const variable = getOwnPropertyDescriptor(variables, varName);
				return variable ? variable.value : `{${varName}}`;
			});
		};

		const translationSources = [
			getOwnPropertyDescriptor(this.translations, module.name)?.value,
			this.coreTranslations,
			getOwnPropertyDescriptor(this.translationsFallback, module.name)?.value,
			this.coreTranslationsFallback
		];
		for (const source of translationSources) {
			const translation = getOwnPropertyDescriptor(source, key);
			if (translation) {
				return createStringFromTemplate(translation.value, variables);
			}
		}

		return key;
	},

	/**
	 * Load a translation file (json) and remember the data.
	 * @param {Module} module The module to load the translation file for.
	 * @param {string} file Path of the file we want to load.
	 * @param {boolean} isFallback Flag to indicate fallback translations.
	 */
	async load (module, file, isFallback) {
		Log.log(`[translator] ${module.name} - Load translation${isFallback ? " fallback" : ""}: ${file}`);

		if (getOwnPropertyDescriptor(this.translationsFallback, module.name)) {
			return;
		}

		const json = await loadJSON(module.file(file));
		const translations = isFallback ? this.translationsFallback : this.translations;
		Object.defineProperty(translations, module.name, {
			configurable: true,
			enumerable: true,
			value: json,
			writable: true
		});
	},

	/**
	 * Load the core translations.
	 * @param {string} lang The language identifier of the core language.
	 */
	async loadCoreTranslations (lang) {
		const translationFile = getOwnPropertyDescriptor(globalThis.translations, lang)?.value;
		if (translationFile) {
			Log.log(`[translator] Loading core translation file: ${translationFile}`);
			this.coreTranslations = await loadJSON(translationFile);
		} else {
			Log.log("[translator] Configured language not found in core translations.");
		}

		await this.loadCoreTranslationsFallback();
	},

	/**
	 * Load the core translations' fallback.
	 * The first language defined in translations.js will be used.
	 */
	async loadCoreTranslationsFallback () {
		const first = Object.keys(globalThis.translations)[0];
		if (first) {
			const translationFile = getOwnPropertyDescriptor(globalThis.translations, first)?.value;
			Log.log(`[translator] Loading core translation fallback file: ${translationFile}`);
			this.coreTranslationsFallback = await loadJSON(translationFile);
		}
	}
};
