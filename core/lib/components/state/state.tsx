import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface GlobalStateInterface {
    update(updater: (state: GlobalStateInterface) => void): void,
    version: string | null,
    help: string | null,
};

export const useGlobalStore = create<GlobalStateInterface>()(immer((set) => ({
    update: (updater) => { set(updater) },
    version: null,
    help: null,
})));
