import React, { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { buildConfigValueTypeMap } from "../../chord/specOptions";
import type { ConfigValueType } from "../../chord/specOptions";
import LoadingScreen from "../general/LoadingScreen";
import { useGlobalContext } from "../state/context";
import { buildContentCacheKey, repoContentScope, writeCachedContent } from "../state/contentCache";
import { GlobalStateInterface, useGlobalStore } from "../state/state";
import useCachedGitChordText from "../state/useCachedGitChordText";
import { Badge, EmptyState, IconButton, Page } from "../ui/Page";
import { useTranslation } from "../../i18n/useTranslation";

interface ConfigEntry {
    key: string,
    value: string,
}

const CONFIG_PARAMS = ["list", "--no-color"];
const CONFIG_OVERRIDES_PARAMS = ["list", "--no-cascade", "--no-color"];

export default function Config() {
    const { gitChord, pageGroup } = useGlobalContext();
    const { t } = useTranslation();
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
    const specOptionsText = useCachedGitChordText({
        scope: "global",
        method: "specOptions",
        outputKey: "specOptions",
    });
    const valueTypes = useMemo(
        () => buildConfigValueTypeMap(specOptionsText ?? ""),
        [specOptionsText],
    );
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
            <Page title={t("config.title")}>
                <EmptyState title={t("repo.noContextAvailable")} />
            </Page>
        );
    }

    if (configText === null || overrideText === null || specOptionsText === null) {
        return (
            <Page title={t("config.title")} description={repoRoot}>
                <LoadingScreen />
            </Page>
        );
    }

    if (configText === "") {
        return (
            <Page title={t("config.title")} description={repoRoot}>
                <EmptyState title={t("config.failed")} />
            </Page>
        );
    }

    function startEdit(entry: ConfigEntry) {
        setEditingKey(entry.key);
        setEditingValue(valueTypes.get(entry.key) === "boolean" ? normalizeBooleanValue(entry.value) : entry.value);
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

    function resetOverride(key: string) {
        if (!overrideKeys.has(key)) {
            return;
        }

        const nextOverrideKeys = new Set(overrideKeys);
        nextOverrideKeys.delete(key);
        setOverrideKeys(nextOverrideKeys);
        if (editingKey === key) {
            cancelEdit();
        }
        void gitChord.configReset(key).then(refreshFromCli);
    }

    function handleEditKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, key: string) {
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
        <Page title={t("config.title")} description={repoRoot}>
            <div className="gc-table-wrap">
                <table className="gc-config-table">
                    <thead>
                        <tr>
                            <th>{t("config.key")}</th>
                            <th>{t("config.value")}</th>
                            <th>{t("config.status")}</th>
                            <th>{t("common.action")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map(entry => {
                            const isEditing = editingKey === entry.key;
                            const isOverridden = overrideKeys.has(entry.key);
                            const valueType = valueTypes.get(entry.key) ?? "text";
                            return (
                                <tr key={entry.key}>
                                    <td><code className="gc-code">{entry.key}</code></td>
                                    <td className="gc-config-value">
                                        {isEditing ? (
                                            renderConfigValueEditor(
                                                valueType,
                                                editingValue,
                                                setEditingValue,
                                                event => handleEditKeyDown(event, entry.key),
                                            )
                                        ) : (
                                            <code className="gc-code">{entry.value}</code>
                                        )}
                                    </td>
                                    <td>
                                        {isOverridden ? (
                                            <Badge tone="changed">{t("config.overridden")}</Badge>
                                        ) : (
                                            <span className="gc-muted">{t("config.default")}</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="gc-config-actions">
                                            {isEditing ? (
                                                <>
                                                    <IconButton type="button" variant="primary" size="small" label={t("config.override")} onClick={() => saveEdit(entry.key)}>
                                                        ✓
                                                    </IconButton>
                                                    <IconButton type="button" variant="ghost" size="small" label={t("common.cancel")} onClick={cancelEdit}>
                                                        ×
                                                    </IconButton>
                                                    <IconButton type="button" variant="ghost" size="small" label={t("config.resetOverride")} disabled={!isOverridden} onClick={() => resetOverride(entry.key)}>
                                                        ↺
                                                    </IconButton>
                                                </>
                                            ) : (
                                                <>
                                                    <IconButton type="button" size="small" label={t("config.edit")} onClick={() => startEdit(entry)}>
                                                        ✎
                                                    </IconButton>
                                                    <IconButton type="button" variant="ghost" size="small" label={t("config.resetOverride")} disabled={!isOverridden} onClick={() => resetOverride(entry.key)}>
                                                        ↺
                                                    </IconButton>
                                                </>
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

function renderConfigValueEditor(
    valueType: ConfigValueType,
    value: string,
    onChange: (value: string) => void,
    onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void,
) {
    if (valueType === "boolean") {
        return (
            <select
                autoFocus
                className="gc-input"
                value={normalizeBooleanValue(value)}
                onChange={event => onChange(event.target.value)}
                onKeyDown={onKeyDown}
            >
                <option value="true">true</option>
                <option value="false">false</option>
            </select>
        );
    }

    return (
        <input
            autoFocus
            className="gc-input"
            type="text"
            value={value}
            onChange={event => onChange(event.target.value)}
            onKeyDown={onKeyDown}
        />
    );
}

function normalizeBooleanValue(value: string): "true" | "false" {
    return value === "true" ? "true" : "false";
}

function parseConfigList(output: string): ConfigEntry[] {
    return output.split(/\r?\n/)
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
