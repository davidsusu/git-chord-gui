import { createContext, useContext } from 'react';
import GitChordInterface from '../../chord/GitChordInterface';
import MockGitChord from '../../chord/MockGitChord';

export type PageGroup =
    | { type: 'global' }
    | { type: 'repo', repoRoot: string };

export type PageOpenRequest =
    | { type: 'global', path: string }
    | { type: 'currentRepo', path: string }
    | { type: 'repo', repoRoot: string, path: string };

export interface GlobalContextInterface {
    gitChord: GitChordInterface,
    pageGroup: PageGroup,
    openPage?: (request: PageOpenRequest) => void,
}

export const GlobalContext = createContext<GlobalContextInterface>({
    gitChord: new MockGitChord(),
    pageGroup: { type: 'global' },
});

export const useGlobalContext = (): GlobalContextInterface => {
    return useContext(GlobalContext) as GlobalContextInterface;
};
