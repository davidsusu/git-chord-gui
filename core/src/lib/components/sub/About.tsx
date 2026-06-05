import React from "react";
import { useTranslation } from "../../i18n/useTranslation";
import useCachedGitChordText from "../state/useCachedGitChordText";
import { Page } from "../ui/Page";

export default function About() {
    const { t } = useTranslation();
    const version = useCachedGitChordText({
        scope: "global",
        method: "version",
        params: ["--no-color"],
        outputKey: "version",
    });

    return (
        <Page title={t("about.title")} description={t("about.description")}>
            <dl className="gc-meta-list">
                <dt>{t("about.version")}</dt>
                <dd>{version === null ? t("common.loading") : (version || t("about.unavailable"))}</dd>
                <dt>{t("about.author")}</dt>
                <dd>{t("about.authorName")}</dd>
                <dt>{t("about.project")}</dt>
                <dd>
                    <a className="gc-link" href="https://github.com/davidsusu/git-chord" target="_blank" rel="noreferrer">
                        https://github.com/davidsusu/git-chord
                    </a>
                </dd>
            </dl>
        </Page>
    );
}
