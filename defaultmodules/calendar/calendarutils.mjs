/**
 * An event as delivered by the calendar fetcher, plus the relative day flags set by the module.
 * @typedef {object} CalendarEvent
 * @property {string} startDate Start as epoch milliseconds.
 * @property {string} endDate End as epoch milliseconds.
 * @property {boolean} fullDayEvent True for all-day events.
 * @property {boolean} [today] Event starts today.
 * @property {boolean} [dayBeforeYesterday] Event starts the day before yesterday.
 * @property {boolean} [yesterday] Event starts yesterday.
 * @property {boolean} [tomorrow] Event starts tomorrow.
 * @property {boolean} [dayAfterTomorrow] Event starts the day after tomorrow.
 */

/**
 * Everything needed to build the time text of one event.
 * @typedef {object} TimeTextContext
 * @property {CalendarEvent} event The calendar event.
 * @property {moment.Moment} start The event start.
 * @property {moment.Moment} end The event end.
 * @property {moment.Moment} [now] The current moment (not needed for dateheaders).
 * @property {object} config The calendar module config.
 * @property {(key: string, variables?: object) => string} [translate] The module translate function (not needed for dateheaders).
 * @property {{debug: (message: string) => void, info: (message: string) => void}} [log] Logger for branch diagnostics, silent when omitted.
 */

const silentLog = { debug () {}, info () {} };

