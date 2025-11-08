const helpers = require("./helpers/global-setup");

describe("Custom Position of modules", () => {
	beforeAll(async () => {
		await helpers.fixupIndex();
		await helpers.startApplication("tests/configs/customregions.js");
		await helpers.getDocument();
	});
	afterAll(async () => {
		await helpers.stopApplication();
		await helpers.restoreIndex();
	});

	const positions = ["row3_left", "top3_left1"];
	let i = 0;
	const className1 = positions[i].replace("_", ".");
	let message1 = positions[i];
	it(`should show text in ${message1}`, async () => {
		await expect(
			helpers.expectTextContent(`.${className1} .module-content`, { contains: `Text in ${message1}` })
		).resolves.toBe(true);
	});
	i = 1;
	const className2 = positions[i].replace("_", ".");
	let message2 = positions[i];
	it(`should NOT show text in ${message2}`, async () => {
		const elem = await helpers.querySelector(`.${className2} .module-content`);
		expect(elem).toBeNull();
	});
});
