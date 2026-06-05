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

    state(options: readonly string[] = []): Promise<string> {
        const optionText = options.length === 0 ? "none" : options.join(" ");
        return this.provideString(`options: '${optionText}'\nhead:\n  ref: main\n  commitId: MOCK`);
    }

    config(options: readonly string[] = []): Promise<string> {
        const prefix = findOptionValue(options, "--trackers-prefix") ?? "chord/";
        const name = findOptionValue(options, "--trackers-name") ?? "main";
        return this.provideString(`trackers.prefix ${prefix}\ntrackers.name ${name}\nbranches.store.enabled true`);
    }

    configOverrides(): Promise<string> {
        return this.provideString("trackers.name main");
    }

    configAllOverrides(): Promise<string> {
        return this.provideString("trackers.name main\nprofile.review.branches.store.enabled true\nprofile.review.workingtree.store.enabled true");
    }

    configSet(key: string, value: string): Promise<string> {
        return this.provideString(`Set ${key} ${value}`);
    }

    configReset(key: string): Promise<string> {
        return this.provideString(`Reset ${key}`);
    }

    list(): Promise<string> {
        return this.provideString("f475443 Chord repository state at 2025-05-30T21:56:23Z\n9abc012 Chord repository state at 2025-05-29T19:10:11Z");
    }

    showSnapshot(commitId: string): Promise<string> {
        return this.provideString(`timestamp: '2025-05-30T21:56:23Z'\ncommit: '${commitId}'\nhead:\n  ref: main\n  commitId: MOCK`);
    }

    snapshot(_targetBranch: string, _options: readonly string[] = []): Promise<boolean> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(true);
            }, this.latency);
        });
    }

    deleteSnapshot(_commitId: string): Promise<boolean> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(true);
            }, this.latency);
        });
    }

    specOptions(): Promise<string> {
        return this.provideString("--trackers-prefix=\n--trackers-name=\n--branches-store-enabled\n--no-branches-store-enabled\n--workingtree-store-enabled\n--no-workingtree-store-enabled\n--markdown\n--no-markdown\n--color\n--no-color\n--profile=");
    }

}

function findOptionValue(options: readonly string[], token: string): string | null {
    const inlinePrefix = `${token}=`;
    for (let index = 0; index < options.length; index += 1) {
        const option = options[index];
        if (option.startsWith(inlinePrefix)) {
            return option.slice(inlinePrefix.length);
        }
        if (option === token && index + 1 < options.length) {
            return options[index + 1];
        }
    }
    return null;
}
