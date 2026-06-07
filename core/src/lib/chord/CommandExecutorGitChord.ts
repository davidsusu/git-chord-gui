import CommandExecutorInterface from "../exec/CommandExecutorInterface";
import GitChordInterface from "./GitChordInterface";

export default class CommandExecutorGitChord implements GitChordInterface {
    
    private readonly commandExecutor: CommandExecutorInterface;

    private readonly commandPrefixTokens: string[];

    constructor(commandExecutor: CommandExecutorInterface, commandPrefixTokens: string[]|null = null) {
        this.commandExecutor = commandExecutor;
        this.commandPrefixTokens = commandPrefixTokens?.slice() ?? ["git", "chord"];
    }

    private execAndFetchTextResult(commandSuffixTokens: string[]): Promise<string> {
        const commandTokens = this.commandPrefixTokens.concat(commandSuffixTokens);
        return this.commandExecutor.exec(commandTokens).then(commandResult => {
            if (commandResult.stderr) {
                console.error(commandResult.stderr);
            }
            if (commandResult.status === 0) {
                return commandResult.stdout;
            }
            console.error(`Command returned with a non-zero status: ${commandResult.status}`)
            return "";
        }).catch(e => {
            console.error(e)
            return "";
        })
    }

    private execAndCheckSuccess(commandSuffixTokens: string[]): Promise<boolean> {
        const commandTokens = this.commandPrefixTokens.concat(commandSuffixTokens);
        return this.commandExecutor.exec(commandTokens).then(commandResult => {
            if (commandResult.stderr) {
                console.error(commandResult.stderr);
            }
            if (commandResult.status === 0) {
                return true;
            }
            console.error(`Command returned with a non-zero status: ${commandResult.status}`)
            return false;
        }).catch(e => {
            console.error(e)
            return false;
        })
    }

    version(): Promise<string> {
        return this.execAndFetchTextResult(["version", "--no-color"]);
    }

    help(): Promise<string> {
        return this.execAndFetchTextResult(["help", "--markdown"]);
    }

    state(options: readonly string[] = []): Promise<string> {
        return this.execAndFetchTextResult(["state", ...options, "--no-color", "--no-verbose"]);
    }

    config(options: readonly string[] = []): Promise<string> {
        return this.execAndFetchTextResult(["config", "list", ...options, "--no-color"]);
    }

    configOverrides(): Promise<string> {
        return this.execAndFetchTextResult(["config", "list", "--no-cascade", "--no-color"]);
    }

    configAllOverrides(): Promise<string> {
        return this.execAndFetchTextResult(["config", "list", "--no-cascade", "--all", "--no-color"]);
    }

    configSet(key: string, value: string): Promise<string> {
        return this.execAndFetchTextResult(["config", "set", key, value, "--no-color"]);
    }

    configReset(key: string): Promise<string> {
        return this.execAndFetchTextResult(["config", "reset", key, "--no-color"]);
    }

    list(): Promise<string> {
        return this.execAndFetchTextResult(["list", "--no-color"]);
    }

    showSnapshot(commitId: string): Promise<string> {
        return this.execAndFetchTextResult(["show", "-", commitId, "--no-color", "--no-verbose"]);
    }

    snapshot(targetBranch: string, options: readonly string[] = []): Promise<boolean> {
        return this.execAndCheckSuccess(["snapshot", ...options, "--no-color", "--no-verbose", "-", targetBranch]);
    }

    deleteSnapshot(commitId: string): Promise<boolean> {
        return this.execAndCheckSuccess(["delete", "-", commitId, "--no-color"]);
    }

    specOptions(): Promise<string> {
        return this.execAndFetchTextResult(["spec", "options", "--no-color"]);
    }

}
