import React from "react";
import LoadingScreen from "../general/LoadingScreen";
import useCachedGitChordText from "../state/useCachedGitChordText";
import Markdown from "react-markdown";
import { EmptyState, Page } from "../ui/Page";

export default function Help() {
    const help = useCachedGitChordText({
        scope: "global",
        method: "help",
        params: ["--markdown"],
        outputKey: "help",
    });

    if (help === null) {
        return (
            <Page title="CLI Help">
                <LoadingScreen />
            </Page>
        );
    }

    if (help === "") {
        return (
            <Page title="CLI Help">
                <EmptyState title="Failed to load CLI help." />
            </Page>
        );
    }

    return (
        <Page title="CLI Help">
            <div className="gc-markdown">
                <Markdown>{help}</Markdown>
            </div>
        </Page>
    );
}
