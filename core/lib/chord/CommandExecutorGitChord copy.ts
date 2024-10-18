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
        const comandTokens = this.commandPrefixTokens.concat(commandSuffixTokens);
        return this.commandExecutor.exec(comandTokens).then(commandResult => {
            if (commandResult.stderr) {
                console.error(commandResult.stderr);
            }
            if (commandResult.status == 0) {
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

}
