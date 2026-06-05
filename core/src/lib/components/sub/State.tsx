import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { parseSpecOptions } from "../../chord/specOptions";
import LoadingScreen from "../general/LoadingScreen";
import { PageIntent, useGlobalContext } from "../state/context";
import { buildContentCacheKey, readFreshCachedContent, repoContentScope, writeCachedContent } from "../state/contentCache";
import { GlobalStateInterface, useGlobalStore } from "../state/state";
import useCachedGitChordText from "../state/useCachedGitChordText";
import { Button, EmptyState, IconButton, Page } from "../ui/Page";
import { HighlightedCode } from "../ui/HighlightedCode";
import { useTranslation } from "../../i18n/useTranslation";

type FilterKind = "value" | "boolean" | "profile";

interface OptionDefinition {
    key: string,
    kind: FilterKind,
    label: string,
    token: string,
    negativeToken?: string,
    profileName?: string,
}

interface FilterLine {
    id: number,
    kind: FilterKind,
    label: string,
    token: string,
    negativeToken?: string,
    value: string,
}

interface StateOptionsFormProps {
    expanded: boolean,
    metadataLoading: boolean,
    optionDefinitions: OptionDefinition[],
    profileDefinitions: OptionDefinition[],
    selectedDefinitionKey: string,
    draftLines: FilterLine[],
    appliedLines: FilterLine[],
    onSelectedDefinitionKeyChange(value: string): void,
    onAddLine(): void,
    onUpdateLine(id: number, value: string): void,
    onRemoveLine(id: number): void,
    onApply(): void,
    onReset(): void,
    onExpand(): void,
    onCollapse(): void,
}

interface StateOutputProps {
    output: string,
}

interface SnapshotTargetConfig {
    prefix: string,
    name: string,
}

interface SnapshotCreationFormProps {
    config: SnapshotTargetConfig,
    configLoading: boolean,
    name: string,
    creating: boolean,
    onNameChange(value: string): void,
    onSubmit(): void,
    onCancel(): void,
}

const STATE_OUTPUT_PARAMS = ["--no-color", "--no-verbose"];
const CONFIG_TARGET_PARAMS = ["list", "--no-color"];
const CONFIG_ALL_OVERRIDES_PARAMS = ["list", "--no-cascade", "--all", "--no-color"];
const HIDDEN_OPTION_TOKENS = new Set(["--markdown", "--no-markdown", "--color", "--no-color", "--verbose", "--no-verbose", "--profile"]);

