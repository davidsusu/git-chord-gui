import { parse } from "yaml";

export interface SnapshotRef {
    type: "branch" | "tag" | "head" | "staging" | "working",
    name: string,
    commitId: string,
}

export interface SnapshotStateModel {
    raw: unknown,
    timestamp: string | null,
    refs: SnapshotRef[],
}

const COMMIT_ID_PATTERN = /^[0-9a-fA-F]{7,40}$/;

export function parseSnapshotStateYaml(output: string): SnapshotStateModel {
    const raw = parseSnapshotYaml(output);
    return {
        raw,
        timestamp: stringValue(property(raw, "timestamp")),
        refs: collectSnapshotRefs(raw),
    };
}

export function collectSnapshotCommitIds(model: SnapshotStateModel): string[] {
    return unique(model.refs.map(ref => ref.commitId));
}

export function isCommitId(value: unknown): value is string {
    return typeof value === "string" && COMMIT_ID_PATTERN.test(value);
}

function parseSnapshotYaml(output: string): unknown {
    try {
        return parse(output);
    } catch {
        return null;
    }
}

function collectSnapshotRefs(raw: unknown): SnapshotRef[] {
    const refs: SnapshotRef[] = [];

    const branches = recordValue(property(raw, "branches"));
    Object.entries(branches).forEach(([name, value]) => {
        const commitId = commitIdValue(value);
        if (commitId) {
            refs.push({ type: "branch", name, commitId });
        }
    });

    collectTagRefs(refs, property(raw, "annotatedTags"), "tag");
    collectTagRefs(refs, property(raw, "lightweightTags"), "tag");
    collectTagRefs(refs, property(raw, "lightWeightTags"), "tag");
    collectTagRefs(refs, property(raw, "tags"), "tag");

    const head = recordValue(property(raw, "head"));
    const headCommitId = commitIdValue(head.commitId);
    if (headCommitId) {
        refs.push({
            type: "head",
            name: stringValue(head.ref) ?? stringValue(head.pointingTo) ?? "HEAD",
            commitId: headCommitId,
        });
    }

    addNamedCommitRef(refs, "staging", "stagingArea", property(raw, "stagingArea"));
    addNamedCommitRef(refs, "working", "workingTree", property(raw, "workingTree"));

    return refs;
}

function collectTagRefs(refs: SnapshotRef[], value: unknown, type: SnapshotRef["type"]) {
    Object.entries(recordValue(value)).forEach(([name, item]) => {
        const commitId = commitIdValue(item);
        if (commitId) {
            refs.push({ type, name, commitId });
        }
    });
}

function addNamedCommitRef(refs: SnapshotRef[], type: SnapshotRef["type"], name: string, value: unknown) {
    const commitId = commitIdValue(value);
    if (commitId) {
        refs.push({ type, name, commitId });
    }
}

function commitIdValue(value: unknown): string | null {
    if (isCommitId(value)) {
        return value;
    }

    const record = recordValue(value);
    return isCommitId(record.commitId) ? record.commitId : null;
}

function property(value: unknown, key: string): unknown {
    return recordValue(value)[key];
}

function recordValue(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function stringValue(value: unknown): string | null {
    return typeof value === "string" && value.trim() !== "" ? value : null;
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values));
}
