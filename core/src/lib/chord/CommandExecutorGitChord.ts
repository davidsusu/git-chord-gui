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

    version(): Promise<string> {
        return this.execAndFetchTextResult(["version", "--no-color"]);
    }

    help(): Promise<string> {
        return this.execAndFetchTextResult(["help", "--markdown"]);
    }

    state(): Promise<string> {
        return this.execAndFetchTextResult(["state", "--markdown"]);
    }

    config(): Promise<string> {
        return this.execAndFetchTextResult(["config", "list", "--no-color"]);
    }

    configOverrides(): Promise<string> {
        return this.execAndFetchTextResult(["config", "list", "--no-cascade", "--no-color"]);
    }

    configSet(key: string, value: string): Promise<string> {
        return this.execAndFetchTextResult(["config", "set", key, value, "--no-color"]);
    }

    configReset(key: string): Promise<string> {
        return this.execAndFetchTextResult(["config", "reset", key, "--no-color"]);
    }

    list(): Promise<string> {
        return this.execAndFetchTextResult(["list"]);
    }

}
