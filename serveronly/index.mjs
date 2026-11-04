import "../js/alias-resolver.js";
import Log from "../js/logger.js";
import app from "../js/app.mjs";
import serverFunctions from "#server_functions";

const {getServerPort} = serverFunctions;
const config = await app.start();
const bindAddress = config.address || "localhost";
let httpType = "http";

if (config.useHttps) {
	httpType = "https";
}

Log.info(`\n>>>   Ready to go! Please point your browser to: ${httpType}://${bindAddress}:${getServerPort(config)}   <<<`);