export default function State() {
    const { gitChord, pageGroup } = useGlobalContext();
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const update = useGlobalStore((state) => state.update);
    const repoState = useGlobalStore((state) => state.repoState);
    const repoRoot = pageGroup.type === "repo" ? pageGroup.repoRoot : null;
    const repoScope = repoRoot === null ? null : repoContentScope(repoRoot);
    const specOptionsText = useCachedGitChordText({
        scope: "global",
        method: "specOptions",
        outputKey: "specOptions",
    });
    const profileOverridesText = useCachedGitChordText({
        scope: repoScope,
        method: "configAllOverrides",
        params: CONFIG_ALL_OVERRIDES_PARAMS,
        outputKey: "repoConfigAllOverrides",
    });
    const definitions = useMemo(
        () => buildParameterDefinitions(specOptionsText ?? "", profileOverridesText ?? ""),
        [specOptionsText, profileOverridesText],
    );
    const optionDefinitions = useMemo(
        () => definitions.filter(definition => definition.kind !== "profile"),
        [definitions],
    );
    const profileDefinitions = useMemo(
        () => definitions.filter(definition => definition.kind === "profile"),
        [definitions],
    );
    const [expanded, setExpanded] = useState(true);
    const [selectedDefinitionKey, setSelectedDefinitionKey] = useState("");
    const [draftLines, setDraftLines] = useState<FilterLine[]>([]);
    const [appliedLines, setAppliedLines] = useState<FilterLine[]>([]);
    const [nextLineId, setNextLineId] = useState(1);
    const [stateOutputExpanded, setStateOutputExpanded] = useState(true);
    const [snapshotFormVisible, setSnapshotFormVisible] = useState(false);
    const [snapshotConfig, setSnapshotConfig] = useState<SnapshotTargetConfig>({ prefix: "", name: "" });
    const [snapshotConfigLoading, setSnapshotConfigLoading] = useState(false);
    const [snapshotName, setSnapshotName] = useState("");
    const [snapshotNameTouched, setSnapshotNameTouched] = useState(false);
    const [snapshotCreating, setSnapshotCreating] = useState(false);
    const stateParams = useMemo(() => buildStateArgs(appliedLines), [appliedLines]);
    const stateCacheKey = useMemo(() => {
        if (repoScope === null) {
            return null;
        }
        return buildContentCacheKey(repoScope, "state", [...stateParams, ...STATE_OUTPUT_PARAMS]);
    }, [repoScope, stateParams]);
    const snapshotConfigCacheKey = useMemo(() => {
        if (repoScope === null) {
            return null;
        }
        return buildContentCacheKey(repoScope, "configTarget", [...stateParams, ...CONFIG_TARGET_PARAMS]);
    }, [repoScope, stateParams]);

    useEffect(() => {
        if (definitions.length === 0) {
            setSelectedDefinitionKey("");
        } else if (!definitions.some(definition => definition.key === selectedDefinitionKey)) {
            setSelectedDefinitionKey(definitions[0].key);
        }
    }, [definitions, selectedDefinitionKey]);

    useEffect(() => {
        setExpanded(true);
        setDraftLines([]);
        setAppliedLines([]);
        setNextLineId(1);
        cancelSnapshotCreation();
    }, [repoRoot]);

    useEffect(() => {
        const intent = getPageIntent(location.state);
        if (intent?.type === "createSnapshot") {
            startSnapshotCreation();
            return;
        }

        cancelSnapshotCreation();
    }, [location.key]);

    useEffect(() => {
        let cancelled = false;

        if (stateCacheKey === null) {
            update((state: GlobalStateInterface) => { state.repoState = null; });
            return () => { cancelled = true; };
        }

        const cachedContent = readFreshCachedContent(useGlobalStore.getState(), stateCacheKey);
        if (cachedContent !== undefined) {
            update((state: GlobalStateInterface) => { state.repoState = cachedContent; });
            return () => { cancelled = true; };
        }

        update((state: GlobalStateInterface) => { state.repoState = null; });
        gitChord.state(stateParams).then(commandOutput => {
            if (!cancelled) {
                update((state: GlobalStateInterface) => {
                    state.repoState = commandOutput;
                    writeCachedContent(state, stateCacheKey, commandOutput);
                });
            }
        });

        return () => { cancelled = true; };
    }, [gitChord, stateCacheKey, stateParams, update]);

    useEffect(() => {
        let cancelled = false;

        if (!snapshotFormVisible || snapshotConfigCacheKey === null) {
            setSnapshotConfigLoading(false);
            return () => { cancelled = true; };
        }

        const cachedContent = readFreshCachedContent(useGlobalStore.getState(), snapshotConfigCacheKey);
        if (cachedContent !== undefined) {
            setSnapshotConfig(parseSnapshotTargetConfig(cachedContent));
            setSnapshotConfigLoading(false);
            return () => { cancelled = true; };
        }

        setSnapshotConfigLoading(true);
        gitChord.config(stateParams).then(commandOutput => {
            if (!cancelled) {
                setSnapshotConfig(parseSnapshotTargetConfig(commandOutput));
                setSnapshotConfigLoading(false);
                update((state: GlobalStateInterface) => {
                    writeCachedContent(state, snapshotConfigCacheKey, commandOutput);
                });
            }
        });

        return () => { cancelled = true; };
    }, [gitChord, snapshotConfigCacheKey, snapshotFormVisible, stateParams, update]);

    useEffect(() => {
        if (snapshotFormVisible && !snapshotNameTouched) {
            setSnapshotName(snapshotConfig.name);
        }
    }, [snapshotConfig.name, snapshotFormVisible, snapshotNameTouched]);

    function addLine() {
        const definition = definitions.find(definition => definition.key === selectedDefinitionKey);
        if (!definition) {
            return;
        }

        setDraftLines(lines => [...lines, createLineFromDefinition(definition, nextLineId)]);
        setNextLineId(id => id + 1);
    }

    function updateLine(id: number, value: string) {
        setDraftLines(lines => lines.map(line => line.id === id ? { ...line, value } : line));
    }

    function removeLine(id: number) {
        setDraftLines(lines => lines.filter(line => line.id !== id));
    }

    function applyFilters() {
        setAppliedLines(draftLines);
        setExpanded(false);
    }

    function resetOptions() {
        setDraftLines([]);
        setAppliedLines([]);
        setExpanded(true);
    }

    function startSnapshotCreation() {
        setExpanded(false);
        setStateOutputExpanded(false);
        setSnapshotFormVisible(true);
        setSnapshotNameTouched(false);
        setSnapshotName(snapshotConfig.name);
        setSnapshotCreating(false);
    }

    function cancelSnapshotCreation() {
        setSnapshotFormVisible(false);
        setStateOutputExpanded(true);
        setSnapshotNameTouched(false);
        setSnapshotCreating(false);
    }

    function updateSnapshotName(value: string) {
        setSnapshotName(value);
        setSnapshotNameTouched(true);
    }

    function createSnapshot() {
        const targetBranch = `${snapshotConfig.prefix}${snapshotName}`;
        if (snapshotCreating || targetBranch.trim() === "") {
            return;
        }

        setSnapshotCreating(true);
        gitChord.snapshot(targetBranch, stateParams).then(succeeded => {
            setSnapshotCreating(false);
            if (!succeeded) {
                return;
            }

            cancelSnapshotCreation();
            invalidateSnapshotHistoryCache(repoScope, update);
            navigate("/list");
        });
    }

    if (!repoRoot) {
        return (
            <Page title={t("state.title")}>
                <EmptyState title={t("repo.noContextAvailable")} />
            </Page>
        );
    }

    return (
        <Page title={t("state.title")} description={repoRoot}>
            <StateOptionsForm
                expanded={expanded}
                metadataLoading={specOptionsText === null || profileOverridesText === null}
                optionDefinitions={optionDefinitions}
                profileDefinitions={profileDefinitions}
                selectedDefinitionKey={selectedDefinitionKey}
                draftLines={draftLines}
                appliedLines={appliedLines}
                onSelectedDefinitionKeyChange={setSelectedDefinitionKey}
                onAddLine={addLine}
                onUpdateLine={updateLine}
                onRemoveLine={removeLine}
                onApply={applyFilters}
                onReset={resetOptions}
                onExpand={() => setExpanded(true)}
                onCollapse={() => setExpanded(false)}
            />
            {repoState === null ? (
                <LoadingScreen />
            ) : repoState === "" ? (
                <EmptyState title={t("state.failed")} />
            ) : (
                <StateOutput output={repoState} expanded={stateOutputExpanded} onExpandedChange={setStateOutputExpanded} />
            )}
            {repoState !== null && repoState !== "" ? (
                snapshotFormVisible ? (
                    <SnapshotCreationForm
                        config={snapshotConfig}
                        configLoading={snapshotConfigLoading}
                        name={snapshotName}
                        creating={snapshotCreating}
                        onNameChange={updateSnapshotName}
                        onSubmit={createSnapshot}
                        onCancel={cancelSnapshotCreation}
                    />
                ) : (
                    <div className="gc-state-action-row">
                        <Button type="button" onClick={startSnapshotCreation}>
                            <span className="gc-button-inline-icon" aria-hidden="true">+</span>
                            {t("state.newSnapshotWithOptions")}
                        </Button>
                    </div>
                )
            ) : null}
        </Page>
    );
}

