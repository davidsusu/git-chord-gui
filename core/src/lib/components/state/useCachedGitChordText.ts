import { useEffect } from "react";
import GitChordInterface from "../../chord/GitChordInterface";
import { useGlobalContext } from "./context";
import { buildContentCacheKey, readFreshCachedContent, writeCachedContent } from "./contentCache";
import { GlobalStateInterface, TextOutputKey, useGlobalStore } from "./state";

type GitChordTextMethod = keyof Pick<GitChordInterface, "version" | "help" | "state" | "config" | "configOverrides" | "list">;

interface UseCachedGitChordTextArgs {
    scope: string | null,
    method: GitChordTextMethod,
    params?: readonly string[],
    outputKey: TextOutputKey,
}

export default function useCachedGitChordText({ scope, method, params = [], outputKey }: UseCachedGitChordTextArgs): string | null {
    const { gitChord } = useGlobalContext();
    const update = useGlobalStore((state) => state.update);
    const output = useGlobalStore((state) => state[outputKey]);
    const cacheKey = scope === null ? null : buildContentCacheKey(scope, method, params);

    useEffect(() => {
        let cancelled = false;

        if (cacheKey === null) {
            update((state: GlobalStateInterface) => { state[outputKey] = null; });
            return () => { cancelled = true; };
        }

        const cachedContent = readFreshCachedContent(useGlobalStore.getState(), cacheKey);
        if (cachedContent !== undefined) {
            update((state: GlobalStateInterface) => { state[outputKey] = cachedContent; });
            return () => { cancelled = true; };
        }

        update((state: GlobalStateInterface) => { state[outputKey] = null; });

        gitChord[method]().then(commandOutput => {
            if (!cancelled) {
                update((state: GlobalStateInterface) => {
                    state[outputKey] = commandOutput;
                    writeCachedContent(state, cacheKey, commandOutput);
                });
            }
        });

        return () => { cancelled = true; };
    }, [cacheKey, gitChord, method, outputKey, update]);

    return output;
}
