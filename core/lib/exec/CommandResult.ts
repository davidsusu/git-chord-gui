export default class CommandResult {
    
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
    
    constructor(status: number = 0, stdout: string = "", stderr: string = "") {
        this.status = status;
        this.stdout = stdout;
        this.stderr = stderr;
    }

}