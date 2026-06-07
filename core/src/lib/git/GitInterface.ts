export interface GitGraphCommit {
    id: string,
    parentIds: string[],
    refs: string[],
    subject: string,
    timestamp: number | null,
}

export interface GitGraphData {
    commits: GitGraphCommit[],
}

export default interface GitInterface {
    graph(commitIds: readonly string[]): Promise<GitGraphData>,
}
