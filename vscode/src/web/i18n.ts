export type LanguageCode = "en-US" | "hu-HU";

const enUS = {
    "extension.noFileSelected": "No file-system resource was selected.",
    "extension.noRepoCurrent": "No Git repository found for the current context.",
    "extension.noRepoSelected": "No Git repository found for the selected resource.",
    "extension.invalidCommit": "Invalid commit id.",
    "extension.commitOpenFailed": "Could not open commit.",
    "extension.rejectedCommand": "Rejected command: only git chord commands are allowed.",
} as const;

type ExtensionMessageKey = keyof typeof enUS;
type ExtensionMessages = Record<ExtensionMessageKey, string>;

const huHU: ExtensionMessages = {
    "extension.noFileSelected": "Nincs kiválasztva fájlrendszer-erőforrás.",
    "extension.noRepoCurrent": "Nem található Git tároló az aktuális kontextushoz.",
    "extension.noRepoSelected": "Nem található Git tároló a kiválasztott erőforráshoz.",
    "extension.invalidCommit": "Érvénytelen commit azonosító.",
    "extension.commitOpenFailed": "Nem sikerült megnyitni a commitot.",
    "extension.rejectedCommand": "Elutasított parancs: csak git chord parancsok engedélyezettek.",
};

const messages: Record<LanguageCode, ExtensionMessages> = {
    "en-US": enUS,
    "hu-HU": huHU,
};

export const DEFAULT_LANGUAGE: LanguageCode = "en-US";

export function normalizeLanguage(language: unknown): LanguageCode {
    return language === "hu-HU" ? "hu-HU" : DEFAULT_LANGUAGE;
}

export function translate(language: unknown, key: ExtensionMessageKey): string {
    return messages[normalizeLanguage(language)][key] ?? enUS[key];
}
