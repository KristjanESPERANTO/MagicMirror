const dns = require("node:dns");
const ipaddr = require("ipaddr.js");
const undici = require("undici");
const NodeHelper = require("node_helper");
const Log = require("logger");
const NewsfeedFetcher = require("./newsfeedfetcher");

module.exports = NodeHelper.create({
	// Override start method.
	start () {
		Log.log(`Starting node helper for: ${this.name}`);
		this.fetchers = [];
	},

	// Override socketNotificationReceived received.
	socketNotificationReceived (notification, payload) {
		if (notification === "ADD_FEED") {
			this.createFetcher(payload.feed, payload.config);
		} else if (notification === "CHECK_ARTICLE_URL") {
			this.checkArticleUrl(payload.url);
		}
	},

	/**
	 * Checks whether a URL can be displayed in an iframe by inspecting
	 * X-Frame-Options and Content-Security-Policy headers server-side.
	 * @param {string} url The article URL to check.
	 * @returns {null} sendSocketNotification
	 */
	async checkArticleUrl (url) {
		try {
			// 1. Parse URL
			let parsed;
			try {
				parsed = new URL(url);
			} catch {
				return this.sendSocketNotification("ARTICLE_URL_STATUS", { url, canFrame: false });
			}

			// 2. Protocol validation
			if (!["http:", "https:"].includes(parsed.protocol)) {
				return this.sendSocketNotification("ARTICLE_URL_STATUS", { url, canFrame: false });
			}

			// 3. Block localhost hostname
			if (parsed.hostname.toLowerCase() === "localhost") {
				return this.sendSocketNotification("ARTICLE_URL_STATUS", { url, canFrame: false });
			}

			// 4. DNS lookup + IP range validation
			const { address, family } = await dns.promises.lookup(parsed.hostname);
			if (ipaddr.process(address).range() !== "unicast") {
				Log.warn(`SSRF blocked in checkArticleUrl: ${url}`);
				return this.sendSocketNotification("ARTICLE_URL_STATUS", { url, canFrame: false });
			}

			// 5. Pin IP to prevent DNS rebinding
			const dispatcher = new undici.Agent({
				connect: {
					lookup: (_h, _o, cb) => {
						process.nextTick(() => cb(null, [{ address, family }]));
					}
				}
			});

			// 6. Make request with pinned IP
			const response = await undici.fetch(url, { dispatcher, method: "HEAD" });
			const xfo = response.headers.get("x-frame-options");
			const csp = response.headers.get("content-security-policy");
			const blockedByXFO = xfo && ["deny", "sameorigin"].includes(xfo.toLowerCase().trim());
			const blockedByCSP = csp && (/frame-ancestors\s+['"]?none['"]?/).test(csp);

			this.sendSocketNotification("ARTICLE_URL_STATUS", { url, canFrame: !blockedByXFO && !blockedByCSP });
		} catch {
			this.sendSocketNotification("ARTICLE_URL_STATUS", { url, canFrame: true });
		}
	},

	/**
	 * Validates a configured feed URL before creating or reusing a fetcher.
	 * @param {string} url The feed URL to validate.
	 * @returns {boolean} True when the URL is valid.
	 */
	validateFeedUrl (url) {
		try {
			new URL(url);
			return true;
		} catch (error) {
			Log.error("Error: Malformed newsfeed url: ", url, error);
			this.sendSocketNotification("NEWSFEED_ERROR", { error_type: "MODULE_ERROR_MALFORMED_URL" });
			return false;
		}
	},

	/**
	 * Binds the fetcher lifecycle callbacks used by the node helper.
	 * @param {NewsfeedFetcher} fetcher The fetcher instance.
	 */
	bindFetcherEvents (fetcher) {
		fetcher.onReceive(() => {
			this.broadcastFeeds();
		});

		fetcher.onError((fetcher, errorInfo) => {
			Log.error("Error: Could not fetch newsfeed: ", fetcher.url, errorInfo.message || errorInfo);
			this.sendSocketNotification("NEWSFEED_ERROR", {
				error_type: errorInfo.translationKey
			});
		});
	},

	/**
	 * Ensures one fetcher exists per feed URL and reuses it when already registered.
	 * @param {string} url The feed URL.
	 * @param {number} reloadInterval The current reload interval.
	 * @param {string} encoding Feed encoding.
	 * @param {object} config The module configuration.
	 * @param {boolean} useCorsProxy Whether article URLs should be proxied.
	 * @returns {NewsfeedFetcher} The active fetcher instance.
	 */
	ensureFetcher (url, reloadInterval, encoding, config, useCorsProxy) {
		if (typeof this.fetchers[url] === "undefined") {
			Log.log(`Create new newsfetcher for url: ${url} - Interval: ${reloadInterval}`);
			const fetcher = new NewsfeedFetcher(url, reloadInterval, encoding, config.logFeedWarnings, useCorsProxy, config.allowedBasicHtmlTags);
			this.bindFetcherEvents(fetcher);
			this.fetchers[url] = fetcher;
			return fetcher;
		}

		Log.log(`Use existing newsfetcher for url: ${url}`);
		const fetcher = this.fetchers[url];
		fetcher.setReloadInterval(reloadInterval);
		fetcher.broadcastItems();
		return fetcher;
	},

	createFetcher (feed, config) {
		const url = feed.url || "";
		const encoding = feed.encoding || "UTF-8";
		const reloadInterval = feed.reloadInterval || config.reloadInterval || 5 * 60 * 1000;
		const useCorsProxy = feed.useCorsProxy ?? true;

		if (!this.validateFeedUrl(url)) {
			return;
		}

		const fetcher = this.ensureFetcher(url, reloadInterval, encoding, config, useCorsProxy);
		fetcher.startFetch();
	},

	/**
	 * Aggregates all current feed items from the registered fetchers and sends them to the client.
	 */
	broadcastFeeds () {
		const feeds = {};
		for (const url in this.fetchers) {
			feeds[url] = this.fetchers[url].items;
		}
		this.sendSocketNotification("NEWS_ITEMS", feeds);
	}
});
