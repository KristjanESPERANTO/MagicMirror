const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { osInfo, system, versions } = require("systeminformation");
// needed with relative path because logSystemInformation is called in an own process in app.js:
const mmVersion = require("../package").version;
const Log = require("./logger");

let mmGitHash = "";
let mmGitBranch = "";
try {
	mmGitHash = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
	mmGitBranch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
} catch {
	// not a git repo or git not available
}

const logSystemInformation = async () => {
	try {
		const systemData = await system();
		const osData = await osInfo();
		const versionData = await versions("node,npm,pm2");

		const installedNodeVersion = versionData.node;
		const totalRam = (os.totalmem() / 1024 / 1024).toFixed(2);
		const freeRam = (os.freemem() / 1024 / 1024).toFixed(2);
		const usedRam = ((os.totalmem() - os.freemem()) / 1024 / 1024).toFixed(2);

		const systemDataString = [
			"\n####  System Information  ####",
			`- MM:       version: v${mmVersion}${mmGitHash ? `; git: ${mmGitHash}` : ""}${mmGitBranch ? `; branch: ${mmGitBranch}` : ""}`,
			`- SYSTEM:   manufacturer: ${systemData.manufacturer}; model: ${systemData.model}; virtual: ${systemData.virtual}`,
			`- OS:       platform: ${osData.platform}; distro: ${osData.distro}; release: ${osData.release}; arch: ${osData.arch}; kernel: ${osData.kernel}`,
			`- VERSIONS: electron: ${process.env.ELECTRON_VERSION}; used node: ${process.env.USED_NODE_VERSION}; installed node: ${installedNodeVersion}; npm: ${versionData.npm}; pm2: ${versionData.pm2}`,
			`- ENV:      XDG_SESSION_TYPE: ${process.env.XDG_SESSION_TYPE}; MM_CONFIG_FILE: ${process.env.MM_CONFIG_FILE}`,
			`            WAYLAND_DISPLAY:  ${process.env.WAYLAND_DISPLAY}; DISPLAY: ${process.env.DISPLAY}; ELECTRON_ENABLE_GPU: ${process.env.ELECTRON_ENABLE_GPU}`,
			`- RAM:      total: ${totalRam} MB; free: ${freeRam} MB; used: ${usedRam} MB`,
			`- OTHERS:   uptime: ${Math.floor(os.uptime() / 60)} minutes; timeZone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
		].join("\n");
		Log.info(systemDataString);

		// Return is currently only for tests
		return systemDataString;
	} catch (error) {
		Log.error(error);
	}
};

module.exports = logSystemInformation;
logSystemInformation();
