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

    state(): Promise<string> {
        return this.provideString("# Mock State\n\n```yaml\nhead:\n  ref: main\n  commitId: MOCK\n```");
    }

    config(): Promise<string> {
        return this.provideString("trackers.prefix chord/\ntrackers.name main\nbranches.store.enabled true");
    }

    configOverrides(): Promise<string> {
        return this.provideString("trackers.name main");
    }

    configSet(key: string, value: string): Promise<string> {
        return this.provideString(`Set ${key} ${value}`);
    }

    configReset(key: string): Promise<string> {
        return this.provideString(`Reset ${key}`);
    }

    list(): Promise<string> {
        return this.provideString("f475443 Chord repository state at 2025-05-30T21:56:23Z");
    }

}
