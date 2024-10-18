import { useEffect } from "react";
import LoadingScreen from "../general/LoadingScreen";
import { useGlobalContext } from "../state/context";
import { useGlobalStore } from "../state/state"
import Markdown from "react-markdown";

export default () => {
    const { gitChord } = useGlobalContext();
    const update = useGlobalStore((state) => state.update);
    const help = useGlobalStore((state) => state.help);

    useEffect(() => {
        gitChord.help().then(help => { update((state) => { state.help = help; }); });
    }, [gitChord]);

    if (help === null) {
        return <LoadingScreen />;
    }

    return <Markdown>{help}</Markdown>;
}
