import enUS, { Messages } from "./en-US";
import huHU from "./hu-HU";

export type LanguageCode = "en-US" | "hu-HU";
export type MessageKey = keyof Messages;
export type TranslationValues = Record<string, string | number>;

export const DEFAULT_LANGUAGE: LanguageCode = "en-US";

export const LANGUAGE_OPTIONS: Array<{ code: LanguageCode, flag: string, nativeNameKey: MessageKey }> = [
    { code: "en-US", flag: "🇺🇸", nativeNameKey: "language.englishNative" },
    { code: "hu-HU", flag: "🇭🇺", nativeNameKey: "language.hungarianNative" },
];

export const messages: Record<LanguageCode, Messages> = {
    "en-US": enUS,
    "hu-HU": huHU,
};

export function normalizeLanguage(language: unknown): LanguageCode {
    return language === "hu-HU" ? "hu-HU" : DEFAULT_LANGUAGE;
}

export function translate(language: unknown, key: MessageKey, values: TranslationValues = {}): string {
    const resolvedLanguage = normalizeLanguage(language);
    const template = messages[resolvedLanguage][key] ?? enUS[key];
    return template.replace(/\{(\w+)\}/g, (_, name: string) => `${values[name] ?? ""}`);
}
