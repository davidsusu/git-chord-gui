import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LoadingScreen from "../general/LoadingScreen";
import { useGlobalContext } from "../state/context";
import { buildContentCacheKey, readFreshCachedContent, repoContentScope, writeCachedContent } from "../state/contentCache";
import { GlobalStateInterface, useGlobalStore } from "../state/state";
import { Badge, Button, EmptyState, Page } from "../ui/Page";
import { CommitId } from "../ui/HighlightedCode";
import { useTranslation } from "../../i18n/useTranslation";
import SnapshotDataTabs from "./SnapshotDataTabs";
import { parseSnapshotStateYaml, SnapshotRef } from "./snapshotModel";

export default function SnapshotShow() {
    const { gitChord, pageGroup } = useGlobalContext();
    const { language, t } = useTranslation();
    const navigate = useNavigate();
    const { commitId = "" } = useParams();
    const update = useGlobalStore((state) => state.update);
    const repoRoot = pageGroup.type === "repo" ? pageGroup.repoRoot : null;
    const repoScope = repoRoot === null ? null : repoContentScope(repoRoot);
    const cacheKey = useMemo(() => {
        if (repoScope === null || commitId === "") {
            return null;
        }
        return buildContentCacheKey(repoScope, "showSnapshot", [commitId]);
    }, [commitId, repoScope]);
    const [output, setOutput] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        if (cacheKey === null || commitId === "") {
            setOutput("");
            return () => { cancelled = true; };
        }

        const cachedContent = readFreshCachedContent(useGlobalStore.getState(), cacheKey);
        if (cachedContent !== undefined) {
            setOutput(cachedContent);
            return () => { cancelled = true; };
        }

        setOutput(null);
        gitChord.showSnapshot(commitId).then(commandOutput => {
            if (!cancelled) {
                setOutput(commandOutput);
                update((state: GlobalStateInterface) => {
                    writeCachedContent(state, cacheKey, commandOutput);
                });
            }
        });

        return () => { cancelled = true; };
    }, [cacheKey, commitId, gitChord, update]);

    const actions = (
        <Button type="button" variant="ghost" onClick={() => navigate("/list")}>
            <span className="gc-button-inline-icon" aria-hidden="true">←</span>
            {t("snapshot.backToHistory")}
        </Button>
    );

    if (!repoRoot) {
        return (
            <Page title={t("snapshot.title")} actions={actions}>
                <EmptyState title={t("repo.noContextAvailable")} />
            </Page>
        );
    }

    if (commitId === "") {
        return (
            <Page title={t("snapshot.title")} description={repoRoot} actions={actions}>
                <EmptyState title={t("snapshot.noCommit")} />
            </Page>
        );
    }

    if (output === null) {
        return (
            <Page title={t("snapshot.title")} description={<CommitId commitId={commitId} />} actions={actions}>
                <LoadingScreen />
            </Page>
        );
    }

    if (output === "") {
        return (
            <Page title={t("snapshot.title")} description={<CommitId commitId={commitId} />} actions={actions}>
                <EmptyState title={t("snapshot.failed")} />
            </Page>
        );
    }

    const model = parseSnapshotStateYaml(output);

    return (
        <Page title={t("snapshot.title")} description={<CommitId commitId={commitId} />} actions={actions}>
            <div className="gc-snapshot-detail">
                <section className="gc-snapshot-summary">
                    <h2 className="gc-section-title">{t("snapshot.summary")}</h2>
                    <dl className="gc-snapshot-summary-grid">
                        <div>
                            <dt>{t("list.commit")}</dt>
                            <dd><CommitId commitId={commitId} /></dd>
                        </div>
                        <div>
                            <dt>{t("snapshot.timestamp")}</dt>
                            <dd>{model.timestamp ? formatTimestamp(model.timestamp, language) : t("common.unknown")}</dd>
                        </div>
                        <div>
                            <dt>{t("snapshot.references")}</dt>
                            <dd>{model.refs.length}</dd>
                        </div>
                    </dl>
                </section>
                <SnapshotReferences refs={model.refs} />
                <SnapshotDataTabs output={output} focusCommitId={commitId} />
            </div>
        </Page>
    );
}

function SnapshotReferences({ refs }: { refs: SnapshotRef[] }) {
    const { t } = useTranslation();

    return (
        <section className="gc-snapshot-references">
            <h2 className="gc-section-title">{t("snapshot.references")}</h2>
            {refs.length === 0 ? (
                <EmptyState title={t("snapshot.noReferences")} />
            ) : (
                <div className="gc-table-wrap">
                    <table className="gc-config-table gc-snapshot-reference-table">
                        <thead>
                            <tr>
                                <th>{t("snapshot.kind")}</th>
                                <th>{t("snapshot.reference")}</th>
                                <th>{t("list.commit")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {refs.map((ref, index) => (
                                <tr key={`${ref.type}-${ref.name}-${ref.commitId}-${index}`}>
                                    <td><Badge>{refTypeLabel(ref.type, t)}</Badge></td>
                                    <td><code className="gc-code">{ref.name}</code></td>
                                    <td><CommitId commitId={ref.commitId} className="gc-commit-code" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function refTypeLabel(type: SnapshotRef["type"], t: ReturnType<typeof useTranslation>["t"]): string {
    switch (type) {
        case "branch":
            return t("snapshot.branch");
        case "tag":
            return t("snapshot.tag");
        case "head":
            return t("snapshot.head");
        case "staging":
            return t("snapshot.stagingArea");
        case "working":
            return t("snapshot.workingTree");
        default:
            return type;
    }
}

function formatTimestamp(timestamp: string, language: string): string {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return timestamp;
    }

    return date.toLocaleString(language, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
