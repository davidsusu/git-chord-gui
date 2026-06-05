import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "../general/LoadingScreen";
import { useGlobalContext } from "../state/context";
import { buildContentCacheKey, repoContentScope, writeCachedContent } from "../state/contentCache";
import { GlobalStateInterface, useGlobalStore } from "../state/state";
import useCachedGitChordText from "../state/useCachedGitChordText";
import { Button, EmptyState, IconButton, Page } from "../ui/Page";
import { CommitId, CommitLinkedText } from "../ui/HighlightedCode";
import { useTranslation } from "../../i18n/useTranslation";
import type { MessageKey, TranslationValues } from "../../i18n";

const CREATE_SNAPSHOT_INTENT = { type: "createSnapshot" as const };

interface SnapshotEntry {
    commitId: string,
    title: string,
    message: string,
    timestamp: string | null,
}

export default function List() {
    const { gitChord, pageGroup, currentRepoRoot, openPage } = useGlobalContext();
    const { language, t } = useTranslation();
    const navigate = useNavigate();
    const update = useGlobalStore((state) => state.update);
    const repoRoot = pageGroup.type === "repo" ? pageGroup.repoRoot : null;
    const repoScope = repoRoot === null ? null : repoContentScope(repoRoot);
    const output = useCachedGitChordText({
        scope: repoScope,
        method: "list",
        outputKey: "repoList",
    });
    const snapshots = useMemo(() => parseSnapshotList(output ?? "", t), [output, t]);
    const [deleteTarget, setDeleteTarget] = useState<SnapshotEntry | null>(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    function openCreateSnapshot() {
        if (pageGroup.type === "repo") {
            navigate("/", { state: { intent: CREATE_SNAPSHOT_INTENT } });
            return;
        }

        if (currentRepoRoot && openPage) {
            openPage({ type: "repo", repoRoot: currentRepoRoot, path: "/", intent: CREATE_SNAPSHOT_INTENT });
            return;
        }

        if (openPage) {
            openPage({ type: "currentRepo", path: "/", intent: CREATE_SNAPSHOT_INTENT });
        }
    }

    function openSnapshot(entry: SnapshotEntry) {
        navigate(`/show/${encodeURIComponent(entry.commitId)}`);
    }

    function requestDelete(entry: SnapshotEntry) {
        setDeleteTarget(entry);
        setDeleteError(null);
    }

    function cancelDelete() {
        if (deleteBusy) {
            return;
        }
        setDeleteTarget(null);
        setDeleteError(null);
    }

    function confirmDelete() {
        if (!deleteTarget || deleteBusy) {
            return;
        }

        const commitId = deleteTarget.commitId;
        setDeleteBusy(true);
        setDeleteError(null);
        gitChord.deleteSnapshot(commitId).then(succeeded => {
            setDeleteBusy(false);
            if (!succeeded) {
                setDeleteError(t("list.deleteError"));
                return;
            }

            setDeleteTarget(null);
            updateSnapshotHistoryAfterDelete(commitId);
        });
    }

    function updateSnapshotHistoryAfterDelete(commitId: string) {
        if (repoScope === null || output === null) {
            return;
        }

        const nextOutput = removeSnapshotLine(output, commitId);
        const listCacheKey = buildContentCacheKey(repoScope, "list");
        const snapshotCacheKey = buildContentCacheKey(repoScope, "showSnapshot", [commitId]);
        update((state: GlobalStateInterface) => {
            state.repoList = nextOutput;
            writeCachedContent(state, listCacheKey, nextOutput);
            delete state.contentCache[snapshotCacheKey];
        });
    }

    const actions = repoRoot ? (
        <IconButton type="button" label={t("state.createSnapshot")} onClick={openCreateSnapshot}>
            +
        </IconButton>
    ) : null;

    if (!repoRoot) {
        return (
            <Page title={t("list.title")}>
                <EmptyState title={t("repo.noContextAvailable")} />
            </Page>
        );
    }

    if (output === null) {
        return (
            <Page title={t("list.title")} description={repoRoot} actions={actions}>
                <LoadingScreen />
            </Page>
        );
    }

    if (output === "") {
        return (
            <Page title={t("list.title")} description={repoRoot} actions={actions}>
                <EmptyState title={t("list.noSnapshots")} />
            </Page>
        );
    }

    return (
        <>
            <Page title={t("list.title")} description={repoRoot} actions={actions}>
                {snapshots.length === 0 ? (
                    <EmptyState title={t("list.noSnapshots")} />
                ) : (
                    <div className="gc-table-wrap gc-snapshot-table-wrap">
                        <table className="gc-config-table gc-snapshot-table">
                            <thead>
                                <tr>
                                    <th>{t("list.commit")}</th>
                                    <th>{t("list.snapshot")}</th>
                                    <th>{t("list.created")}</th>
                                    <th>{t("common.action")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {snapshots.map(entry => (
                                    <tr key={entry.commitId}>
                                        <td>
                                            <CommitId commitId={entry.commitId} className="gc-commit-code" />
                                        </td>
                                        <td>
                                            <div className="gc-snapshot-title"><CommitLinkedText text={entry.title} /></div>
                                            {entry.message !== entry.title ? (
                                                <div className="gc-snapshot-message"><CommitLinkedText text={entry.message} /></div>
                                            ) : null}
                                        </td>
                                        <td>
                                            {entry.timestamp ? (
                                                <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp, language)}</time>
                                            ) : (
                                                <span className="gc-muted">{t("common.unknown")}</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="gc-snapshot-actions">
                                                <Button type="button" size="small" onClick={() => openSnapshot(entry)}>
                                                    <span className="gc-button-inline-icon" aria-hidden="true">↗</span>
                                                    {t("list.show")}
                                                </Button>
                                                <Button type="button" variant="ghost" size="small" className="gc-button-danger" onClick={() => requestDelete(entry)}>
                                                    <span className="gc-button-inline-icon" aria-hidden="true">×</span>
                                                    {t("list.delete")}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Page>
            {deleteTarget ? (
                <ConfirmDeleteDialog
                    snapshot={deleteTarget}
                    busy={deleteBusy}
                    error={deleteError}
                    t={t}
                    onCancel={cancelDelete}
                    onConfirm={confirmDelete}
                />
            ) : null}
        </>
    );
}

function ConfirmDeleteDialog({
    snapshot,
    busy,
    error,
    t,
    onCancel,
    onConfirm,
}: {
    snapshot: SnapshotEntry,
    busy: boolean,
    error: string | null,
    t(key: MessageKey, values?: TranslationValues): string,
    onCancel(): void,
    onConfirm(): void,
}) {
    return (
        <div className="gc-modal-backdrop">
            <section className="gc-modal" role="dialog" aria-modal="true" aria-labelledby="gc-delete-snapshot-title">
                <h2 id="gc-delete-snapshot-title" className="gc-modal-title">{t("list.deleteTitle")}</h2>
                <p className="gc-modal-text">
                    {t("list.deleteMessagePrefix")} <CommitId commitId={snapshot.commitId} /> {t("list.deleteMessageSuffix")}
                </p>
                {error ? <div className="gc-modal-error">{error}</div> : null}
                <div className="gc-modal-actions">
                    <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
                        {t("common.cancel")}
                    </Button>
                    <Button type="button" className="gc-button-danger" disabled={busy} onClick={onConfirm}>
                        {busy ? t("list.deleteBusy") : t("list.delete")}
                    </Button>
                </div>
            </section>
        </div>
    );
}

function parseSnapshotList(output: string, t: (key: "list.snapshotFallback") => string): SnapshotEntry[] {
    return stripAnsi(output).split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line !== "")
        .map(line => {
            const match = line.match(/^([0-9a-fA-F]+)\s+(.*)$/);
            const commitId = match?.[1] ?? line;
            const message = match?.[2] ?? "";
            const timestampMatch = message.match(/\bat\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)$/);
            const timestamp = timestampMatch?.[1] ?? null;
            const title = timestampMatch
                ? message.slice(0, timestampMatch.index).trim()
                : message;

            return {
                commitId,
                title: title || t("list.snapshotFallback"),
                message: message || t("list.snapshotFallback"),
                timestamp,
            };
        });
}

function removeSnapshotLine(output: string, commitId: string): string {
    return output.split(/\r?\n/)
        .filter(line => {
            const lineCommitId = stripAnsi(line).trim().split(/\s+/, 1)[0];
            return lineCommitId !== commitId;
        })
        .join("\n");
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

function stripAnsi(value: string): string {
    return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}
