import React from "react";
import LoadingScreen from "../general/LoadingScreen";
import { useGlobalContext } from "../state/context";
import { repoContentScope } from "../state/contentCache";
import { TextOutputKey } from "../state/state";
import useCachedGitChordText from "../state/useCachedGitChordText";
import { CodeOutput, EmptyState, Page } from "../ui/Page";
import { useTranslation } from "../../i18n/useTranslation";

interface RepoTextCommandProps {
    title: string,
    outputKey: Extract<TextOutputKey, "repoConfig" | "repoList">,
    command: "config" | "list",
}

export default function RepoTextCommand({ title, outputKey, command }: RepoTextCommandProps) {
    const { pageGroup } = useGlobalContext();
    const { t } = useTranslation();
    const repoRoot = pageGroup.type === "repo" ? pageGroup.repoRoot : null;
    const output = useCachedGitChordText({
        scope: repoRoot === null ? null : repoContentScope(repoRoot),
        method: command,
        outputKey,
    });

    if (!repoRoot) {
        return (
            <Page title={title}>
                <EmptyState title={t("repo.noContextAvailable")} />
            </Page>
        );
    }

    if (output === null) {
        return (
            <Page title={title} description={repoRoot}>
                <LoadingScreen />
            </Page>
        );
    }

    if (output === "") {
        return (
            <Page title={title} description={repoRoot}>
                <EmptyState title={t("config.failed")} />
            </Page>
        );
    }

    return (
        <Page title={title} description={repoRoot}>
            <CodeOutput>{output}</CodeOutput>
        </Page>
    );
}
