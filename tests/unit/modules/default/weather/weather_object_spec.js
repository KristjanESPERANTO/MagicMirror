const defaults = require("../../../../../js/defaults");

const WeatherObject = require(`../../../../../${defaults.defaultModulesDir}/weather/weatherobject`);

global.moment = require("moment-timezone");
global.SunCalc = require("suncalc");

describe("WeatherObject", () => {
	let originalTimeZone;
	let weatherobject;

	beforeAll(() => {
		originalTimeZone = moment.tz.guess();
		moment.tz.setDefault("Africa/Dar_es_Salaam");
		weatherobject = new WeatherObject();
	});

	it("should return true for daytime at noon", () => {
		weatherobject.date = moment("12:00", "HH:mm");
		weatherobject.updateSunTime(-6.774877582342688, 37.63345667023327);
		expect(weatherobject.isDayTime()).toBe(true);
	});

	it("should return false for daytime at midnight", () => {
		weatherobject.date = moment("00:00", "HH:mm");
		weatherobject.updateSunTime(-6.774877582342688, 37.63345667023327);
		expect(weatherobject.isDayTime()).toBe(false);
	});

	it("should return sunrise as the next sunaction", () => {
		weatherobject.updateSunTime(-6.774877582342688, 37.63345667023327);
		const midnight = moment("00:00", "HH:mm");
		expect(weatherobject.nextSunAction(midnight)).toBe("sunrise");
	});

	it("should return sunset as the next sunaction", () => {
		weatherobject.updateSunTime(-6.774877582342688, 37.63345667023327);
		const noon = moment(weatherobject.sunrise).hour(14);
		expect(weatherobject.nextSunAction(noon)).toBe("sunset");
	});

	it("should return an already defined feelsLike info", () => {
		weatherobject.feelsLikeTemp = "feelsLikeTempValue";
		expect(weatherobject.feelsLike()).toBe("feelsLikeTempValue");
	});

	it("should clone date values as timestamps", () => {
		const date = moment("2026-11-04T12:00:00");
		const sunrise = moment("2026-11-04T06:00:00");
		const sunset = moment("2026-11-04T18:00:00");
		weatherobject.date = date;
		weatherobject.sunrise = sunrise;
		weatherobject.sunset = sunset;
		weatherobject.temperature = 12;

		const clone = weatherobject.simpleClone();

		expect(clone).toMatchObject({
			date: date.valueOf(),
			sunrise: sunrise.valueOf(),
			sunset: sunset.valueOf(),
			temperature: 12
		});
		expect(weatherobject.date).toBe(date);
	});

	afterAll(() => {
		moment.tz.setDefault(originalTimeZone);
	});
});
