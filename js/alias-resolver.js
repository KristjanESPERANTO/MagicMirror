// Internal aliases for default and third-party CommonJS and ESM modules.

const path = require("node:path");
const { registerHooks } = require("node:module");
const { pathToFileURL } = require("node:url");

// Keep this list minimal; do not add new aliases without architectural review.
const aliases = Object.freeze({
	logger: pathToFileURL(path.join(__dirname, "logger.js")).href,
	node_helper: pathToFileURL(path.join(__dirname, "node_helper.js")).href
});

/**
 * Resolve internal aliases and delegate other specifiers to Node.
 * @param {string} specifier The requested module specifier.
 * @param {object} context Node's module resolution context.
 * @param {function(string, object): object} nextResolve Node's next resolver hook.
 * @returns {object} The resolved module or the next resolver result.
 */
const resolveAlias = (specifier, context, nextResolve) => {
	const aliasUrl = Object.getOwnPropertyDescriptor(aliases, specifier)?.value;
	if (!aliasUrl) {
		return nextResolve(specifier, context);
	}

	return { url: aliasUrl, shortCircuit: true };
};

registerHooks({ resolve: resolveAlias });

