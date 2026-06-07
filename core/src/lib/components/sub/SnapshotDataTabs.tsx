import React, { useEffect, useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { GitBranch, Network } from "lucide-react";
import type { GitGraphCommit, GitGraphData } from "../../git/GitInterface";
import { useTranslation } from "../../i18n/useTranslation";
import { useGlobalContext } from "../state/context";
import { EmptyState } from "../ui/Page";
import { HighlightedCode } from "../ui/HighlightedCode";
import { collectSnapshotCommitIds, parseSnapshotStateYaml, SnapshotRef } from "./snapshotModel";

type SnapshotTab = "yaml" | "graph";

interface SnapshotDataTabsProps {
    output: string,
    focusCommitId?: string,
    collapsed?: boolean,
    onExpandRequest?: () => void,
    codeClassName?: string,
}

const MAX_GRAPH_COMMITS = 80;

export default function SnapshotDataTabs({
    output,
    focusCommitId,
    collapsed = false,
    onExpandRequest,
    codeClassName = "",
}: SnapshotDataTabsProps) {
    const { git } = useGlobalContext();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<SnapshotTab>("yaml");
    const [graph, setGraph] = useState<GitGraphData | null>(null);
    const [graphLoading, setGraphLoading] = useState(false);
    const model = useMemo(() => parseSnapshotStateYaml(output), [output]);
    const commitIds = useMemo(() => {
        const ids = collectSnapshotCommitIds(model);
        if (focusCommitId && !ids.includes(focusCommitId)) {
            ids.unshift(focusCommitId);
        }
        return ids;
    }, [focusCommitId, model]);

    useEffect(() => {
        let cancelled = false;
        if (commitIds.length === 0) {
            setGraph({ commits: [] });
            setGraphLoading(false);
            return () => { cancelled = true; };
        }

        setGraphLoading(true);
        git.graph(commitIds).then(nextGraph => {
            if (!cancelled) {
                setGraph(nextGraph);
                setGraphLoading(false);
            }
        }).catch(error => {
            console.error(error);
            if (!cancelled) {
                setGraph({ commits: [] });
                setGraphLoading(false);
            }
        });

        return () => { cancelled = true; };
    }, [commitIds, git]);

    function handleTabChange(value: string) {
        if (collapsed) {
            onExpandRequest?.();
        }
        setActiveTab(value === "graph" ? "graph" : "yaml");
    }

    function handleTabClick() {
        if (collapsed) {
            onExpandRequest?.();
        }
    }

    return (
        <Tabs.Root className="gc-snapshot-tabs" value={activeTab} onValueChange={handleTabChange}>
            <Tabs.List className="gc-snapshot-tabs-list" aria-label={t("snapshot.tabs")}>
                <Tabs.Trigger className="gc-snapshot-tab-trigger" value="yaml" onClick={handleTabClick}>
                    <GitBranch className="gc-tab-icon" aria-hidden="true" />
                    <span>{t("snapshot.yaml")}</span>
                </Tabs.Trigger>
                <Tabs.Trigger className="gc-snapshot-tab-trigger" value="graph" onClick={handleTabClick}>
                    <Network className="gc-tab-icon" aria-hidden="true" />
                    <span>{t("snapshot.graph")}</span>
                </Tabs.Trigger>
            </Tabs.List>
            <div className="gc-snapshot-tabs-content-shell" data-collapsed={collapsed ? "true" : undefined}>
                <Tabs.Content className="gc-snapshot-tab-content" value="yaml">
                    <HighlightedCode code={output} language="yaml" className={codeClassName} />
                </Tabs.Content>
                <Tabs.Content className="gc-snapshot-tab-content" value="graph">
                    {graphLoading || graph === null ? (
                        <EmptyState title={t("snapshot.graphLoading")} />
                    ) : (
                        <SnapshotGraph
                            graph={graph}
                            refs={model.refs}
                            commitIds={commitIds}
                            focusCommitId={focusCommitId}
                        />
                    )}
                </Tabs.Content>
                {collapsed ? <div className="gc-state-output-fade" aria-hidden="true" /> : null}
            </div>
        </Tabs.Root>
    );
}

function SnapshotGraph({
    graph,
    refs,
    commitIds,
    focusCommitId,
}: {
    graph: GitGraphData,
    refs: SnapshotRef[],
    commitIds: string[],
    focusCommitId?: string,
}) {
    const { onCommitOpen } = useGlobalContext();
    const { t, language } = useTranslation();
    const commits = useMemo(
        () => buildGraphRows(graph, commitIds).slice(0, MAX_GRAPH_COMMITS),
        [commitIds, graph],
    );
    const refLabelsByCommit = useMemo(() => groupRefLabels(refs), [refs]);

    if (commits.length === 0) {
        return <EmptyState title={t("snapshot.graphUnavailable")} />;
    }

    const rowHeight = 46;
    const width = 920;
    const height = 34 + commits.length * rowHeight;
    const graphX = 34;
    const textX = 68;
    const rowByCommit = new Map(commits.map((commit, index) => [commit.id, index]));

    function commitY(index: number) {
        return 26 + index * rowHeight;
    }

    function openCommit(commitId: string) {
        onCommitOpen?.(commitId);
    }

    return (
        <div className="gc-snapshot-graph-wrap">
            <svg
                className="gc-snapshot-graph"
                role="img"
                aria-label={t("snapshot.graph")}
                viewBox={`0 0 ${width} ${height}`}
            >
                {commits.flatMap((commit, childIndex) => (
                    commit.parentIds
                        .map(parentId => ({ parentId, parentIndex: rowByCommit.get(parentId) }))
                        .filter(item => item.parentIndex !== undefined)
                        .map(item => (
                            <line
                                key={`${commit.id}-${item.parentId}`}
                                className="gc-snapshot-graph-edge"
                                x1={graphX}
                                x2={graphX}
                                y1={commitY(childIndex) + 8}
                                y2={commitY(item.parentIndex as number) - 8}
                            />
                        ))
                ))}
                {commits.map((commit, index) => {
                    const y = commitY(index);
                    const shortId = commit.id.slice(0, 12);
                    const labels = refLabelsByCommit.get(commit.id) ?? [];
                    const metadata = [
                        commit.timestamp ? formatGraphTimestamp(commit.timestamp, language) : null,
                        labels.length > 0 ? labels.join(", ") : null,
                        commit.refs.length > 0 ? commit.refs.join(", ") : null,
                    ].filter(Boolean).join(" · ");
                    return (
                        <g
                            key={commit.id}
                            className="gc-snapshot-graph-node"
                            data-focus={focusCommitId === commit.id ? "true" : undefined}
                            role={onCommitOpen ? "button" : undefined}
                            tabIndex={onCommitOpen ? 0 : undefined}
                            onClick={() => openCommit(commit.id)}
                            onKeyDown={event => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    openCommit(commit.id);
                                }
                            }}
                        >
                            <circle className="gc-snapshot-graph-dot" cx={graphX} cy={y} r={7} />
                            <text className="gc-snapshot-graph-id" x={textX} y={y - 4}>{shortId}</text>
                            <text className="gc-snapshot-graph-subject" x={textX + 112} y={y - 4}>
                                {commit.subject || t("snapshot.commit")}
                            </text>
                            {metadata ? (
                                <text className="gc-snapshot-graph-meta" x={textX} y={y + 16}>{metadata}</text>
                            ) : null}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function buildGraphRows(graph: GitGraphData, commitIds: string[]): GitGraphCommit[] {
    const rows = new Map<string, GitGraphCommit>();
    graph.commits.forEach(commit => rows.set(commit.id, normalizeCommit(commit)));
    commitIds.forEach(commitId => {
        if (!rows.has(commitId)) {
            rows.set(commitId, {
                id: commitId,
                parentIds: [],
                refs: [],
                subject: "",
                timestamp: null,
            });
        }
    });
    return Array.from(rows.values());
}

function normalizeCommit(commit: GitGraphCommit): GitGraphCommit {
    return {
        id: commit.id,
        parentIds: commit.parentIds ?? [],
        refs: commit.refs ?? [],
        subject: commit.subject ?? "",
        timestamp: typeof commit.timestamp === "number" ? commit.timestamp : null,
    };
}

function groupRefLabels(refs: SnapshotRef[]): Map<string, string[]> {
    const labels = new Map<string, string[]>();
    refs.forEach(ref => {
        const existingLabels = labels.get(ref.commitId) ?? [];
        existingLabels.push(ref.type === "head" ? `HEAD:${ref.name}` : ref.name);
        labels.set(ref.commitId, existingLabels);
    });
    return labels;
}

function formatGraphTimestamp(timestamp: number, language: string): string {
    const date = new Date(timestamp * 1000);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString(language, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
