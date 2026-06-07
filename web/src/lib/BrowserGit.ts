import type { GitGraphData, GitInterface } from "@git-chord/gui-core";

export default class BrowserGit implements GitInterface {

    async graph(commitIds: readonly string[]): Promise<GitGraphData> {
        const response = await fetch("/api/git/graph", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ commitIds }),
        });
        if (!response.ok) {
            return { commits: [] };
        }

        const result = await response.json().catch(() => null) as GitGraphData | null;
        return {
            commits: Array.isArray(result?.commits) ? result.commits : [],
        };
    }

}
