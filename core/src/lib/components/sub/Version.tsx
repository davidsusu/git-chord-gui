import React from "react";
import { useEffect } from "react";
import LoadingScreen from "../general/LoadingScreen";
import { useGlobalContext } from "../state/context";
import { useGlobalStore } from "../state/state"

export default function Version() {
    const { gitChord } = useGlobalContext();
    const update = useGlobalStore((state) => state.update);
    const version = useGlobalStore((state) => state.version);

    useEffect(() => {
        gitChord.version().then(version => { update((state) => { state.version = version; }); });
    }, [gitChord]);

    if (version === null) {
        return <LoadingScreen />;
    } else if (version === "") {
        return <>
            <p>Failed to detect Git Chord version!</p>
        </>;
    }

    return <p>Version: {version}</p>;
}
