const crypto = require("node:crypto");
const { htmlToText } = require("html-to-text");

const SAFE_HTML_TAGS = ["b", "strong", "i", "em", "u", "br", "code", "s", "sub", "sup"];

const keepTagFormatter = (element, walk, builder, formatOptions) => {
	const { tagName } = formatOptions;
	if (tagName === "br") {
		builder.addLiteral("<br>");
		return;
	}
	builder.addLiteral(`<${tagName}>`);
	walk(element.children, builder);
	builder.addLiteral(`</${tagName}>`);
};

const textOptions = {
	wordwrap: false,
	selectors: [
		{ selector: "a", options: { ignoreHref: true, noAnchorUrl: true } },
		{ selector: "br", format: "inlineSurround", options: { prefix: " " } },
		{ selector: "img", format: "skip" }
	]
};

/**
 * Sanitizes feed text while preserving only the configured safe inline tags.
 * @param {string} value - Raw feed text.
 * @param {string[]} [allowedTags] - Safe tags to preserve.
 * @returns {string} Sanitized text.
 */
const sanitizeBasicHtml = (value, allowedTags = []) => {
	const keepTagSelectors = allowedTags.map((tagName) => ({ selector: tagName, format: "keepTag", options: { tagName } }));
	const text = htmlToText(String(value ?? ""), {
		wordwrap: false,
		formatters: { keepTag: keepTagFormatter },
		selectors: [...textOptions.selectors, ...keepTagSelectors]
	});
	const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

	if (allowedTags.length === 0) {
		return escaped;
	}

	const restoreAllowedTags = new RegExp(`&lt;(/?(?:${allowedTags.join("|")}))&gt;`, "g");
	return escaped.replace(restoreAllowedTags, "<$1>");
};

/**
 * Converts a parsed feed item into the stable Newsfeed item contract.
 * @param {object} item - Parsed item from \@rowanmanning/feed-parser.
 * @param {string[]} [allowedBasicHtmlTags] - Safe tags to preserve.
 * @param {boolean} [useCorsProxy] - Whether the article uses the CORS proxy.
 * @returns {object|null} Normalized item, or null when title/date is missing.
 */
const normalizeFeedItem = (item, allowedBasicHtmlTags = [], useCorsProxy = false) => {
	const title = item.title;
	const rawDescription = item.description ?? "";
	const description = typeof rawDescription === "string" ? rawDescription : "";
	const parsedPubdate = item.published ?? item.updated;

	if (!title || !parsedPubdate) {
		return null;
	}
	const pubdate = parsedPubdate instanceof Date ? parsedPubdate.toISOString() : String(parsedPubdate);

	const normalizedDescription = allowedBasicHtmlTags.length > 0
		? sanitizeBasicHtml(description, allowedBasicHtmlTags)
		: htmlToText(String(description), textOptions);

	return {
		title: sanitizeBasicHtml(title, allowedBasicHtmlTags),
		description: normalizedDescription,
		pubdate,
		url: item.url || "",
		useCorsProxy,
		hash: crypto.createHash("sha256").update(`${pubdate} :: ${title} :: ${item.url || ""}`).digest("hex")
	};
};

module.exports = { SAFE_HTML_TAGS, normalizeFeedItem, sanitizeBasicHtml };
