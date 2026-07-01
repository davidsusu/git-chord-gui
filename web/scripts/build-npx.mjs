#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, "..");
const packageDistDir = resolve(projectDir, "package-dist");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const env = { ...process.env };

delete env.LD_LIBRARY_PATH;

run(npmCommand, ["run", "build"]);
mkdirSync(packageDistDir, { recursive: true });
run(npmCommand, ["pack", "--pack-destination", packageDistDir]);

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: projectDir,
        env,
        stdio: "inherit",
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}
