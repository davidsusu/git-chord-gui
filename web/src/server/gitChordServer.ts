import { execFile } from "node:child_process";

export type ExecResult = {
    status: number,
    stdout: string,
    stderr: string,
};

const COMMIT_ID_PATTERN = /^[0-9a-f]{7,40}$/i;

export function isGitChordCommand(command: unknown): command is string[] {
    return Array.isArray(command) &&
        command.every(part => typeof part === "string") &&
        command.length >= 2 &&
        command[0] === "git" &&
        command[1] === "chord";
}

export function isCommitId(value: string): boolean {
    return COMMIT_ID_PATTERN.test(value);
}

export function execGitChordCommand(command: string[]): Promise<ExecResult> {
    const configuredCommandPath = process.env.GIT_CHORD_WEB_COMMAND_PATH?.trim();
    const file = configuredCommandPath || command[0];
    const args = configuredCommandPath ? command.slice(2) : command.slice(1);
    return execCommand(file, args, commandWorkingDirectory(), 20 * 1024 * 1024);
}

export function execGitShowCommit(commitId: string): Promise<ExecResult> {
    return execCommand("git", [
        "-C",
        commandWorkingDirectory(),
        "show",
        "--stat",
        "--patch",
        "--find-renames",
        "--find-copies",
        "--color=never",
        commitId,
    ], commandWorkingDirectory(), 30 * 1024 * 1024);
}

function commandWorkingDirectory(): string {
    return process.env.GIT_CHORD_WEB_REPO_ROOT ||
        process.env.GIT_CHORD_WEB_CONTEXT_DIR ||
        process.cwd();
}

function execCommand(file: string, args: string[], cwd: string, maxBuffer: number): Promise<ExecResult> {
    return new Promise(resolve => {
        execFile(file, args, {
            cwd,
            maxBuffer,
            windowsHide: true,
        }, (error, stdout, stderr) => {
            const status = typeof error?.code === "number" ? error.code : (error ? 1 : 0);
            resolve({ status, stdout, stderr: stderr || error?.message || "" });
        });
    });
}
