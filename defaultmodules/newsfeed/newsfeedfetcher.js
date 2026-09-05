const stream = require("node:stream");
const FeedParser = require("feedparser");
const iconv = require("iconv-lite");
const Log = require("logger");
const { SAFE_HTML_TAGS, normalizeFeedItem, readFeedTtl } = require("./feeditem");
const HTTPFetcher = require("#http_fetcher");

/**
 * NewsfeedFetcher - Fetches and parses RSS/Atom feed data
 * Uses HTTPFetcher for HTTP handling with intelligent error handling
 * @class
 */
class NewsfeedFetcher {

	/**
	 * Creates a new NewsfeedFetcher instance
	 * @param {string} url - The URL of the news feed to fetch
	 * @param {number} reloadInterval - Time in ms between fetches
	 * @param {string} encoding - Encoding of the feed (e.g., 'UTF-8')
	 * @param {boolean} logFeedWarnings - If true log warnings when there is an error parsing a news article
	 * @param {boolean} useCorsProxy - If true cors proxy is used for article url's
	 * @param {string[]} allowedBasicHtmlTags - Basic formatting tags to keep in title and description. Only tags from the safe list are honored; anything else is ignored.
	 */
	constructor (url, reloadInterval, encoding, logFeedWarnings, useCorsProxy, allowedBasicHtmlTags = []) {
		this.url = url;
		this.encoding = encoding;
		this.logFeedWarnings = logFeedWarnings;
		this.useCorsProxy = useCorsProxy;

		// Keep only tags from the hardcoded safe list; warn about (and ignore) anything else.
		const requestedTags = (Array.isArray(allowedBasicHtmlTags) ? allowedBasicHtmlTags : []).map((tag) => String(tag).trim().toLowerCase());
		this.allowedBasicHtmlTags = requestedTags.filter((tag) => SAFE_HTML_TAGS.includes(tag));
		const ignoredTags = requestedTags.filter((tag) => !SAFE_HTML_TAGS.includes(tag));
		if (ignoredTags.length > 0) {
			Log.warn(`Ignoring unsupported allowedBasicHtmlTags [${ignoredTags.join(", ")}] for url ${url}. Allowed tags are: ${SAFE_HTML_TAGS.join(", ")}`);
		}

		this.items = [];
		this.fetchFailedCallback = () => {};
		this.itemsReceivedCallback = () => {};

		// Use HTTPFetcher for HTTP handling (Composition)
		this.httpFetcher = new HTTPFetcher(url, {
			reloadInterval: Math.max(reloadInterval, 1000),
			headers: {
				"Cache-Control": "max-age=0, no-cache, no-store, must-revalidate",
				Pragma: "no-cache"
			}
		});

		// Wire up HTTPFetcher events
		this.httpFetcher.on("response", (response) => void this.#handleResponse(response));
		this.httpFetcher.on("error", (errorInfo) => this.fetchFailedCallback(this, errorInfo));
	}

	/**
	 * Creates a structured parse error for failed feed processing.
	 * @param {string} message - Error message
	 * @param {Error} error - Original error
	 * @returns {object} Error info object
	 */
	#createParseError (message, error) {
		return {
			message,
			status: null,
			errorType: "PARSE_ERROR",
			translationKey: "MODULE_ERROR_UNSPECIFIED",
			retryAfter: this.httpFetcher.reloadInterval,
			retryCount: 0,
			url: this.url,
			originalError: error
		};
	}

	/**
	 * Applies a feed-level TTL to the fetcher reload interval when the feed requests a larger cadence.
	 * @param {number|null} ttlMinutes TTL in minutes, or null when not present.
	 */
	#applyTtl (ttlMinutes) {
		if (ttlMinutes === null) {
			return;
		}

		const ttlms = Math.min(ttlMinutes * 60 * 1000, 86400000);
		if (ttlms > this.httpFetcher.reloadInterval) {
			this.httpFetcher.reloadInterval = ttlms;
			Log.info(`reloadInterval set to ttl=${ttlms} for url ${this.url}`);
		}
	}

	/**
	 * Parses the response stream, converts feed items into the module contract, and broadcasts them.
	 * @param {Response} response - The fetch Response object
	 */
	async #handleResponse (response) {
		// 304 Not Modified has no body: keep previously fetched items and re-broadcast them.
		if (response.status === 304) {
			this.broadcastItems();
			return;
		}

		this.items = [];

		try {
			const nodeStream = response.body instanceof stream.Readable
				? response.body
				: stream.Readable.fromWeb(response.body);

			const parser = new FeedParser({
				feedurl: this.url,
				normalize: false,
				addmeta: true,
				guidlink: true,
				resume_saxerror: true
			});

			const parsedItems = [];
			let parseError = null;
			const feedDone = new Promise((resolve) => {
				parser.on("readable", () => {
					let item;
					while ((item = parser.read()) !== null) {
						parsedItems.push(item);
					}
				});
				parser.on("error", (error) => {
					parseError = error;
				});
				parser.on("end", resolve);
			});

			await stream.promises.pipeline(nodeStream, iconv.decodeStream(this.encoding), parser);
			await feedDone;
			if (parseError) {
				throw parseError;
			}

			const ttlMinutes = readFeedTtl(parser.meta);
			for (const item of parsedItems) {
				const normalizedItem = normalizeFeedItem(item, this.allowedBasicHtmlTags, this.useCorsProxy);
				if (!normalizedItem) {
					if (this.logFeedWarnings) {
						Log.warn("Can't parse feed item:", item);
					}
					continue;
				}
				this.items.push(normalizedItem);
			}

			this.#applyTtl(ttlMinutes);
			this.broadcastItems();
		} catch (error) {
			Log.error(`${this.url} - Stream processing failed: ${error.message}`);
			this.fetchFailedCallback(this, this.#createParseError(`Stream processing failed: ${error.message}`, error));
		}
	}

	/**
	 * Updates the reload interval only when the new value is lower and therefore more aggressive.
	 * @param {number} interval - Interval in milliseconds.
	 */
	setReloadInterval (interval) {
		if (interval > 1000 && interval < this.httpFetcher.reloadInterval) {
			this.httpFetcher.reloadInterval = interval;
		}
	}

	startFetch () {
		this.httpFetcher.startPeriodicFetch();
	}

	broadcastItems () {
		if (this.items.length <= 0) {
			Log.info("No items to broadcast yet.");
			return;
		}
		Log.info(`Broadcasting ${this.items.length} items.`);
		this.itemsReceivedCallback(this);
	}

	/** @param {function(NewsfeedFetcher): void} callback - Called when items are received */
	onReceive (callback) {
		this.itemsReceivedCallback = callback;
	}

	/** @param {function(NewsfeedFetcher, object): void} callback - Called on fetch error */
	onError (callback) {
		this.fetchFailedCallback = callback;
	}
}

module.exports = NewsfeedFetcher;
