import React from "react";
import { useTranslation } from "../../i18n/useTranslation";

export default function LoadingScreen() {
    const { t } = useTranslation();

    return (
        <div className="gc-loading" role="status" aria-live="polite">
            <span className="gc-loading-dot" aria-hidden="true" />
            <span>{t("common.loading")}</span>
        </div>
    );
}
