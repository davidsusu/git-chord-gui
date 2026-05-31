import React, { KeyboardEvent, useEffect, useMemo, useState } from "react";
import LoadingScreen from "../general/LoadingScreen";
import { useGlobalContext } from "../state/context";
import { buildContentCacheKey, repoContentScope, writeCachedContent } from "../state/contentCache";
import { GlobalStateInterface, useGlobalStore } from "../state/state";
import useCachedGitChordText from "../state/useCachedGitChordText";
import { Badge, Button, EmptyState, Page } from "../ui/Page";

interface ConfigEntry {
    key: string,
    value: string,
}

const CONFIG_PARAMS = ["list", "--no-color"];
const CONFIG_OVERRIDES_PARAMS = ["list", "--no-cascade", "--no-color"];

export default function Config() {
    const { gitChord, pageGroup } = useGlobalContext();
    const update = useGlobalStore((state) => state.update);
    const repoRoot = pageGroup.type === "repo" ? pageGroup.repoRoot : null;
    const scope = repoRoot === null ? null : repoContentScope(repoRoot);
    const configText = useCachedGitChordText({
        scope,
        method: "config",
        params: CONFIG_PARAMS,
        outputKey: "repoConfig",
    });
    const overrideText = useCachedGitChordText({
        scope,
        method: "configOverrides",
        params: CONFIG_OVERRIDES_PARAMS,
        outputKey: "repoConfigOverrides",
    });
    const [entries, setEntries] = useState<ConfigEntry[]>([]);
    const [overrideKeys, setOverrideKeys] = useState<Set<string>>(new Set());
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");

    const cacheKeys = useMemo(() => {
        if (scope === null) {
            return null;
        }
        return {
            config: buildContentCacheKey(scope, "config", CONFIG_PARAMS),
            overrides: buildContentCacheKey(scope, "configOverrides", CONFIG_OVERRIDES_PARAMS),
        };
    }, [scope]);

    useEffect(() => {
        if (configText !== null) {
            setEntries(parseConfigList(configText));
        }
    }, [configText]);

    useEffect(() => {
        if (overrideText !== null) {
            setOverrideKeys(new Set(parseConfigList(overrideText).map(entry => entry.key)));
        }
    }, [overrideText]);

    if (!repoRoot) {
        return (
            <Page title="Repository Config">
                <EmptyState title="No Git repository context is available." />
            </Page>
        );
    }

    if (configText === null || overrideText === null) {
        return (
            <Page title="Repository Config" description={repoRoot}>
                <LoadingScreen />
            </Page>
        );
    }

    if (configText === "") {
        return (
            <Page title="Repository Config" description={repoRoot}>
                <EmptyState title="Failed to load repository config." />
            </Page>
        );
    }

    function startEdit(entry: ConfigEntry) {
        setEditingKey(entry.key);
        setEditingValue(entry.value);
    }

    function cancelEdit() {
        setEditingKey(null);
        setEditingValue("");
    }

    function saveEdit(key: string) {
        const nextValue = editingValue;
        const nextEntries = updateEntryValue(entries, key, nextValue);
        const nextOverrideKeys = new Set(overrideKeys);
        if (nextValue === "") {
            nextOverrideKeys.delete(key);
            void gitChord.configReset(key).then(refreshFromCli);
        } else {
            nextOverrideKeys.add(key);
            void gitChord.configSet(key, nextValue).then(refreshFromCli);
        }

        setEntries(nextEntries);
        setOverrideKeys(nextOverrideKeys);
        setEditingKey(null);
        setEditingValue("");
        writeConfigState(nextEntries, nextOverrideKeys);
    }

    function handleEditKeyDown(event: KeyboardEvent<HTMLInputElement>, key: string) {
        if (event.key === "Enter") {
            event.preventDefault();
            saveEdit(key);
        } else if (event.key === "Escape") {
            event.preventDefault();
            cancelEdit();
        }
    }

    function refreshFromCli() {
        return Promise.all([
            gitChord.config(),
            gitChord.configOverrides(),
        ]).then(([nextConfigText, nextOverrideText]) => {
            const nextEntries = parseConfigList(nextConfigText);
            const nextOverrideKeys = new Set(parseConfigList(nextOverrideText).map(entry => entry.key));
            setEntries(nextEntries);
            setOverrideKeys(nextOverrideKeys);
            writeRawConfigState(nextConfigText, nextOverrideText);
        });
    }

    function writeConfigState(nextEntries: ConfigEntry[], nextOverrideKeys: Set<string>) {
        writeRawConfigState(formatConfigList(nextEntries), formatConfigList(nextEntries.filter(entry => nextOverrideKeys.has(entry.key))));
    }

    function writeRawConfigState(nextConfigText: string, nextOverrideText: string) {
        if (!cacheKeys) {
            return;
        }
        update((state: GlobalStateInterface) => {
            state.repoConfig = nextConfigText;
            state.repoConfigOverrides = nextOverrideText;
            writeCachedContent(state, cacheKeys.config, nextConfigText);
            writeCachedContent(state, cacheKeys.overrides, nextOverrideText);
        });
    }

    return (
        <Page title="Repository Config" description={repoRoot}>
            <div className="gc-table-wrap">
                <table className="gc-config-table">
                    <thead>
                        <tr>
                            <th>Key</th>
                            <th>Value</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(entry => {
                            const isEditing = editingKey === entry.key;
                            const isOverridden = overrideKeys.has(entry.key);
                            return (
                                <tr key={entry.key}>
                                    <td><code className="gc-code">{entry.key}</code></td>
                                    <td className="gc-config-value">
                                        {isEditing ? (
                                            <input
                                                autoFocus
                                                className="gc-input"
                                                type="text"
                                                value={editingValue}
                                                onChange={event => setEditingValue(event.target.value)}
                                                onKeyDown={event => handleEditKeyDown(event, entry.key)}
                                            />
                                        ) : (
                                            <code className="gc-code">{entry.value}</code>
                                        )}
                                    </td>
                                    <td>
                                        {isOverridden ? (
                                            <Badge tone="changed">overridden</Badge>
                                        ) : (
                                            <span className="gc-muted">default</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="gc-config-actions">
                                            {isEditing ? (
                                                <>
                                                    <Button type="button" variant="primary" size="small" onClick={() => saveEdit(entry.key)}>
                                                        Override
                                                    </Button>
                                                    <Button type="button" variant="ghost" size="small" onClick={cancelEdit}>
                                                        Cancel
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button type="button" size="small" onClick={() => startEdit(entry)}>
                                                    Edit
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Page>
    );
}

function parseConfigList(output: string): ConfigEntry[] {
    return stripAnsi(output).split(/\r?\n/)
        .filter(line => line !== "")
        .map(line => {
            const separatorIndex = line.indexOf(" ");
            if (separatorIndex === -1) {
                return { key: line, value: "" };
            }
            return {
                key: line.slice(0, separatorIndex),
                value: line.slice(separatorIndex + 1),
            };
        });
}

function formatConfigList(entries: ConfigEntry[]): string {
    return entries.map(entry => `${entry.key} ${entry.value}`).join("\n");
}

function updateEntryValue(entries: ConfigEntry[], key: string, value: string): ConfigEntry[] {
    return entries.map(entry => entry.key === key ? { ...entry, value } : entry);
}

function stripAnsi(value: string): string {
    return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}
