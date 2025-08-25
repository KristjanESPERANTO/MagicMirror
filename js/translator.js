/* global translations */

const Translator = (function () {
	// Deferred module translation registry
	const moduleTranslationRegistry = {};

	/**
	 * Fetch and parse a JSON file.
	 * Always returns an object ({} on failure) to keep callers simple.
	 * @param {string} file Path or URL to JSON file.
	 * @returns {Promise<object>} Parsed object or empty object.
	 */
	async function fetchJSON (file) {
		if (!file || typeof file !== "string") return {};
		try {
			const res = await fetch(file, { cache: "no-store" });
			if (!res.ok) throw new Error(res.status);
			const data = await res.json().catch(() => ({}));
			return (data && typeof data === "object") ? data : {};
		} catch (e) {
			Log.warn(`Translator fetch failed for ${file}: ${e.message || e}`);
			return {};
		}
	}

	/**
	 * Normalize to absolute URL in browser (keeps absolute/input in Node).
	 * @param {string} inputPath Path or URL
	 * @returns {string} Absolute or original value
	 */
	function toAbs (inputPath) {
		if (typeof window === "undefined") return inputPath;
		if (!inputPath) return inputPath;
		// leave absolute URLs untouched
		if ((/^https?:\/\//i).test(inputPath)) return inputPath;
		// root-relative path
		if (inputPath.startsWith("/")) return `${window.location.origin}${inputPath}`;
		// relative -> origin + /p (squash duplicate slashes)
		return `${window.location.origin}/${inputPath}`.replace(/([^:]\/)\/+/g, "$1");
	}

	return {
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
			if (module?.name) {
				const reg = moduleTranslationRegistry[module.name];
				if (reg) {
					if (reg.primary && !reg.loadedPrimary) {
						reg.loadedPrimary = true;
						this.load(module, reg.primary, false).then(() => module.updateDom && module.updateDom(0));
					}
					if (reg.fallback && !reg.loadedFallback) {
						reg.loadedFallback = true;
						this.load(module, reg.fallback, true).then(() => module.updateDom && module.updateDom(0));
					}
				}
			}
			const render = (tpl) => {
				if (Object.prototype.toString.call(tpl) !== "[object String]") return tpl;
				let out = tpl;
				if (variables.fallback && !((/{.+}/).test(out))) out = variables.fallback; // treat as plain string if no placeholders
				return out.replace(/{([^}]+)}/g, (_, v) => (v in variables ? variables[v] : `{${v}}`));
			};
			const name = module?.name;
			const sources = [
				name && this.translations[name],
				this.coreTranslations,
				name && this.translationsFallback[name],
				this.coreTranslationsFallback
			];
			for (const dict of sources) {
				if (dict && key in dict) return render(dict[key]);
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
			Log.log(`${module.name} - Load translation${isFallback ? " fallback" : ""}: ${file}`);
			if (!file) return;
			if (isFallback && this.translationsFallback[module.name]) return;
			if (!isFallback && this.translationsFallback[module.name]) return;
			const resolved = ((/^https?:\/\//).test(file) || file.startsWith("/")) ? file : module.file(file);
			let json = await fetchJSON(resolved);
			if (json && Object.keys(json).length === 0) { // simple retry for transient empty
				const retry = await fetchJSON(resolved);
				if (retry && Object.keys(retry).length) json = retry;
			}
			this[isFallback ? "translationsFallback" : "translations"][module.name] = json;
		},

		/**
		 * Load the core translations.
		 * @param {string} lang The language identifier of the core language.
		 */
		async loadCoreTranslations (lang) {
			const primary = translations[lang] ? lang : null;
			let fallback = null;
			if (primary === "en") fallback = null; else if (translations.en) fallback = "en"; else {
				const first = Object.keys(translations)[0];
				if (first && first !== lang) fallback = first;
			}
			const primaryPath = primary ? translations[primary] : `translations/${lang}.json`;
			let loadedPrimary = await fetchJSON(toAbs(primaryPath));
			if (loadedPrimary && Object.keys(loadedPrimary).length === 0) {
				const retry = await fetchJSON(toAbs(primaryPath));
				if (retry && Object.keys(retry).length) loadedPrimary = retry;
			}
			if (loadedPrimary && Object.keys(loadedPrimary).length) this.coreTranslations = loadedPrimary;
			if (!fallback || fallback === primary) {
				this.coreTranslationsFallback = this.coreTranslations;
			} else {
				let loadedFallback = await fetchJSON(toAbs(translations[fallback]));
				if (loadedFallback && Object.keys(loadedFallback).length === 0) {
					const retryFb = await fetchJSON(toAbs(translations[fallback]));
					if (retryFb && Object.keys(retryFb).length) loadedFallback = retryFb;
				}
				if (loadedFallback && Object.keys(loadedFallback).length) this.coreTranslationsFallback = loadedFallback;
			}
		},

		/**
		 * Deterministic preparation step to ensure core translations are loaded before any module rendering.
		 * Subsequent calls reuse one promise.
		 * @param {string} lang Language code configured for MagicMirror.
		 * @returns {Promise<void>}
		 */
		prepare (lang) { return this._preparePromise || (this._preparePromise = this.loadCoreTranslations(lang)); },

		/**
		 * Register module translation files declared by module.js so we can lazy‑load them
		 * automatically on the first translate() call. Always active (no config flag).
		 * @param {Module} module Module instance.
		 * @param {string} primary Primary translation file (resolved path) relative to module path.
		 * @param {string} fallback Fallback translation file (resolved path) relative to module path.
		 */
		registerModuleTranslationFiles (module, primary, fallback) {
			moduleTranslationRegistry[module.name] = { primary, fallback, loadedPrimary: false, loadedFallback: false };
		}
	};
}());

window.Translator = Translator;
