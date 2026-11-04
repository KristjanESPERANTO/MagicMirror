import {cpuTemperature, mem, osInfo, system, time, versions} from "systeminformation";
import Log from "./logger.js";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import mmPackage from "../package.json" with {type: "json"};

const mmVersion = mmPackage.version;

/**
 * @returns {{ mmGitHash: string, mmGitBranch: string }} Git hash and branch, empty if unavailable.
 */
function getGitInfo () {

	let mmGitHash = "";
	let mmGitBranch = "";

	try {

		mmGitHash = execFileSync(
			"git",
			["rev-parse", "--short", "HEAD"],
			{encoding: "utf8"}
		).trim();
		mmGitBranch = execFileSync(
			"git",
			["rev-parse", "--abbrev-ref", "HEAD"],
			{encoding: "utf8"}
		).trim();

	} catch {
		// Not a git repo or git not available.
	}

	return {
		mmGitHash,
		mmGitBranch
	};

}

/**
 * Log the current system information to the console.
 * @returns {Promise<string|undefined>} The formatted system info string used in tests.
 */
async function logSystemInformation () {

	try {

		const {mmGitHash, mmGitBranch} = getGitInfo();
		const memoryData = await mem();
		const osData = await osInfo();
		const systemData = await system();
		const temperatureData = await cpuTemperature();
		const timeData = await time();
		const versionData = await versions("node,npm,pm2");

		const installedNodeVersion = versionData.node;
		const raspberryData = systemData.raspberry;
		const totalRam = (memoryData.total / 1024 / 1024).toFixed(2);
		const freeRam = (memoryData.free / 1024 / 1024).toFixed(2);
		const usedRam = (memoryData.used / 1024 / 1024).toFixed(2);

		const systemDataString = [
			"\n####  System Information  ####",
			`- MM:       version: v${mmVersion}${mmGitHash ? `; git: ${mmGitHash}` : ""}${mmGitBranch ? `; branch: ${mmGitBranch}` : ""}`,
			`- SYSTEM:   manufacturer: ${systemData.manufacturer}; model: ${systemData.model}; virtual: ${systemData.virtual}`,
			...raspberryData ? [`            Raspberry: ${raspberryData.type}; processor: ${raspberryData.processor}; revision: ${raspberryData.revision}`] : [],
			`- OS:       platform: ${osData.platform}; distro: ${osData.distro}; release: ${osData.release}; arch: ${osData.arch}; kernel: ${osData.kernel}`,
			`            displayServer: ${osData.displayServer}`,
			`- VERSIONS: electron: ${process.env.ELECTRON_VERSION}; used node: ${process.env.USED_NODE_VERSION}; installed node: ${installedNodeVersion}; npm: ${versionData.npm}; pm2: ${versionData.pm2}`,
			`- ENV:      XDG_SESSION_TYPE: ${process.env.XDG_SESSION_TYPE}; MM_CONFIG_FILE: ${process.env.MM_CONFIG_FILE}`,
			`            WAYLAND_DISPLAY:  ${process.env.WAYLAND_DISPLAY}; DISPLAY: ${process.env.DISPLAY}; ELECTRON_ENABLE_GPU: ${process.env.ELECTRON_ENABLE_GPU}`,
			`- RAM:      total: ${totalRam} MB; free: ${freeRam} MB; used: ${usedRam} MB`,
			`- OTHERS:   uptime: ${Math.floor(timeData.uptime / 60)} minutes; timeZone: ${timeData.timezoneName}; cpuTemp: ${temperatureData.max ?? temperatureData.main ?? "n/a"} C`
		].join("\n");

		Log.info(systemDataString);

		// Return is currently only for tests
		return systemDataString;

	} catch (error) {

		Log.error(error);

	}

}

export default logSystemInformation;

/*
 * This file is started in a separate process from app.js, so it must trigger
 * its own log when run directly.
 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {

	logSystemInformation();

}
