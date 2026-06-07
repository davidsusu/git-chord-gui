"use client";

import {
    CommandExecutorGitChord,
    DEFAULT_LANGUAGE,
    GitChordContext,
    GitChordGui,
} from "@git-chord/gui-core";
import type { LanguageCode, PageGroup, ThemeMode } from "@git-chord/gui-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import BrowserCommandExecutor from "../lib/BrowserCommandExecutor";
import BrowserGit from "../lib/BrowserGit";

export default function WebGitChordApp({ repoRoot }: { repoRoot: string | null }) {
    const [language, setLanguage] = useState<LanguageCode>(() => resolveBrowserLanguage() ?? DEFAULT_LANGUAGE);
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => resolveBrowserTheme());
    const [mounted, setMounted] = useState(false);
    const languageRef = useRef(language);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        languageRef.current = language;
        document.documentElement.lang = language;
    }, [language]);

    useEffect(() => {
        function handleLanguageChange() {
            const nextLanguage = resolveBrowserLanguage();
            if (nextLanguage) {
                setLanguage(nextLanguage);
            }
        }

        window.addEventListener("languagechange", handleLanguageChange);
        return () => window.removeEventListener("languagechange", handleLanguageChange);
    }, []);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        function handleThemeChange(event: MediaQueryListEvent) {
            setThemeMode(event.matches ? "dark" : "light");
        }

        mediaQuery.addEventListener("change", handleThemeChange);
        return () => mediaQuery.removeEventListener("change", handleThemeChange);
    }, []);

    const commandExecutor = useMemo(
        () => new BrowserCommandExecutor(() => languageRef.current),
        [],
    );
    const gitChord = useMemo(() => new CommandExecutorGitChord(commandExecutor), [commandExecutor]);
    const git = useMemo(() => new BrowserGit(), []);
    const pageGroup = useMemo<PageGroup>(
        () => repoRoot ? { type: "repo", repoRoot } : { type: "global" },
        [repoRoot],
    );
    const openCommit = useCallback((commitId: string) => {
        window.open(`/api/commit/${encodeURIComponent(commitId)}`, "_blank", "noopener,noreferrer");
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <GitChordContext.Provider value={{
            gitChord,
            git,
            pageGroup,
            currentRepoRoot: repoRoot,
            language,
            onLanguageChange: setLanguage,
            themeMode,
            onThemeModeChange: setThemeMode,
            onCommitOpen: openCommit,
            uiControls: {
                languageSwitcher: true,
                themeSwitcher: true,
            },
        }}>
            <BrowserRouter>
                <GitChordGui />
            </BrowserRouter>
        </GitChordContext.Provider>
    );
}

function resolveBrowserLanguage(): LanguageCode | null {
    if (typeof navigator === "undefined") {
        return null;
    }

    const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const candidate of candidates) {
        const normalized = candidate.toLowerCase();
        if (normalized === "hu" || normalized.startsWith("hu-")) {
            return "hu-HU";
        }
        if (normalized === "en" || normalized.startsWith("en-")) {
            return "en-US";
        }
    }
    return null;
}

function resolveBrowserTheme(): ThemeMode {
    if (typeof window === "undefined") {
        return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
