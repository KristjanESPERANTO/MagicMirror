const { expect } = require("playwright/test");
const helpers = require("../helpers/global-setup");
const weatherFunc = require("../helpers/weather-functions");

describe("Weather module: Weather Forecast", () => {
	let page;
	const getText = (selector, expectedText) => weatherFunc.getText(page, selector, expectedText);

	afterAll(async () => {
		await weatherFunc.stopApplication();
	});

	describe("Default configuration", () => {
		beforeAll(async () => {
			await weatherFunc.startApplication("tests/configs/modules/weather/forecastweather_default.js", {});
			page = helpers.getPage();
		});

		const days = ["Today", "Tomorrow", "Sun", "Mon", "Tue"];
		for (const [index, day] of days.entries()) {
			it(`should render day ${day}`, async () => {
				await expect(getText(`.weather table.small tr:nth-child(${index + 1}) td:nth-child(1)`, day)).resolves.toBe(true);
			});
		}

		const icons = ["day-cloudy", "rain", "day-sunny", "day-sunny", "day-sunny"];
		for (const [index, icon] of icons.entries()) {
			it(`should render icon ${icon}`, async () => {
				await expect(page.locator(`.weather table.small tr:nth-child(${index + 1}) td:nth-child(2) span.wi-${icon}`)).toBeVisible();
			});
		}

		const maxTemps = ["24.4°", "21.0°", "22.9°", "23.4°", "20.6°"];
		for (const [index, temp] of maxTemps.entries()) {
			it(`should render max temperature ${temp}`, async () => {
				await expect(getText(`.weather table.small tr:nth-child(${index + 1}) td:nth-child(3)`, temp)).resolves.toBe(true);
			});
		}

		const minTemps = ["15.3°", "13.6°", "13.8°", "13.9°", "10.9°"];
		for (const [index, temp] of minTemps.entries()) {
			it(`should render min temperature ${temp}`, async () => {
				await expect(getText(`.weather table.small tr:nth-child(${index + 1}) td:nth-child(4)`, temp)).resolves.toBe(true);
			});
		}

		const opacities = [1, 1, 0.8, 0.5333333333333333, 0.2666666666666667];
		for (const [index, opacity] of opacities.entries()) {
			it(`should render fading of rows with opacity=${opacity}`, async () => {
				const locator = page.locator(`.weather table.small tr:nth-child(${index + 1})`);
				await locator.waitFor({ state: "visible" });
				const html = await locator.evaluate((node) => node.outerHTML);
				expect(html).toContain(`style="opacity: ${opacity};"`);
			});
		}
	});

	describe("Absolute configuration", () => {
		beforeAll(async () => {
			await weatherFunc.startApplication("tests/configs/modules/weather/forecastweather_absolute.js", {});
			page = helpers.getPage();
		});

		const days = ["Fri", "Sat", "Sun", "Mon", "Tue"];
		for (const [index, day] of days.entries()) {
			it(`should render day ${day}`, async () => {
				await expect(getText(`.weather table.small tr:nth-child(${index + 1}) td:nth-child(1)`, day)).resolves.toBe(true);
			});
		}
	});

	describe("Configuration Options", () => {
		beforeAll(async () => {
			await weatherFunc.startApplication("tests/configs/modules/weather/forecastweather_options.js", {});
			page = helpers.getPage();
		});

		it("should render custom table class", async () => {
			await expect(page.locator(".weather table.myTableClass")).toBeVisible();
		});

		it("should render colored rows", async () => {
			const rows = page.locator(".weather table.myTableClass tr");
			await expect(rows).toHaveCount(5);
		});

		const precipitations = [undefined, "2.51 mm"];
		for (const [index, precipitation] of precipitations.entries()) {
			if (precipitation) {
				it(`should render precipitation amount ${precipitation}`, async () => {
					await expect(getText(`.weather table tr:nth-child(${index + 1}) td.precipitation-amount`, precipitation)).resolves.toBe(true);
				});
			}
		}
	});

	describe("Forecast weather with imperial units", () => {
		beforeAll(async () => {
			await weatherFunc.startApplication("tests/configs/modules/weather/forecastweather_units.js", {});
			page = helpers.getPage();
		});

		describe("Temperature units", () => {
			const temperatures = ["75_9°", "69_8°", "73_2°", "74_1°", "69_1°"];
			for (const [index, temp] of temperatures.entries()) {
				it(`should render custom decimalSymbol = '_' for temp ${temp}`, async () => {
					await expect(getText(`.weather table.small tr:nth-child(${index + 1}) td:nth-child(3)`, temp)).resolves.toBe(true);
				});
			}
		});

		describe("Precipitation units", () => {
			const precipitations = [undefined, "0.10 in"];
			for (const [index, precipitation] of precipitations.entries()) {
				if (precipitation) {
					it(`should render precipitation amount ${precipitation}`, async () => {
						await expect(getText(`.weather table.small tr:nth-child(${index + 1}) td.precipitation-amount`, precipitation)).resolves.toBe(true);
					});
				}
			}
		});
	});
});
