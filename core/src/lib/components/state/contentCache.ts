import { GlobalStateInterface } from "./state";

export const LOADED_CONTENT_CACHE_TTL_MS = 5 * 60 * 1000;

export function buildContentCacheKey(scope: string, method: string, params: readonly string[] = []): string {
    return JSON.stringify([scope, method, [...params]]);
}

export function readFreshCachedContent(state: GlobalStateInterface, cacheKey: string): string | undefined {
    const entry = state.contentCache[cacheKey];
    if (!entry) {
        return undefined;
    }

    if (Date.now() - entry.loadedAt > LOADED_CONTENT_CACHE_TTL_MS) {
        return undefined;
    }

    return entry.value;
}

export function writeCachedContent(state: GlobalStateInterface, cacheKey: string, value: string) {
    state.contentCache[cacheKey] = {
        value,
        loadedAt: Date.now(),
    };
}

export function repoContentScope(repoRoot: string): string {
    return `repo:${repoRoot}`;
}