function StateOutput({ output, expanded, onExpandedChange }: StateOutputProps & { expanded: boolean, onExpandedChange(expanded: boolean): void }) {
    const { t } = useTranslation();
    const [copied, copyOutput] = useCopyFeedback();

    return (
        <section className="gc-state-output gc-state-result" data-expanded={expanded}>
            <header className="gc-state-output-header">
                <h2 className="gc-state-output-title">{t("state.outputTitle")}</h2>
            </header>
            <IconButton
                type="button"
                variant="ghost"
                label={copied ? t("state.copiedOutput") : t("state.copyOutput")}
                className={`gc-state-output-copy${copied ? " gc-icon-button-copied" : ""}`}
                onClick={() => copyOutput(output)}
            >
                {copied ? "✓" : "⧉"}
            </IconButton>
            <div className="gc-state-output-body">
                <HighlightedCode code={output} language="yaml" className="gc-state-output-code" />
                {!expanded ? <div className="gc-state-output-fade" aria-hidden="true" /> : null}
            </div>
            <div className="gc-state-output-toggle-row">
                <IconButton
                    type="button"
                    variant="ghost"
                    label={expanded ? t("state.collapseOutput") : t("state.expandOutput")}
                    className="gc-state-output-toggle"
                    onClick={() => onExpandedChange(!expanded)}
                >
                    {expanded ? "⌃" : "⌄"}
                </IconButton>
            </div>
        </section>
    );
}

