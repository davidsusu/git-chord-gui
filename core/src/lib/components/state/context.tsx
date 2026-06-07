import { createContext, useContext } from 'react';
import GitChordInterface from '../../chord/GitChordInterface';
import MockGitChord from '../../chord/MockGitChord';
import GitInterface from '../../git/GitInterface';
import MockGit from '../../git/MockGit';
import { DEFAULT_LANGUAGE, LanguageCode } from '../../i18n';

export type PageGroup =
    | { type: 'global' }
    | { type: 'repo', repoRoot: string };

export type PageIntent =
    | { type: 'createSnapshot' };

export type PageOpenRequest =
    | { type: 'global', path: string, intent?: PageIntent }
    | { type: 'currentRepo', path: string, intent?: PageIntent }
    | { type: 'repo', repoRoot: string, path: string, intent?: PageIntent };

export type ThemeMode = 'auto' | 'light' | 'dark';

export interface UiControls {
    languageSwitcher?: boolean,
    themeSwitcher?: boolean,
}

export interface GlobalContextInterface {
    gitChord: GitChordInterface,
    git: GitInterface,
    pageGroup: PageGroup,
    currentRepoRoot?: string | null,
    openPage?: (request: PageOpenRequest) => void,
    language?: LanguageCode,
    onLanguageChange?: (language: LanguageCode) => void,
    themeMode?: ThemeMode,
    onThemeModeChange?: (themeMode: ThemeMode) => void,
    onCommitOpen?: (commitId: string) => void,
    uiControls?: UiControls,
}

export const GlobalContext = createContext<GlobalContextInterface>({
    gitChord: new MockGitChord(),
    git: new MockGit(),
    pageGroup: { type: 'global' },
    language: DEFAULT_LANGUAGE,
    themeMode: 'auto',
    uiControls: {
        languageSwitcher: true,
        themeSwitcher: true,
    },
});

export const useGlobalContext = (): GlobalContextInterface => {
    return useContext(GlobalContext) as GlobalContextInterface;
};
