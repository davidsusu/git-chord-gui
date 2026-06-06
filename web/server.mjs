#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import net from "node:net";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
import { spawn } from "node:child_process";

const DEFAULT_PORT = 3333;
const HOST = "127.0.0.1";

const webDir = dirname(fileURLToPath(import.meta.url));
const options = parseArgs(process.argv.slice(2));

if (options.help) {
    printHelp();
    process.exit(0);
}

const contextDir = realpathSync(resolve(process.cwd(), options.contextDir ?? process.cwd()));
const repoRoot = resolveRepoRoot(contextDir);
const commandPath = process.env.GIT_CHORD_COMMAND_PATH || inferGitChordCommandPath();
const port = await findAvailablePort(options.port);
const dev = process.env.NODE_ENV !== "production";
const url = `http://${HOST}:${port}`;

process.env.GIT_CHORD_WEB_CONTEXT_DIR = contextDir;
process.env.GIT_CHORD_WEB_REPO_ROOT = repoRoot ?? "";
process.env.GIT_CHORD_WEB_COMMAND_PATH = commandPath;

const app = next({ dev, dir: webDir, hostname: HOST, port });
const handle = app.getRequestHandler();

await app.prepare();

const server = createServer((request, response) => {
    handle(request, response);
});

server.listen(port, HOST, () => {
    log(`Context directory: ${contextDir}`);
    log(`Git repository: ${repoRoot ?? "not detected"}`);
    log(`Git Chord command: ${commandPath || "git chord from PATH"}`);
    log(`GUI URL: ${url}`);
    if (options.launchBrowser) {
        openBrowser(url);
    }
});

process.on("SIGINT", () => {
    server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
});

function parseArgs(args) {
    const result = {
        contextDir: null,
        launchBrowser: false,
        help: false,
        port: Number.parseInt(process.env.PORT || `${DEFAULT_PORT}`, 10) || DEFAULT_PORT,
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "-b" || arg === "--launch-browser") {
            result.launchBrowser = true;
        } else if (arg === "-h" || arg === "--help") {
            result.help = true;
        } else if (arg === "-p" || arg === "--port") {
            const port = Number.parseInt(args[index + 1] ?? "", 10);
            if (!Number.isInteger(port) || port <= 0) {
                fail(`Invalid port: ${args[index + 1] ?? ""}`);
            }
            result.port = port;
            index += 1;
        } else if (arg.startsWith("-")) {
            fail(`Unknown option: ${arg}`);
        } else if (result.contextDir === null) {
            result.contextDir = arg;
        } else {
            fail(`Unexpected argument: ${arg}`);
        }
    }

    return result;
}

function resolveRepoRoot(contextDir) {
    try {
        const stdout = execFileSync("git", ["-C", contextDir, "rev-parse", "--show-toplevel"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        return stdout || null;
    } catch {
        return null;
    }
}

function inferGitChordCommandPath() {
    const guiDir = resolve(webDir, "..");
    const repoRoot = resolve(guiDir, "..");
    const candidate = join(repoRoot, "git-chord", "bin", "git-chord");
    return existsSync(candidate) ? candidate : "";
}

async function findAvailablePort(preferredPort) {
    for (let port = preferredPort; port < preferredPort + 50; port += 1) {
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    fail(`No available local port found starting at ${preferredPort}.`);
}

function isPortAvailable(port) {
    return new Promise(resolve => {
        const probe = net.createServer();
        probe.once("error", () => resolve(false));
        probe.once("listening", () => {
            probe.close(() => resolve(true));
        });
        probe.listen(port, HOST);
    });
}

function openBrowser(url) {
    const command = process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
            ? "cmd"
            : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.unref();
}

function printHelp() {
    console.log(`Usage: node server.mjs [options] [directory]

Options:
  -b, --launch-browser  Open the local GUI URL in the default browser.
  -p, --port <port>     Preferred local port. Defaults to ${DEFAULT_PORT}.
  -h, --help            Show this help.
`);
}

function log(message) {
    console.log(`[git-chord-web] ${message}`);
}

function fail(message) {
    console.error(`[git-chord-web] ERROR: ${message}`);
    process.exit(1);
}