function SnapshotCreationForm({ config, configLoading, name, creating, onNameChange, onSubmit, onCancel }: SnapshotCreationFormProps) {
    const { t } = useTranslation();
    const targetBranch = `${config.prefix}${name}`;

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        onSubmit();
    }

    return (
        <form className="gc-snapshot-create-form" onSubmit={handleSubmit}>
            <header className="gc-snapshot-create-header">
                <h2 className="gc-snapshot-create-title">{t("state.createSnapshot")}</h2>
                <Button type="button" variant="ghost" onClick={onCancel}>
                    <span className="gc-button-inline-icon" aria-hidden="true">×</span>
                    {t("common.cancel")}
                </Button>
            </header>
            <div className="gc-snapshot-target-grid">
                <label className="gc-field">
                    <span className="gc-field-label">{t("state.branchPrefix")}</span>
                    <input className="gc-input" type="text" value={config.prefix} readOnly />
                </label>
                <label className="gc-field">
                    <span className="gc-field-label">{t("state.snapshotName")}</span>
                    <input
                        className="gc-input"
                        type="text"
                        value={name}
                        disabled={configLoading || creating}
                        onChange={event => onNameChange(event.target.value)}
                    />
                </label>
            </div>
            <div className="gc-snapshot-target-preview">
                <span className="gc-muted">{t("state.targetBranch")}</span>
                <code className="gc-code">{configLoading ? t("common.loading") : targetBranch}</code>
            </div>
            <div className="gc-state-options-actions">
                <Button type="submit" variant="primary" disabled={configLoading || creating || targetBranch.trim() === ""}>
                    <span className="gc-button-inline-icon" aria-hidden="true">+</span>
                    {creating ? t("state.creatingSnapshot") : t("state.createSnapshot")}
                </Button>
            </div>
        </form>
    );
}

