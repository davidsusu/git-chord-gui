import { createContext, useContext } from 'react';
import GitChordInterface from '../../chord/GitChordInterface';
import MockGitChord from '../../chord/MockGitChord';

export interface GlobalContextInterface {
    gitChord: GitChordInterface,
}

export const GlobalContext = createContext<GlobalContextInterface>({
    gitChord: new MockGitChord(),
});

export const useGlobalContext = (): GlobalContextInterface => {
    return useContext(GlobalContext) as GlobalContextInterface;
};
