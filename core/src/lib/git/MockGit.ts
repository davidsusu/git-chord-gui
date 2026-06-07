import GitInterface, { GitGraphData } from "./GitInterface";

export default class MockGit implements GitInterface {

    graph(): Promise<GitGraphData> {
        return Promise.resolve({ commits: [] });
    }

}
