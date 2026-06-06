import WebGitChordApp from "../../components/WebGitChordApp";

export default function AppPage() {
    return (
        <WebGitChordApp repoRoot={process.env.GIT_CHORD_WEB_REPO_ROOT || null} />
    );
}
