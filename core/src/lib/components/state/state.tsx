import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface CachedContentEntry {
    value: string,
    loadedAt: number,
}

export type TextOutputKey = "version" | "help" | "repoState" | "repoConfig" | "repoConfigOverrides" | "repoConfigAllOverrides" | "repoList" | "specOptions";

export interface GlobalStateInterface {
    update(updater: (state: GlobalStateInterface) => void): void,
    version: string | null,
    help: string | null,
    repoState: string | null,
    repoConfig: string | null,
    repoConfigOverrides: string | null,
    repoConfigAllOverrides: string | null,
    repoList: string | null,
    specOptions: string | null,
    contentCache: Record<string, CachedContentEntry | undefined>,
};

export const useGlobalStore = create<GlobalStateInterface>()(immer((set) => ({
    update: (updater) => { set(updater) },
    version: null,
    help: null,
    repoState: null,
    repoConfig: null,
    repoConfigOverrides: null,
    repoConfigAllOverrides: null,
    repoList: null,
    specOptions: null,
    contentCache: {},
})));
