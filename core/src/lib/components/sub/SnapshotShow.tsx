import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import LoadingScreen from "../general/LoadingScreen";
import { useGlobalContext } from "../state/context";
import { buildContentCacheKey, readFreshCachedContent, repoContentScope, writeCachedContent } from "../state/contentCache";
import { GlobalStateInterface, useGlobalStore } from "../state/state";
import { Button, CodeOutput, EmptyState, Page } from "../ui/Page";
import { CommitId } from "../ui/HighlightedCode";
import { useTranslation } from "../../i18n/useTranslation";

export default function SnapshotShow() {
    const { gitChord, pageGroup } = useGlobalContext();
    const { t } = useTranslation();
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

    return (
        <Page title={t("snapshot.title")} description={<CommitId commitId={commitId} />} actions={actions}>
            <CodeOutput language="yaml">{stripAnsi(output)}</CodeOutput>
        </Page>
    );
}

function stripAnsi(value: string): string {
    return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}
