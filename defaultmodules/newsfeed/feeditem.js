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

const isHttpUrl = (value) => typeof value === "string" && (/^https?:\/\//i).test(value);

const readParserValue = (value) => {
	if (value instanceof Date) {
		return value;
	}
	if (value && typeof value === "object") {
		return Object.hasOwn(value, "#") ? value["#"] : undefined;
	}
	return value;
};

const formatPubdate = (value) => (value instanceof Date ? value.toISOString() : value);

const readItemUrl = (item) => {
	if (item["atom:link"]) {
		const atomLinks = Array.isArray(item["atom:link"]) ? item["atom:link"] : [item["atom:link"]];
		const articleLink = atomLinks.find((entry) => {
			const rel = entry?.["@"]?.rel?.toLowerCase();
			return typeof entry?.["@"]?.href === "string" && (rel === undefined || rel === "alternate");
		});
		return articleLink?.["@"].href;
	}
	return isHttpUrl(item.link) ? item.link : isHttpUrl(item.guid) ? item.guid : undefined;
};

/**
 * Reads the feed TTL metadata from common RSS/Atom namespaces.
 * @param {object|null} meta - Feed metadata from the parser.
 * @returns {number|null} TTL minutes when present, otherwise null.
 */
const readFeedTtl = (meta) => {
	for (const fieldName of ["ttl", "rss:ttl", "atom:ttl", "dc:ttl", "sy:ttl"]) {
		if (!meta || !Object.hasOwn(meta, fieldName)) {
			continue;
		}
		const value = readParserValue(meta[fieldName]);
		if (value === undefined || value === "") {
			continue;
		}
		const minutes = Number(value);
		if (Number.isFinite(minutes)) {
			return minutes;
		}
	}
	return null;
};

/**
 * Sanitizes HTML text while preserving only the configured basic inline tags.
 * @param {string} html - Raw HTML from a feed title or description.
 * @param {string[]} [allowedTags] - Safe inline tags that may be restored.
 * @returns {string} Sanitized HTML with only the allowed tags kept.
 */
const sanitizeBasicHtml = (html, allowedTags = []) => {
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
};

/**
 * Converts a raw feed item into the MagicMirror item contract used by the module.
 * @param {object} item - The parsed feed item from feedparser.
 * @param {string[]} [allowedBasicHtmlTags] - Inline tags allowed to survive sanitization.
 * @param {boolean} [useCorsProxy] - Whether created article URLs should use the CORS proxy.
 * @returns {{title:string, description:string, pubdate:string, url:string|undefined, useCorsProxy:boolean, hash:string}|null} The normalized item or null when required fields are missing.
 */
const normalizeFeedItem = (item, allowedBasicHtmlTags = [], useCorsProxy = false) => {
	const title = item.title;
	let description = item.description ?? item.summary ?? "";
	const pubdate = formatPubdate(readParserValue(item["rss:pubdate"]) ?? readParserValue(item["atom:updated"]) ?? item.pubdate ?? item.date ?? item.updated);
	const url = readItemUrl(item);

	if (typeof description !== "string") {
		description = "";
	}

	if (!title || !pubdate) {
		return null;
	}

	const displayTitle = sanitizeBasicHtml(title, allowedBasicHtmlTags);
	if (allowedBasicHtmlTags.length > 0) {
		description = sanitizeBasicHtml(description, allowedBasicHtmlTags);
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
};

module.exports = {
	SAFE_HTML_TAGS,
	readFeedTtl,
	sanitizeBasicHtml,
	normalizeFeedItem
};
