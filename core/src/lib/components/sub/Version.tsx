import React from "react";
import { useEffect } from "react";
import LoadingScreen from "../general/LoadingScreen";
import { useGlobalContext } from "../state/context";
import { useGlobalStore } from "../state/state"
import { useTranslation } from "../../i18n/useTranslation";

export default function Version() {
    const { gitChord } = useGlobalContext();
    const { t } = useTranslation();
    const update = useGlobalStore((state) => state.update);
    const version = useGlobalStore((state) => state.version);

    useEffect(() => {
        gitChord.version().then(version => { update((state) => { state.version = version; }); });
    }, [gitChord]);

    if (version === null) {
        return <LoadingScreen />;
    } else if (version === "") {
        return <>
            <p>{t("version.failed")}</p>
        </>;
    }

    return <p>{t("version.value", { version })}</p>;
}
