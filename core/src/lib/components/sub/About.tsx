import React from "react";
import useCachedGitChordText from "../state/useCachedGitChordText";
import { Page } from "../ui/Page";

export default function About() {
    const version = useCachedGitChordText({
        scope: "global",
        method: "version",
        params: ["--no-color"],
        outputKey: "version",
    });

    return (
        <Page title="About" description="Git Chord GUI.">
            <dl className="gc-meta-list">
                <dt>Version</dt>
                <dd>{version === null ? "Loading..." : (version || "Unavailable")}</dd>
                <dt>Project</dt>
                <dd>
                    <a className="gc-link" href="https://github.com/davidsusu/git-chord" rel="noreferrer">
                        github.com/davidsusu/git-chord
                    </a>
                </dd>
            </dl>
        </Page>
    );
}
