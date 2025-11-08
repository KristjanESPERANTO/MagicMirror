const { injectMockData, cleanupMockData } = require("../../utils/weather_mocker");
const helpers = require("./global-setup");

/**
 * Get normalized text from element (trimmed, no line breaks, single spaces)
 * @param {import("playwright").Page} page Playwright page instance
 * @param {string} selector css selector
 * @param {string} expectedText expected text content
 * @returns {Promise<boolean>} assertion outcome
 */
exports.getText = async (page, selector, expectedText) => {
	const locator = page.locator(selector);
	await locator.waitFor({ state: "visible" });
	const rawText = await locator.textContent();
	const content = rawText
		.trim()
		.replace(/(\r\n|\n|\r)/gm, "")
		.replace(/[ ]+/g, " ");
	expect(content).toBe(expectedText);
	return true;
};

exports.startApplication = async (configFileName, additionalMockData) => {
	await helpers.startApplication(injectMockData(configFileName, additionalMockData));
	await helpers.getDocument();
};

exports.stopApplication = async () => {
	await helpers.stopApplication();
	cleanupMockData();
};
