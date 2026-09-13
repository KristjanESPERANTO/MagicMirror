const defaults = require("../../../../../js/defaults");

const NewsfeedFetcher = require(`../../../../../${defaults.defaultModulesDir}/newsfeed/newsfeedfetcher`);

// The full safe list users may opt into; most tests run with it enabled.
const ALL_TAGS = ["b", "strong", "i", "em", "u", "br", "code", "s", "sub", "sup"];
const sanitize = (html, allowedTags = ALL_TAGS) => NewsfeedFetcher.sanitizeBasicHtml(html, allowedTags);

describe("NewsfeedFetcher.sanitizeBasicHtml", () => {
	it("keeps real basic formatting tags", () => {
		expect(sanitize("<b>a</b> <strong>b</strong> <i>c</i> <em>d</em> <u>e</u>"))
			.toBe("<b>a</b> <strong>b</strong> <i>c</i> <em>d</em> <u>e</u>");
	});

	it("keeps the additional safe tags (code, s, sub, sup)", () => {
		expect(sanitize("<code>x</code> <s>y</s> <sub>z</sub> <sup>w</sup>"))
			.toBe("<code>x</code> <s>y</s> <sub>z</sub> <sup>w</sup>");
	});

	it("renders entity-encoded formatting tags (e.g. The Atlantic feed)", () => {
		// Feeds like theatlantic.com ship emphasis as escaped entities
		expect(sanitize("the &lt;em&gt;Atlantic&lt;/em&gt; ocean")).toBe("the <em>Atlantic</em> ocean");
	});

	it("handles emphasis inside titles regardless of how the parser delivers it", () => {
		// The Atlantic uses <em> in titles, e.g. "That's Enough, <em>Euphoria</em>"
		const expected = "That’s Enough, <em>Euphoria</em>";
		expect(sanitize("That’s Enough, <em>Euphoria</em>")).toBe(expected);
		expect(sanitize("That’s Enough, &lt;em&gt;Euphoria&lt;/em&gt;")).toBe(expected);
	});

	it("strips attributes from allowed tags", () => {
		const result = sanitize("<b onclick=\"steal()\" class=\"x\">bold</b>");
		expect(result).toBe("<b>bold</b>");
		expect(result).not.toContain("onclick");
		expect(result).not.toContain("class");
	});

	it("neutralizes script tags", () => {
		expect(sanitize("<script>alert(1)</script>hello")).not.toContain("<script");
		// Entity-encoded scripts must stay inert text, never become live markup
		const encoded = sanitize("&lt;script&gt;alert(1)&lt;/script&gt;");
		expect(encoded).not.toContain("<script");
		expect(encoded).toContain("&lt;script&gt;");
	});

	it("drops images and link hrefs but keeps disallowed-tag text", () => {
		const result = sanitize("<img src=\"x\" onerror=\"alert(1)\"><a href=\"https://evil.example\">link</a><h1>title</h1>");
		expect(result).not.toContain("onerror");
		expect(result).not.toContain("href");
		expect(result).not.toContain("<h1>");
		expect(result).toContain("link");
		expect(result.toLowerCase()).toContain("title");
	});

	it("escapes bare HTML special characters in plain text", () => {
		expect(sanitize("Fish &amp; Chips for &lt; 5")).toBe("Fish &amp; Chips for &lt; 5");
	});

	it("only keeps tags present in the supplied allowlist", () => {
		// Allow just <em>: a safe-but-not-allowed <strong> must become plain text.
		const result = sanitize("<em>kept</em> <strong>dropped</strong>", ["em"]);
		expect(result).toBe("<em>kept</em> dropped");
		expect(result).not.toContain("<strong>");
	});

	it("escapes everything when the allowlist is empty", () => {
		expect(sanitize("<em>hi</em> &amp; <b>bye</b>", [])).toBe("hi &amp; bye");
	});

	it("renders <br> as a single self-closing tag when allowed", () => {
		const result = sanitize("a<br>b", ["br"]);
		expect(result).toContain("<br>");
		expect(result).not.toContain("<br></br>");
		expect(result).not.toContain("&lt;br&gt;");
	});

	it("collapses <br> to a space when not allowed", () => {
		const result = sanitize("a<br>b", ["em"]);
		expect(result).not.toContain("<br>");
		expect(result).toBe("a b");
	});
});

describe("feed parser newsfeed compatibility", () => {
	it("normalizes empty Atom text before building items and preserves HTML content with allowed tags", async () => {
		const xml = `<?xml version="1.0"?>
			<feed xmlns="http://www.w3.org/2005/Atom">
				<title>Test feed</title>
				<id>urn:test</id>
				<updated>2026-07-25T00:00:00Z</updated>
				<entry>
					<title>Empty summary</title>
					<id>urn:empty</id>
					<updated>2026-07-25T00:00:00Z</updated>
					<summary type="text"></summary>
				</entry>
				<entry>
					<title><![CDATA[HTML <em>title</em>]]></title>
					<id>urn:html</id>
					<updated>2026-07-25T00:00:00Z</updated>
					<summary type="html"><![CDATA[Text <strong>bold</strong> &amp; more]]></summary>
				</entry>
			</feed>`;

		const fetcher = new NewsfeedFetcher("http://example.com/feed.xml", 60000, "utf-8", false, false, ["em", "strong"]);
		const items = await new Promise((resolve) => {
			fetcher.onReceive((instance) => resolve(instance.items));
			fetcher.httpFetcher.emit("response", new Response(xml, { status: 200 }));
		});

		expect(items).toHaveLength(2);
		expect(items[0].description).toBe("");
		expect(items[1].title).toBe("HTML <em>title</em>");
		expect(items[1].description).toBe("Text <strong>bold</strong> &amp; more");
		expect(items.every((item) => item.title && item.pubdate)).toBe(true);
	});
});