const CalendarUtils = {

	/**
	 * Capitalize the first letter of a string
	 * @param {string} string The string to capitalize
	 * @returns {string} The capitalized string
	 */
	capFirst (string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	},

	/**
	 * This function accepts a number (either 12 or 24) and returns a moment.js LocaleSpecification with the
	 * corresponding time-format to be used in the calendar display. If no number is given (or otherwise invalid input)
	 * it will a localeSpecification object with the system locale time format.
	 * @param {number} timeFormat Specifies either 12 or 24-hour time format
	 * @param {moment.Locale} localeData Locale providing the system time format, used when timeFormat is neither 12 nor 24
	 * @returns {moment.LocaleSpecification} formatted time
	 */
	getLocaleSpecification (timeFormat, localeData) {
		switch (timeFormat) {
			case 12: {
				return { longDateFormat: { LT: "h:mm A" } };
			}
			case 24: {
				return { longDateFormat: { LT: "HH:mm" } };
			}
			default: {
				return { longDateFormat: { LT: localeData.longDateFormat("LT") } };
			}
		}
	},

	/**
	 * Shortens a string if it's longer than maxLength and add an ellipsis to the end
	 * @param {string} string Text string to shorten
	 * @param {number} maxLength The max length of the string
	 * @param {boolean} wrapEvents Wrap the text after the line has reached maxLength
	 * @param {number} maxTitleLines The max number of vertical lines before cutting event title
	 * @returns {string} The shortened string
	 */
	shorten (string, maxLength, wrapEvents, maxTitleLines) {
		if (typeof string !== "string") {
			return "";
		}

		// Order matters: "&" must be escaped first, otherwise the entities added below would be escaped again.
		const escapeHtml = (value) => value
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll("\"", "&quot;")
			.replaceAll("'", "&#39;");

		if (wrapEvents === true) {
			const words = string.split(" ");
			let temp = "";
			let currentLine = "";
			let line = 0;

			for (let i = 0; i < words.length; i++) {
				const word = words[i];
				if (currentLine.length + word.length < (typeof maxLength === "number" ? maxLength : 25) - 1) {
					// max - 1 to account for a space
					currentLine += `${word} `;
				} else {
					line++;
					if (line > maxTitleLines - 1) {
						if (i < words.length) {
							currentLine += "…";
						}
						break;
					}

					if (currentLine.length > 0) {
						temp += `${escapeHtml(currentLine)}<br>${escapeHtml(word)} `;
					} else {
						temp += `${escapeHtml(word)}<br>`;
					}
					currentLine = "";
				}
			}

			return (temp + escapeHtml(currentLine)).trim();
		} else {
			if (maxLength && typeof maxLength === "number" && string.length > maxLength) {
				return `${escapeHtml(string.trim().slice(0, maxLength))}…`;
			} else {
				return escapeHtml(string.trim());
			}
		}
	},

	/**
	 * Transforms the title of an event for usage.
	 * Replaces parts of the text as defined in config.titleReplace.
	 * @param {string} title The title to transform.
	 * @param {object} titleReplace object definition of parts to be replaced in the title
	 *                 object definition:
	 *                    search: {string,required} RegEx in format //x or simple string to be searched. For (birthday) year calculation, the element matching the year must be in a RegEx group
	 *                    replace: {string,required} Replacement string, may contain match group references (latter is required for year calculation)
	 *                    yearmatchgroup: {number,optional} match group for year element
	 * @returns {string} The transformed title.
	 */
	titleTransform (title, titleReplace) {
		let transformedTitle = title;
		for (const tr in titleReplace) {
			const transform = titleReplace[tr];
			if (typeof transform === "object") {
				if (typeof transform.search !== "undefined" && transform.search !== "" && typeof transform.replace !== "undefined") {
					const regParts = transform.search.match(/^\/(.+)\/([gim]*)$/);
					let needle = new RegExp(transform.search, "g");
					if (regParts) {
						// the parsed pattern is a regexp with flags.
						needle = new RegExp(regParts[1], regParts[2]);
					}

					let replacement = transform.replace;
					if (typeof transform.yearmatchgroup !== "undefined" && transform.yearmatchgroup !== "") {
						const yearmatch = [...title.matchAll(needle)];
						if (yearmatch.length > 0 && yearmatch[0].length >= transform.yearmatchgroup + 1 && yearmatch[0][transform.yearmatchgroup] * 1 >= 1900) {
							const calcage = new Date().getFullYear() - yearmatch[0][transform.yearmatchgroup] * 1;
							const searchstr = `$${transform.yearmatchgroup}`;
							replacement = replacement.replace(searchstr, calcage);
						}
					}
					transformedTitle = transformedTitle.replace(needle, replacement);
				}
			}
		}
		return transformedTitle;
	},

	/**
	 * Checks whether a calendar event has a non-zero duration.
	 * @param {object} event The calendar event.
	 * @returns {boolean} True if the event has a duration.
	 */
	hasEventDuration (event) {
		return event.startDate !== event.endDate;
	},

	/**
	 * Adjusts an exclusive full-day end to the final second of the event.
	 * @param {moment.Moment} endMoment The exclusive event end.
	 * @returns {moment.Moment} The adjusted end moment.
	 */
	getAdjustedFullDayEndMoment (endMoment) {
		return endMoment.clone().subtract(1, "second");
	},

	/**
	 * Determines whether two moments are on the same day.
	 * @param {moment.Moment} startMoment The start moment.
	 * @param {moment.Moment} endMoment The end moment.
	 * @returns {boolean} True when both moments share the same calendar day.
	 */
	isSameDay (startMoment, endMoment) {
		return startMoment.isSame(endMoment, "d");
	},

	/**
	 * Checks whether the given dateFormat already contains time components.
	 * @param {string} dateFormat The moment.js date format.
	 * @param {moment.Locale} localeData The locale used to expand tokens like `LT` or `lll`.
	 * @returns {boolean} True when dateFormat includes time tokens.
	 */
	dateFormatIncludesTime (dateFormat, localeData) {
		const dateFormatWithoutLiterals = dateFormat.replace(/\[[^\]]*\]/g, "");
		const expandedDateFormat = dateFormatWithoutLiterals.replace(
			/LTS|LT|LLLL|LLL|LL|L|llll|lll|ll|l/g,
			(token) => localeData.longDateFormat(token) || token
		);
		const expandedDateFormatWithoutLiterals = expandedDateFormat.replace(/\[[^\]]*\]/g, "");
		return (/(H{1,2}|h{1,2}|k{1,2}|m{1,2}|s{1,2}|a|A)/).test(expandedDateFormatWithoutLiterals);
	},

	/**
	 * Formats a timed event end value.
	 * Uses time-only for same-day events and dateEndFormat for multi-day events.
	 * @param {moment.Moment} startMoment The event start moment.
	 * @param {moment.Moment} endMoment The event end moment.
	 * @param {string} dateEndFormat The moment.js format used for multi-day ends.
	 * @returns {string} The formatted end value.
	 */
	formatTimedEventEnd (startMoment, endMoment, dateEndFormat) {
		const endFormat = CalendarUtils.isSameDay(startMoment, endMoment) ? "LT" : dateEndFormat;
		return CalendarUtils.capFirst(endMoment.format(endFormat));
	},

	/**
	 * Checks whether the end of a timed event should be shown.
	 * @param {CalendarEvent} event The calendar event.
	 * @param {object} config The calendar module config.
	 * @returns {boolean} True when showEnd is set and the event passes showEndsOnlyWithDuration.
	 */
	shouldShowTimedEnd (event, config) {
		return config.showEnd && (!config.showEndsOnlyWithDuration || CalendarUtils.hasEventDuration(event));
	},

	/**
	 * Builds the `-<end date>` suffix of a multi-day full-day event.
	 * @param {moment.Moment} startMoment The event start.
	 * @param {moment.Moment} endMoment The exclusive event end.
	 * @param {object} config The calendar module config.
	 * @returns {string} The suffix, or an empty string when no end date is shown.
	 */
	getFullDayEndSuffix (startMoment, endMoment, config) {
		if (!config.showEnd || config.showEndsOnlyWithDuration) {
			return "";
		}
		const adjustedEndMoment = CalendarUtils.getAdjustedFullDayEndMoment(endMoment);
		if (CalendarUtils.isSameDay(startMoment, adjustedEndMoment)) {
			return "";
		}
		return `-${CalendarUtils.capFirst(adjustedEndMoment.format(config.fullDayEventDateFormat))}`;
	},

	/**
	 * Resolves the label of an event on a nearby day ("Today", "Tomorrow", ...).
	 * @param {CalendarEvent} event The calendar event with its relative day flags.
	 * @param {(key: string) => string} translate The module translate function.
	 * @param {string[]} flags The event flags to consider, in priority order.
	 * @returns {string|null} The label, or null when no flag is set or the label is not translated.
	 */
	getRelativeDayLabel (event, translate, flags) {
		const flag = flags.find((name) => event[name]);
		if (!flag) {
			return null;
		}
		const key = flag.toUpperCase();
		// Not every language translates these two labels; the translator then returns the key itself.
		if ((key === "DAYBEFOREYESTERDAY" || key === "DAYAFTERTOMORROW") && translate(key) === key) {
			return null;
		}
		return CalendarUtils.capFirst(translate(key));
	},

	/**
	 * Builds the "Running ..." text of an ongoing event.
	 * @param {moment.Moment} endMoment The event end.
	 * @param {(key: string, variables?: object) => string} translate The module translate function.
	 * @returns {string} The running text.
	 */
	buildRunningText (endMoment, translate) {
		return CalendarUtils.capFirst(
			translate("RUNNING", {
				fallback: `${translate("RUNNING")} {timeUntilEnd}`,
				timeUntilEnd: endMoment.fromNow(true)
			})
		);
	},

	/**
	 * Builds the time cell text for `timeFormat: "dateheaders"`.
	 * @param {TimeTextContext} context The event and its rendering context.
	 * @returns {string|null} The time text, or null when the event needs no time cell.
	 */
	buildDateHeadersTimeText (context) {
		const { event, start: eventStartDateMoment, end: eventEndDateMoment, config } = context;
		if (event.fullDayEvent) {
			return CalendarUtils.getFullDayEndSuffix(eventStartDateMoment, eventEndDateMoment, config) || null;
		}

		let timeText = eventStartDateMoment.format("LT");
		// Time-only end avoids redundant date info under a date header.
		if (CalendarUtils.shouldShowTimedEnd(event, config)) {
			timeText += `-${CalendarUtils.capFirst(eventEndDateMoment.format("LT"))}`;
		}
		return timeText;
	},

	/**
	 * Builds the time text for `timeFormat: "absolute"`.
	 * @param {TimeTextContext} context The event and its rendering context.
	 * @returns {string} The time text.
	 */
	buildAbsoluteTimeText (context) {
		const { event, start: eventStartDateMoment, end: eventEndDateMoment, now, config, translate } = context;
		let timeText = CalendarUtils.capFirst(eventStartDateMoment.format(config.dateFormat));

		if (CalendarUtils.shouldShowTimedEnd(event, config)) {
			const sameDay = CalendarUtils.isSameDay(eventStartDateMoment, eventEndDateMoment);
			if (sameDay && !CalendarUtils.dateFormatIncludesTime(config.dateFormat, eventStartDateMoment.localeData())) {
				timeText += `, ${eventStartDateMoment.format("LT")}`;
			}
			timeText += `-${CalendarUtils.formatTimedEventEnd(eventStartDateMoment, eventEndDateMoment, config.dateEndFormat)}`;
		}

		if (event.fullDayEvent) {
			const endSuffix = CalendarUtils.getFullDayEndSuffix(eventStartDateMoment, eventEndDateMoment, config);
			timeText = CalendarUtils.capFirst(eventStartDateMoment.format(config.fullDayEventDateFormat));

			if (endSuffix) {
				timeText += endSuffix;
			} else if (!CalendarUtils.isSameDay(eventStartDateMoment, CalendarUtils.getAdjustedFullDayEndMoment(eventEndDateMoment)) && eventStartDateMoment.isBefore(now)) {
				timeText = CalendarUtils.capFirst(now.format(config.fullDayEventDateFormat));
			}

			if (config.nextDaysRelative) {
				const label = CalendarUtils.getRelativeDayLabel(event, translate, ["today", "yesterday", "tomorrow", "dayAfterTomorrow"]);
				if (label) {
					timeText = label + endSuffix;
				}
			}

			return timeText;
		}

		if (config.getRelative > 0 && eventStartDateMoment.isBefore(now)) {
			return CalendarUtils.buildRunningText(eventEndDateMoment, translate);
		}

		if (config.urgency > 0 && eventStartDateMoment.diff(now, "d") < config.urgency) {
			return CalendarUtils.capFirst(eventStartDateMoment.fromNow());
		}

		return timeText;
	},

	/**
	 * Builds the time text for `timeFormat: "relative"`.
	 * @param {TimeTextContext} context The event and its rendering context.
	 * @returns {string} The time text.
	 */
	buildRelativeTimeText (context) {
		const { event, start: eventStartDateMoment, end: eventEndDateMoment, now, config, translate, log = silentLog } = context;
		const isUpcomingOrToday = eventStartDateMoment.isSameOrAfter(now) || (event.fullDayEvent && eventEndDateMoment.diff(now, "days") === 0);
		if (!isUpcomingOrToday) {
			return CalendarUtils.buildRunningText(eventEndDateMoment, translate);
		}

		let timeText;

		if (!config.hideTime && !event.fullDayEvent) {
			log.debug("[calendar] event not hidden and not fullday");
			timeText = `${CalendarUtils.capFirst(eventStartDateMoment.calendar(null, { sameElse: config.dateFormat }))}`;
		} else {
			log.debug("[calendar] event full day or hidden");
			timeText = `${CalendarUtils.capFirst(
				eventStartDateMoment.calendar(null, {
					sameDay: config.showTimeToday ? "LT" : `[${translate("TODAY")}]`,
					nextDay: `[${translate("TOMORROW")}]`,
					nextWeek: "dddd",
					sameElse: event.fullDayEvent ? config.fullDayEventDateFormat : config.dateFormat
				})
			)}`;
		}

		if (event.fullDayEvent) {
			const isToday = event.today || eventEndDateMoment.diff(now, "days") === 0;
			const label = isToday
				? CalendarUtils.capFirst(translate("TODAY"))
				: CalendarUtils.getRelativeDayLabel(event, translate, ["dayBeforeYesterday", "yesterday", "tomorrow", "dayAfterTomorrow"]);
			if (label) {
				timeText = label;
			}
			timeText += CalendarUtils.getFullDayEndSuffix(eventStartDateMoment, eventEndDateMoment, config);

			log.info("[calendar] event fullday");
		} else if (eventStartDateMoment.diff(now, "h") < config.getRelative) {
			log.info("[calendar] not full day but within getRelative size");
			timeText = `${CalendarUtils.capFirst(eventStartDateMoment.fromNow())}`;
		} else if (!config.hideTime && CalendarUtils.shouldShowTimedEnd(event, config)) {
			if (CalendarUtils.isSameDay(eventStartDateMoment, eventEndDateMoment)) {
				const sameElseFormat = CalendarUtils.dateFormatIncludesTime(config.dateFormat, eventStartDateMoment.localeData()) ? config.dateFormat : `${config.dateFormat}, LT`;
				timeText = CalendarUtils.capFirst(
					eventStartDateMoment.calendar(null, { sameElse: sameElseFormat })
				);
			}
			timeText += `-${CalendarUtils.formatTimedEventEnd(eventStartDateMoment, eventEndDateMoment, config.dateEndFormat)}`;
		}

		return timeText;
	}
};

globalThis.CalendarUtils = CalendarUtils;

export default CalendarUtils;
