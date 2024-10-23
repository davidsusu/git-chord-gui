import GitChordInterface from "./GitChordInterface";

export default class MockGitChord implements GitChordInterface {
    
    private readonly latency: number;

    constructor(latency: number = 300) {
        this.latency = latency;
    }

    private provideString(value: string): Promise<string> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(value);
            }, this.latency);
        });
    }

    version(): Promise<string> {
        return this.provideString("99.0.0-MOCK");
    }

    help(): Promise<string> {
        return this.provideString("# Mock Help\n\n## Hello World\n\nLorem ipsum dolor sit amet.");
    }

}
