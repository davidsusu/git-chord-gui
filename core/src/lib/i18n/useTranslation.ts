import { useMemo } from "react";
import { useGlobalContext } from "../components/state/context";
import { LANGUAGE_OPTIONS, MessageKey, normalizeLanguage, translate, TranslationValues } from ".";

export function useTranslation() {
    const { language, onLanguageChange } = useGlobalContext();
    const resolvedLanguage = normalizeLanguage(language);

    return useMemo(() => ({
        language: resolvedLanguage,
        languages: LANGUAGE_OPTIONS,
        setLanguage: onLanguageChange,
        t: (key: MessageKey, values?: TranslationValues) => translate(resolvedLanguage, key, values),
    }), [onLanguageChange, resolvedLanguage]);
}