function StateOptionsForm({
    expanded,
    metadataLoading,
    optionDefinitions,
    profileDefinitions,
    selectedDefinitionKey,
    draftLines,
    appliedLines,
    onSelectedDefinitionKeyChange,
    onAddLine,
    onUpdateLine,
    onRemoveLine,
    onApply,
    onReset,
    onExpand,
    onCollapse,
}: StateOptionsFormProps) {
    const { t } = useTranslation();
    const definitionsAvailable = optionDefinitions.length > 0 || profileDefinitions.length > 0;
    const showFormActions = draftLines.length > 0 || appliedLines.length > 0;
    const [commandCopied, copyCommand] = useCopyFeedback();
    const [resetConfirmVisible, setResetConfirmVisible] = useState(false);

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        onApply();
    }

    function requestReset() {
        setResetConfirmVisible(true);
    }

    function confirmReset() {
        setResetConfirmVisible(false);
        onReset();
    }

    if (!expanded) {
        const command = formatStateCommand(buildStateArgs(appliedLines));
        return (
            <>
                <div className="gc-state-options gc-state-options-collapsed">
                    <div className="gc-cli-preview-row">
                        <HighlightedCode code={command} language="bash" inline className="gc-cli-preview" />
                        <IconButton
                            type="button"
                            label={commandCopied ? t("state.copiedCommand") : t("state.copyCommand")}
                            className={commandCopied ? "gc-icon-button-copied" : ""}
                            onClick={() => copyCommand(command)}
                        >
                            {commandCopied ? "✓" : "⧉"}
                        </IconButton>
                    </div>
                    <div className="gc-state-options-actions">
                        <IconButton type="button" label={t("state.editOptions")} onClick={onExpand}>
                            ✎
                        </IconButton>
                        {appliedLines.length > 0 ? (
                            <IconButton type="button" variant="ghost" className="gc-button-danger" label={t("state.resetOptions")} onClick={requestReset}>
                                ↺
                            </IconButton>
                        ) : null}
                    </div>
                </div>
                {resetConfirmVisible ? (
                    <ConfirmResetOptionsDialog
                        onCancel={() => setResetConfirmVisible(false)}
                        onConfirm={confirmReset}
                    />
                ) : null}
            </>
        );
    }

    return (
        <>
            <form className="gc-state-options" onSubmit={handleSubmit}>
                <div className="gc-state-options-toolbar">
                    <select
                        aria-label={t("state.parameter")}
                        className="gc-input gc-state-options-select"
                        disabled={metadataLoading || !definitionsAvailable}
                        value={selectedDefinitionKey}
                        onChange={event => onSelectedDefinitionKeyChange(event.target.value)}
                    >
                        {!definitionsAvailable ? (
                            <option value="">{metadataLoading ? t("state.loadingParameters") : t("state.noParameters")}</option>
                        ) : null}
                        {optionDefinitions.length > 0 ? (
                            <optgroup label={t("state.cliCommandLineOptions")}>
                                {optionDefinitions.map(definition => (
                                    <option key={definition.key} value={definition.key}>{definition.label}</option>
                                ))}
                            </optgroup>
                        ) : null}
                        {profileDefinitions.length > 0 ? (
                            <optgroup label={t("state.profiles")}>
                                {profileDefinitions.map(definition => (
                                    <option key={definition.key} value={definition.key}>{definition.label}</option>
                                ))}
                            </optgroup>
                        ) : null}
                    </select>
                    <IconButton type="button" label={t("state.addParameter")} disabled={metadataLoading || !definitionsAvailable} onClick={onAddLine}>
                        +
                    </IconButton>
                </div>
                {draftLines.length > 0 ? (
                    <div className="gc-table-wrap gc-state-options-table-wrap">
                        <table className="gc-config-table gc-state-options-table">
                            <tbody>
                                {draftLines.map(line => (
                                    <tr key={line.id}>
                                        <td><code className="gc-code">{line.label}</code></td>
                                        <td className="gc-config-value">
                                            {renderValueEditor(line, onUpdateLine)}
                                        </td>
                                        <td>
                                            <div className="gc-config-actions">
                                                <IconButton type="button" variant="ghost" size="small" label={t("state.remove")} onClick={() => onRemoveLine(line.id)}>
                                                    ×
                                                </IconButton>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}
                {showFormActions ? (
                    <div className="gc-state-options-actions">
                        <Button type="submit" variant="primary">
                            {t("state.applyFilters")}
                        </Button>
                        <Button type="button" variant="ghost" className="gc-button-danger" onClick={requestReset}>
                            {t("state.resetOptions")}
                        </Button>
                    </div>
                ) : null}
                <div className="gc-state-options-collapse-row">
                    <IconButton type="button" variant="ghost" label={t("state.collapseOptions")} onClick={onCollapse}>
                        ⌃
                    </IconButton>
                </div>
            </form>
            {resetConfirmVisible ? (
                <ConfirmResetOptionsDialog
                    onCancel={() => setResetConfirmVisible(false)}
                    onConfirm={confirmReset}
                />
            ) : null}
        </>
    );
}

function ConfirmResetOptionsDialog({ onCancel, onConfirm }: { onCancel(): void, onConfirm(): void }) {
    const { t } = useTranslation();

    return (
        <div className="gc-modal-backdrop">
            <section className="gc-modal" role="dialog" aria-modal="true" aria-labelledby="gc-reset-options-title">
                <h2 id="gc-reset-options-title" className="gc-modal-title">{t("state.resetTitle")}</h2>
                <p className="gc-modal-text">
                    {t("state.resetMessage")}
                </p>
                <div className="gc-modal-actions">
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        {t("common.cancel")}
                    </Button>
                    <Button type="button" className="gc-button-danger" onClick={onConfirm}>
                        {t("state.resetOptions")}
                    </Button>
                </div>
            </section>
        </div>
    );
}

function renderValueEditor(line: FilterLine, onUpdateLine: (id: number, value: string) => void) {
    if (line.kind === "boolean") {
        return (
            <select
                className="gc-input"
                value={line.value}
                onChange={event => onUpdateLine(line.id, event.target.value)}
            >
                <option value="true">true</option>
                <option value="false">false</option>
            </select>
        );
    }

    return (
        <input
            className="gc-input"
            type="text"
            value={line.value}
            onChange={event => onUpdateLine(line.id, event.target.value)}
        />
    );
}

function buildParameterDefinitions(specOptionsText: string, profileOverridesText: string): OptionDefinition[] {
    return [
        ...parseStateSpecOptionDefinitions(specOptionsText),
        ...parseProfileDefinitions(profileOverridesText),
    ];
}

function parseStateSpecOptionDefinitions(output: string): OptionDefinition[] {
    return parseSpecOptions(output, HIDDEN_OPTION_TOKENS).map(definition => ({
        key: `option:${definition.token}`,
        kind: definition.kind,
        label: definition.token,
        token: definition.token,
        negativeToken: definition.negativeToken,
    }));
}

function parseProfileDefinitions(output: string): OptionDefinition[] {
    const profileNames = new Set<string>();
    stripAnsi(output).split(/\r?\n/).forEach(line => {
        const match = line.match(/^profile\.([A-Za-z0-9_]+)\./);
        if (match) {
            profileNames.add(match[1]);
        }
    });

    return Array.from(profileNames)
        .sort((left, right) => left.localeCompare(right))
        .map(profileName => ({
            key: `profile:${profileName}`,
            kind: "profile",
            label: `profile: ${profileName}`,
            token: "--profile",
            profileName,
        }));
}

function createLineFromDefinition(definition: OptionDefinition, id: number): FilterLine {
    return {
        id,
        kind: definition.kind,
        label: definition.kind === "profile" ? "--profile" : definition.label,
        token: definition.token,
        negativeToken: definition.negativeToken,
        value: definition.kind === "boolean" ? "true" : definition.profileName ?? "",
    };
}

function buildStateArgs(lines: FilterLine[]): string[] {
    const args: string[] = [];

    lines.forEach(line => {
        if (line.kind === "boolean") {
            if (line.value === "false") {
                if (line.negativeToken) {
                    args.push(line.negativeToken);
                }
            } else {
                args.push(line.token);
            }
            return;
        }

        args.push(`${line.token}=${line.value}`);
    });

    return args;
}

function formatStateCommand(stateParams: string[]): string {
    return ["git", "chord", "state", ...stateParams, ...STATE_OUTPUT_PARAMS]
        .map(shellQuote)
        .join(" ");
}

function shellQuote(value: string): string {
    if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
        return value;
    }

    return `'${value.replace(/'/g, `'\\''`)}'`;
}

function stripAnsi(value: string): string {
    return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

function parseSnapshotTargetConfig(output: string): SnapshotTargetConfig {
    const values = new Map<string, string>();
    stripAnsi(output).split(/\r?\n/).forEach(line => {
        const separatorIndex = line.indexOf(" ");
        if (separatorIndex === -1) {
            return;
        }
        values.set(line.slice(0, separatorIndex), line.slice(separatorIndex + 1));
    });

    return {
        prefix: values.get("trackers.prefix") ?? "",
        name: values.get("trackers.name") ?? "",
    };
}

function getPageIntent(state: unknown): PageIntent | null {
    if (!state || typeof state !== "object" || !("intent" in state)) {
        return null;
    }

    const intent = (state as { intent?: unknown }).intent;
    if (intent && typeof intent === "object" && "type" in intent && intent.type === "createSnapshot") {
        return { type: "createSnapshot" };
    }

    return null;
}

function invalidateSnapshotHistoryCache(repoScope: string | null, update: GlobalStateInterface["update"]) {
    if (repoScope === null) {
        return;
    }

    const cacheKey = buildContentCacheKey(repoScope, "list");
    update((state: GlobalStateInterface) => {
        state.repoList = null;
        delete state.contentCache[cacheKey];
    });
}

function useCopyFeedback(): [boolean, (value: string) => void] {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    function copyWithFeedback(value: string) {
        void copyText(value).finally(() => {
            setCopied(true);
            if (timeoutRef.current !== null) {
                window.clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = window.setTimeout(() => {
                setCopied(false);
                timeoutRef.current = null;
            }, 1200);
        });
    }

    return [copied, copyWithFeedback];
}

function copyText(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(value).catch(() => copyTextFallback(value));
    }

    copyTextFallback(value);
    return Promise.resolve();
}

function copyTextFallback(value: string) {
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand("copy");
    } finally {
        document.body.removeChild(textArea);
    }
}
