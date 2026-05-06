const { Readable } = require("node:stream");
const fs = require("node:fs");
const path = require("node:path");

const NewsfeedFetcher = require("../../../../../defaultmodules/newsfeed/newsfeedfetcher");

const xmlContent = fs.readFileSync(path.resolve(__dirname, "../../../../mocks/newsfeed_test.xml"));

/**
 * Emit a mock RSS response on the fetcher's internal HTTPFetcher instance and
 * wait for the items to be parsed. No real HTTP request is made.
 * @param {NewsfeedFetcher} fetcher - The fetcher instance to feed the response to.
 * @param {Buffer|string} [xml] - Optional XML content; defaults to the shared test fixture.
 * @returns {Promise<object[]>} Parsed items
 */
function feedRssResponse (fetcher, xml = xmlContent) {
	return new Promise((resolve) => {
		fetcher.onReceive(() => resolve(fetcher.items));
		fetcher.httpFetcher.emit("response", { body: Readable.from([xml]) });
	});
}

/**
 * Wrap minimal RSS XML around one or more <item> strings.
 * @param {string} itemsXml - One or more serialized RSS <item> elements.
 * @returns {string} A complete RSS 2.0 feed string.
 */
function rss (itemsXml) {
	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Test</title>${itemsXml}</channel></rss>`;
}

/**
 * Builds a minimal RSS <item> XML string with the given field values.
 * @param {object} [options] - Field values for the item.
 * @param {string} [options.title] - Item title.
 * @param {string} [options.link] - Item URL.
 * @param {string} [options.pubDate] - Publication date string.
 * @param {string} [options.description] - Item description.
 * @returns {string} Serialized RSS <item> element.
 */
function makeItem ({ title = "Test title", link = "https://example.com/article", pubDate = "Mon, 01 Jan 2024 12:00:00 +0000", description = "Test description" } = {}) {
	return `<item>
		<title>${title}</title>
		<link>${link}</link>
		<pubDate>${pubDate}</pubDate>
		<description>${description}</description>
	</item>`;
}

describe("NewsfeedFetcher", () => {
	describe("Feed parsing", () => {
		it("parses all items from the test fixture", async () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			const items = await feedRssResponse(fetcher);

			expect(items).toHaveLength(10);
		});

		it("parses title, url, pubdate and description from each item", async () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			const items = await feedRssResponse(fetcher);
			const item = items[0];

			expect(item.title).toBe("QPanel 0.13.0");
			expect(item.url).toBe("https://rodrigoramirez.com/qpanel-0-13-0/");
			expect(item.pubdate).toBe("Tue, 20 Sep 2016 11:16:08 +0000");
			expect(typeof item.description).toBe("string");
			expect(item.description.length).toBeGreaterThan(0);
		});

		it("strips HTML tags from description", async () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			const items = await feedRssResponse(fetcher);

			for (const item of items) {
				expect(item.description).not.toMatch(/<[^>]+>/);
			}
		});

		it("generates a stable sha256 hash for each item", async () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			const items = await feedRssResponse(fetcher);

			const hashes = items.map((i) => i.hash);
			const uniqueHashes = new Set(hashes);
			expect(uniqueHashes.size).toBe(items.length);
			for (const hash of hashes) {
				expect(hash).toMatch(/^[0-9a-f]{64}$/);
			}
		});

		it("discards items without a title", async () => {
			const xml = rss(makeItem({ title: "" }) + makeItem());
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			const items = await feedRssResponse(fetcher, xml);

			expect(items).toHaveLength(1);
		});

		it("discards items without a pubDate", async () => {
			const xml = rss(makeItem({ pubDate: "" }) + makeItem());
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			const items = await feedRssResponse(fetcher, xml);

			expect(items).toHaveLength(1);
		});

		it("calls onError callback when feed XML is malformed", async () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			const errorInfo = await new Promise((resolve) => {
				fetcher.onError((_f, info) => resolve(info));
				fetcher.httpFetcher.emit("response", { body: Readable.from(["this is not xml at all <<<"]) });
			});

			expect(errorInfo).toHaveProperty("errorType", "PARSE_ERROR");
		});

		it("calls onError callback when HTTP error is emitted", async () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			const errorInfo = await new Promise((resolve) => {
				fetcher.onError((_f, info) => resolve(info));
				fetcher.httpFetcher.emit("error", { message: "404", translationKey: "MODULE_ERROR_CLIENT_ERROR" });
			});

			expect(errorInfo).toHaveProperty("translationKey", "MODULE_ERROR_CLIENT_ERROR");
		});
	});

	describe("TTL handling", () => {
		it("increases reloadInterval when feed TTL is larger", async () => {
			const initialInterval = 60000;
			const ttlMinutes = 120;
			const xml = rss(`<ttl>${ttlMinutes}</ttl>${makeItem()}`);
			const fetcher = new NewsfeedFetcher("http://test.example/feed", initialInterval, "UTF-8", false, false);
			await feedRssResponse(fetcher, xml);

			expect(fetcher.httpFetcher.reloadInterval).toBe(ttlMinutes * 60 * 1000);
		});

		it("does not decrease reloadInterval when feed TTL is smaller", async () => {
			const initialInterval = 10 * 60 * 1000; // 10 min
			const ttlMinutes = 1; // 1 min — smaller
			const xml = rss(`<ttl>${ttlMinutes}</ttl>${makeItem()}`);
			const fetcher = new NewsfeedFetcher("http://test.example/feed", initialInterval, "UTF-8", false, false);
			await feedRssResponse(fetcher, xml);

			expect(fetcher.httpFetcher.reloadInterval).toBe(initialInterval);
		});

		it("caps TTL at 24 hours", async () => {
			const xml = rss(`<ttl>99999</ttl>${makeItem()}`);
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			await feedRssResponse(fetcher, xml);

			expect(fetcher.httpFetcher.reloadInterval).toBe(24 * 60 * 60 * 1000);
		});
	});

	describe("setReloadInterval", () => {
		it("decreases interval when new value is smaller", () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			fetcher.setReloadInterval(30000);

			expect(fetcher.httpFetcher.reloadInterval).toBe(30000);
		});

		it("does not increase interval", () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			fetcher.setReloadInterval(120000);

			expect(fetcher.httpFetcher.reloadInterval).toBe(60000);
		});

		it("ignores values below 1000 ms", () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			fetcher.setReloadInterval(500);

			expect(fetcher.httpFetcher.reloadInterval).toBe(60000);
		});
	});

	describe("useCorsProxy flag", () => {
		it("attaches useCorsProxy:true to all items", async () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, true);
			const items = await feedRssResponse(fetcher);

			expect(items.length).toBeGreaterThan(0);
			expect(items.every((item) => item.useCorsProxy === true)).toBe(true);
		});

		it("attaches useCorsProxy:false to all items", async () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, false);
			const items = await feedRssResponse(fetcher);

			expect(items.every((item) => item.useCorsProxy === false)).toBe(true);
		});

		it("item.url is a raw URL — /cors?url= prefix is never baked into the data", async () => {
			const fetcher = new NewsfeedFetcher("http://test.example/feed", 60000, "UTF-8", false, true);
			const items = await feedRssResponse(fetcher);

			for (const item of items) {
				expect(item.url).toMatch(/^https?:\/\//);
				expect(item.url).not.toContain("/cors?url=");
			}
		});
	});
});
