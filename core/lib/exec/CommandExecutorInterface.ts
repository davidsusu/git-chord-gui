import CommandResult from "./CommandResult";

export default interface CommandExecutorInterface {
    exec(command: string[]): Promise<CommandResult>;
}
