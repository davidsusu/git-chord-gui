export type SpecOptionKind = "value" | "boolean";
export type ConfigValueType = "text" | "boolean";

export interface SpecOptionDefinition {
    kind: SpecOptionKind,
    token: string,
    negativeToken?: string,
}

export function parseSpecOptions(output: string, hiddenOptionTokens: ReadonlySet<string> = new Set()): SpecOptionDefinition[] {
    const lines = output.split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.startsWith("--"));
    const lineSet = new Set(lines);
    const definitions: SpecOptionDefinition[] = [];
    const addedTokens = new Set<string>();

    lines.forEach(line => {
        if (line.endsWith("=")) {
            const token = line.slice(0, -1);
            addDefinition(definitions, addedTokens, hiddenOptionTokens, {
                kind: "value",
                token,
            });
            return;
        }

        if (line.startsWith("--no-")) {
            const positiveToken = `--${line.slice("--no-".length)}`;
            if (lineSet.has(positiveToken) || shouldHideOptionToken(line, hiddenOptionTokens)) {
                return;
            }
            addDefinition(definitions, addedTokens, hiddenOptionTokens, {
                kind: "boolean",
                token: line,
            });
            return;
        }

        const negativeToken = `--no-${line.slice(2)}`;
        addDefinition(definitions, addedTokens, hiddenOptionTokens, {
            kind: "boolean",
            token: line,
            negativeToken: lineSet.has(negativeToken) ? negativeToken : undefined,
        });
    });

    return definitions;
}

export function buildConfigValueTypeMap(specOptionsOutput: string): Map<string, ConfigValueType> {
    const valueTypes = new Map<string, ConfigValueType>();
    parseSpecOptions(specOptionsOutput).forEach(definition => {
        valueTypes.set(optionTokenToConfigKey(definition.token), definition.kind === "boolean" ? "boolean" : "text");
    });
    return valueTypes;
}

function addDefinition(
    definitions: SpecOptionDefinition[],
    addedTokens: Set<string>,
    hiddenOptionTokens: ReadonlySet<string>,
    definition: SpecOptionDefinition,
) {
    if (shouldHideOptionToken(definition.token, hiddenOptionTokens) || addedTokens.has(definition.token)) {
        return;
    }

    definitions.push(definition);
    addedTokens.add(definition.token);
}

function shouldHideOptionToken(token: string, hiddenOptionTokens: ReadonlySet<string>): boolean {
    if (hiddenOptionTokens.has(token)) {
        return true;
    }

    return token.startsWith("--no-") && hiddenOptionTokens.has(`--${token.slice("--no-".length)}`);
}

function optionTokenToConfigKey(token: string): string {
    const normalizedToken = token.startsWith("--no-") ? `--${token.slice("--no-".length)}` : token;
    return normalizedToken.replace(/^--/, "").replace(/-/g, ".");
}
