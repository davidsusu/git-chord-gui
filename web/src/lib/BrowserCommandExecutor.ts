import { CommandResult, translate } from "@git-chord/gui-core";
import type { CommandExecutorInterface, LanguageCode } from "@git-chord/gui-core";

export default class BrowserCommandExecutor implements CommandExecutorInterface {

    private nextRequestId = 1;

    constructor(private readonly getLanguage: () => LanguageCode) {}

    async exec(command: string[]): Promise<CommandResult> {
        const abortController = new AbortController();
        const timeoutId = window.setTimeout(() => abortController.abort(), 30000);
        const requestId = `${this.nextRequestId++}`;

        try {
            const response = await fetch("/api/exec", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-git-chord-request-id": requestId,
                },
                body: JSON.stringify({ command }),
                signal: abortController.signal,
            });
            const result = await response.json().catch(() => null) as {
                status?: number,
                stdout?: string,
                stderr?: string,
            } | null;

            return new CommandResult(
                result?.status ?? (response.ok ? 0 : 1),
                result?.stdout ?? "",
                result?.stderr ?? (response.ok ? "" : response.statusText),
            );
        } catch (error) {
            const stderr = error instanceof DOMException && error.name === "AbortError"
                ? translate(this.getLanguage(), "extension.timeout")
                : String(error);
            return new CommandResult(1, "", stderr);
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

}
