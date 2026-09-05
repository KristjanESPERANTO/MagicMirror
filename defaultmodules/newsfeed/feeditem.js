const crypto = require("node:crypto");
const { htmlToText } = require("html-to-text");

// The complete set of basic formatting tags users are allowed to opt into via the
// `allowedBasicHtmlTags` config option. These are inline emphasis / line-break tags that
// never carry attributes once sanitized, so they cannot be used for injection. Anything
// requested outside this list is ignored.
const SAFE_HTML_TAGS = ["b", "strong", "i", "em", "u", "br", "code", "s", "sub", "sup"];

const keepTagFormatter = (elem, walk, builder, formatOptions) => {
	const { tagName } = formatOptions;
	if (tagName === "br") {
		builder.addLiteral("<br>");
		return;
	}
	builder.addLiteral(`<${tagName}>`);
	walk(elem.children, builder);
	builder.addLiteral(`</${tagName}>`);
};

/**
 * Normalizes feedparser values that may arrive as strings, arrays, or nested objects.
 * @param {string|Array|object|undefined|null} value - The raw feed value.
 * @returns {string|undefined} The normalized scalar value, if any.
 */
function normalizeFeedValue (value) {
	if (value === undefined || value === null) {
		return undefined;
	}
	if (typeof value === "string") {
		return value;
	}
	if (Array.isArray(value)) {
		return normalizeFeedValue(value[0]);
	}
	if (typeof value === "object") {
		if (value["#"] !== undefined) {
			return value["#"];
		}
		if (value["#text"] !== undefined) {
			return value["#text"];
		}
		if (value["@"] && typeof value["@"] === "object") {
			if (typeof value["@"].href === "string") {
				return value["@"].href;
			}
			if (typeof value["@"].url === "string") {
				return value["@"].url;
			}
		}
	}
	return undefined;
}

/**
 * Reads the first non-empty matching field from a feed item.
 * @param {object} item - The parsed feed item.
 * @param {string[]} fieldNames - Candidate field names to inspect in order.
 * @returns {string|undefined} The selected field value, if present and non-empty.
 */
function readItemField (item, fieldNames) {
	for (const fieldName of fieldNames) {
		if (!Object.hasOwn(item, fieldName)) {
			continue;
		}
		const value = normalizeFeedValue(item[fieldName]);
		if (value !== undefined && value !== "") {
			return value;
		}
	}
	return undefined;
}

/**
 * Reads the feed TTL metadata from common RSS/Atom namespaces.
 * @param {object|null} meta - Feed metadata from the parser.
 * @returns {number|null} TTL minutes when present, otherwise null.
 */
function readFeedTtl (meta) {
	for (const fieldName of ["ttl", "rss:ttl", "atom:ttl", "dc:ttl", "sy:ttl"]) {
		if (!meta || !Object.hasOwn(meta, fieldName)) {
			continue;
		}
		const value = normalizeFeedValue(meta[fieldName]);
		if (value === undefined || value === "") {
			continue;
		}
		const minutes = Number(value);
		if (Number.isFinite(minutes)) {
			return minutes;
		}
	}
	return null;
}

/**
 * Sanitizes HTML text while preserving only the configured basic inline tags.
 * @param {string} html - Raw HTML from a feed title or description.
 * @param {string[]} [allowedTags] - Safe inline tags that may be restored.
 * @returns {string} Sanitized HTML with only the allowed tags kept.
 */
function sanitizeBasicHtml (html, allowedTags = []) {
	const keepTagSelectors = allowedTags.map((tagName) => ({ selector: tagName, format: "keepTag", options: { tagName } }));

	const text = htmlToText(html, {
		wordwrap: false,
		formatters: { keepTag: keepTagFormatter },
		selectors: [
			{ selector: "a", options: { ignoreHref: true, noAnchorUrl: true } },
			{ selector: "br", format: "inlineSurround", options: { prefix: " " } },
			{ selector: "img", format: "skip" },
			...keepTagSelectors
		]
	});

	const escaped = text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

	if (allowedTags.length === 0) {
		return escaped;
	}

	const restoreAllowedTags = new RegExp(`&lt;(/?(?:${allowedTags.join("|")}))&gt;`, "g");
	return escaped.replace(restoreAllowedTags, "<$1>");
}

/**
 * Converts a raw feed item into the MagicMirror item contract used by the module.
 * @param {object} item - The parsed feed item from feedparser.
 * @param {string[]} [allowedBasicHtmlTags] - Inline tags allowed to survive sanitization.
 * @param {boolean} [useCorsProxy] - Whether created article URLs should use the CORS proxy.
 * @returns {{title:string, description:string, pubdate:string, url:string|undefined, useCorsProxy:boolean, hash:string}|null} The normalized item or null when required fields are missing.
 */
function normalizeFeedItem (item, allowedBasicHtmlTags = [], useCorsProxy = false) {
	const title = readItemField(item, ["title", "rss:title", "atom:title", "dc:title", "rdf:title"]);
	let description = readItemField(item, ["description", "summary", "content", "rss:description", "atom:summary", "atom:content", "content:encoded"]);
	const pubdate = readItemField(item, ["pubdate", "published", "updated", "date", "rss:pubdate", "atom:updated", "dc:date", "a10:updated"]);
	const url = readItemField(item, ["url", "link", "rss:link", "atom:link", "guid", "rss:guid"]);

	if (typeof description !== "string") {
		description = "";
	}

	if (!title || !pubdate) {
		return null;
	}

	let displayTitle = title;
	if (allowedBasicHtmlTags.length > 0) {
		description = sanitizeBasicHtml(description, allowedBasicHtmlTags);
		displayTitle = sanitizeBasicHtml(title, allowedBasicHtmlTags);
	} else {
		description = htmlToText(description, {
			wordwrap: false,
			selectors: [
				{ selector: "a", options: { ignoreHref: true, noAnchorUrl: true } },
				{ selector: "br", format: "inlineSurround", options: { prefix: " " } },
				{ selector: "img", format: "skip" }
			]
		});
	}

	return {
		title: displayTitle,
		description,
		pubdate: String(pubdate),
		url,
		useCorsProxy,
		hash: crypto.createHash("sha256").update(`${pubdate} :: ${title} :: ${url}`).digest("hex")
	};
}

module.exports = {
	SAFE_HTML_TAGS,
	normalizeFeedValue,
	readItemField,
	readFeedTtl,
	sanitizeBasicHtml,
	normalizeFeedItem
};
