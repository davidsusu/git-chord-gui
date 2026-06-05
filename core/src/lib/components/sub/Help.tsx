import React from "react";
import LoadingScreen from "../general/LoadingScreen";
import useCachedGitChordText from "../state/useCachedGitChordText";
import Markdown from "react-markdown";
import { EmptyState, Page } from "../ui/Page";
import { HighlightedCode, HighlightLanguage } from "../ui/HighlightedCode";
import { useTranslation } from "../../i18n/useTranslation";

export default function Help() {
    const { t } = useTranslation();
    const help = useCachedGitChordText({
        scope: "global",
        method: "help",
        params: ["--markdown"],
        outputKey: "help",
    });

    if (help === null) {
        return (
            <Page title={t("help.title")}>
                <LoadingScreen />
            </Page>
        );
    }

    if (help === "") {
        return (
            <Page title={t("help.title")}>
                <EmptyState title={t("help.failed")} />
            </Page>
        );
    }

    return (
        <Page title={t("help.title")}>
            <div className="gc-markdown">
                <Markdown components={{ code: MarkdownCode, pre: MarkdownPre }}>{help}</Markdown>
            </div>
        </Page>
    );
}

function MarkdownCode({ className, children, ...props }: any) {
    return <code className={["gc-code", className].filter(Boolean).join(" ")} {...props}>{children}</code>;
}

function MarkdownPre({ children }: any) {
    const codeElement = React.Children.toArray(children).find(React.isValidElement);
    if (!React.isValidElement(codeElement)) {
        return <pre className="gc-code-output">{children}</pre>;
    }

    const childProps = codeElement.props as { className?: string, children?: React.ReactNode };

    return (
        <HighlightedCode
            code={String(childProps.children ?? "").replace(/\n$/, "")}
            language={markdownLanguage(childProps.className)}
            className="gc-code-output"
        />
    );
}

function markdownLanguage(className: string | undefined): HighlightLanguage {
    const match = className?.match(/language-(\w+)/);
    switch (match?.[1]) {
        case "bash":
        case "sh":
            return "bash";
        case "shell":
            return "shell";
        case "yaml":
        case "yml":
            return "yaml";
        case "diff":
            return "diff";
        default:
            return "plaintext";
    }
}
