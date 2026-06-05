import React, { MouseEvent, useMemo } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import diff from "highlight.js/lib/languages/diff";
import plaintext from "highlight.js/lib/languages/plaintext";
import shell from "highlight.js/lib/languages/shell";
import yaml from "highlight.js/lib/languages/yaml";
import { useTranslation } from "../../i18n/useTranslation";
import { useGlobalContext } from "../state/context";

export type HighlightLanguage = "bash" | "diff" | "plaintext" | "shell" | "yaml";

const COMMIT_ID_PATTERN = /\b[0-9a-f]{7,40}\b/gi;

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("shell", shell);
hljs.registerLanguage("yaml", yaml);

export function HighlightedCode({
    code,
    language = "plaintext",
    inline = false,
    className = "",
}: {
    code: string,
    language?: HighlightLanguage,
    inline?: boolean,
    className?: string,
}) {
    const { onCommitOpen } = useGlobalContext();
    const html = useMemo(() => linkifyCommitIds(highlight(code, language)), [code, language]);
    const classNames = `gc-highlighted-code language-${language}${className ? ` ${className}` : ""}`;

    function handleClick(event: MouseEvent<HTMLElement>) {
        const target = event.target instanceof HTMLElement
            ? event.target.closest<HTMLElement>("[data-commit-id]")
            : null;
        const commitId = target?.dataset.commitId;
        if (!commitId) {
            return;
        }
        event.preventDefault();
        onCommitOpen?.(commitId);
    }

    if (inline) {
        return (
            <code
                className={classNames}
                onClick={handleClick}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        );
    }

    return (
        <pre
            className={classNames}
            onClick={handleClick}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

export function CommitId({ commitId, className = "" }: { commitId: string, className?: string }) {
    const { onCommitOpen } = useGlobalContext();
    const { t } = useTranslation();

    return (
        <button
            type="button"
            className={`gc-code gc-commit-link${className ? ` ${className}` : ""}`}
            title={t("commit.open", { commitId })}
            onClick={() => onCommitOpen?.(commitId)}
        >
            {commitId}
        </button>
    );
}

export function CommitLinkedText({ text }: { text: string }) {
    const parts: React.ReactNode[] = [];
    let cursor = 0;

    for (const match of text.matchAll(COMMIT_ID_PATTERN)) {
        const commitId = match[0];
        const index = match.index ?? 0;
        if (index > cursor) {
            parts.push(text.slice(cursor, index));
        }
        parts.push(<CommitId key={`${commitId}-${index}`} commitId={commitId} />);
        cursor = index + commitId.length;
    }

    if (cursor < text.length) {
        parts.push(text.slice(cursor));
    }

    return <>{parts}</>;
}

function highlight(code: string, language: HighlightLanguage): string {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
}

function linkifyCommitIds(html: string): string {
    let result = "";
    let cursor = 0;

    while (cursor < html.length) {
        const tagStart = html.indexOf("<", cursor);
        const textEnd = tagStart === -1 ? html.length : tagStart;
        result += linkifyText(html.slice(cursor, textEnd));

        if (tagStart === -1) {
            break;
        }

        const tagEnd = html.indexOf(">", tagStart);
        if (tagEnd === -1) {
            result += html.slice(tagStart);
            break;
        }

        result += html.slice(tagStart, tagEnd + 1);
        cursor = tagEnd + 1;
    }

    return result;
}

function linkifyText(text: string): string {
    return text.replace(COMMIT_ID_PATTERN, commitId => (
        `<button type="button" class="gc-code-link" data-commit-id="${commitId}">${commitId}</button>`
    ));
}
