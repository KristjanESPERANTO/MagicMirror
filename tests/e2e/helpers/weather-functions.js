const { injectMockData, cleanupMockData } = require("../../utils/weather_mocker");
const helpers = require("./global-setup");

exports.getText = async (element, result) => {
	const elem = await helpers.waitForElement(element);
	expect(elem).not.toBeNull();
	const rawText = await elem.textContent();
	expect(rawText).not.toBeNull();
	const content = rawText
		.trim()
		.replace(/(\r\n|\n|\r)/gm, "")
		.replace(/[ ]+/g, " ");
	expect(content).toBe(result);
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
