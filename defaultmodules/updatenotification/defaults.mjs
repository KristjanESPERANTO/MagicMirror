/* eslint-disable no-inline-comments */
export default {
	updateInterval: 10 * 60 * 1000, // Every 10 minutes
	refreshInterval: 24 * 60 * 60 * 1000, // One day
	ignoreModules: [],
	sendUpdatesNotifications: false,
	updates: [],
	updateTimeout: 2 * 60 * 1000, // Max update duration
	updateAutorestart: false, // AutoRestart MM when update done ?
	useModulesFromConfig: true // If `false` iterate over modules directory
};
