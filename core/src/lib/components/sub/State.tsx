import React from "react";
import Markdown from "react-markdown";
import LoadingScreen from "../general/LoadingScreen";
import { useGlobalContext } from "../state/context";
import { repoContentScope } from "../state/contentCache";
import useCachedGitChordText from "../state/useCachedGitChordText";
import { EmptyState, Page } from "../ui/Page";

export default function State() {
    const { pageGroup } = useGlobalContext();
    const repoRoot = pageGroup.type === "repo" ? pageGroup.repoRoot : null;
    const repoState = useCachedGitChordText({
        scope: repoRoot === null ? null : repoContentScope(repoRoot),
        method: "state",
        params: ["--markdown"],
        outputKey: "repoState",
    });

    if (!repoRoot) {
        return (
            <Page title="Repository State">
                <EmptyState title="No Git repository context is available." />
            </Page>
        );
    }

    if (repoState === null) {
        return (
            <Page title="Repository State" description={repoRoot}>
                <LoadingScreen />
            </Page>
        );
    }

    if (repoState === "") {
        return (
            <Page title="Repository State" description={repoRoot}>
                <EmptyState title="Failed to load repository state." />
            </Page>
        );
    }

    return (
        <Page title="Repository State" description={repoRoot}>
            <div className="gc-markdown">
                <Markdown>{repoState}</Markdown>
            </div>
        </Page>
    );
}
