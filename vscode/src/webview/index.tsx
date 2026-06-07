import {
    CommandExecutorGitChord,
    CommandResult,
    GitChordContext,
    GitChordGui,
    normalizeLanguage,
    translate,
} from '@git-chord/gui-core';
import type { CommandExecutorInterface, GitGraphData, GitInterface, LanguageCode, PageGroup, PageIntent, PageOpenRequest } from '@git-chord/gui-core';
import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary';
import { MemoryRouter, useNavigate } from 'react-router-dom'

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

declare global {
    interface Window {
        __GIT_CHORD_INITIAL_STATE__?: {
            group?: PageGroup;
            path?: string;
            intent?: PageIntent;
            currentRepoRoot?: string | null;
            language?: LanguageCode;
        };
    }
}

type PendingRequest = {
    resolve: (result: CommandResult) => void;
    timeoutId: number;
};

type PendingGraphRequest = {
    resolve: (result: GitGraphData) => void;
    timeoutId: number;
};

type ExecResultMessage = {
    type?: string;
    id?: string;
    path?: string;
    intent?: PageIntent;
    repoRoot?: string | null;
    language?: unknown;
    result?: {
        status?: number;
        stdout?: string;
        stderr?: string;
    };
    graph?: GitGraphData;
};

class VsCodeCommandExecutor implements CommandExecutorInterface, GitInterface {

    private readonly vscode = acquireVsCodeApi();

    private readonly pendingRequests = new Map<string, PendingRequest>();

    private readonly pendingGraphRequests = new Map<string, PendingGraphRequest>();

    private nextRequestId = 1;

    constructor(private readonly getLanguage: () => LanguageCode) {
        window.addEventListener('message', event => {
            this.handleMessage(event.data as ExecResultMessage);
        });
    }

    graph(commitIds: readonly string[]): Promise<GitGraphData> {
        const id = `${this.nextRequestId++}`;
        const timeoutId = window.setTimeout(() => {
            const pendingRequest = this.pendingGraphRequests.get(id);
            if (!pendingRequest) {
                return;
            }
            this.pendingGraphRequests.delete(id);
            pendingRequest.resolve({ commits: [] });
        }, 30000);

        return new Promise(resolve => {
            this.pendingGraphRequests.set(id, { resolve, timeoutId });
            this.vscode.postMessage({ type: 'gitGraph', id, commitIds });
        });
    }

    exec(command: string[]): Promise<CommandResult> {
        const id = `${this.nextRequestId++}`;
        const timeoutId = window.setTimeout(() => {
            const pendingRequest = this.pendingRequests.get(id);
            if (!pendingRequest) {
                return;
            }
            this.pendingRequests.delete(id);
            pendingRequest.resolve(new CommandResult(1, '', translate(this.getLanguage(), 'extension.timeout')));
        }, 30000);

        return new Promise(resolve => {
            this.pendingRequests.set(id, { resolve, timeoutId });
            this.vscode.postMessage({ type: 'exec', id, command });
        });
    }

    openPage(request: PageOpenRequest) {
        this.vscode.postMessage({ type: 'openPage', request });
    }

    requestRepoContext() {
        this.vscode.postMessage({ type: 'requestRepoContext' });
    }

    setLanguage(language: LanguageCode) {
        this.vscode.postMessage({ type: 'setLanguage', language });
    }

    openCommit(commitId: string) {
        this.vscode.postMessage({ type: 'openCommit', commitId });
    }

    private handleMessage(message: ExecResultMessage) {
        if (message.type === 'gitGraphResult' && typeof message.id === 'string') {
            const pendingRequest = this.pendingGraphRequests.get(message.id);
            if (!pendingRequest) {
                return;
            }

            this.pendingGraphRequests.delete(message.id);
            window.clearTimeout(pendingRequest.timeoutId);
            pendingRequest.resolve({
                commits: Array.isArray(message.graph?.commits) ? message.graph.commits : [],
            });
            return;
        }

        if (message.type !== 'execResult' || typeof message.id !== 'string') {
            return;
        }

        const pendingRequest = this.pendingRequests.get(message.id);
        if (!pendingRequest) {
            return;
        }

        this.pendingRequests.delete(message.id);
        window.clearTimeout(pendingRequest.timeoutId);

        const result = message.result ?? {};
        pendingRequest.resolve(new CommandResult(
            result.status ?? 1,
            result.stdout ?? '',
            result.stderr ?? '',
        ));
    }

}

const initialState = window.__GIT_CHORD_INITIAL_STATE__ ?? {};
let activeLanguage = normalizeLanguage(initialState.language);
const commandExecutor = new VsCodeCommandExecutor(() => activeLanguage);
const gitChord = new CommandExecutorGitChord(commandExecutor);
const pageGroup = initialState.group ?? { type: 'global' as const };
const initialPath = initialState.path ?? '/';
const initialEntry = initialState.intent ? { pathname: initialPath, state: { intent: initialState.intent } } : initialPath;

function HostBridge({
    language,
    onLanguageChange,
    onRepoContextChange,
}: {
    language: LanguageCode,
    onLanguageChange: (language: LanguageCode) => void,
    onRepoContextChange: (repoRoot: string | null) => void,
}) {
    const navigate = useNavigate();

    useEffect(() => {
        activeLanguage = language;
        document.documentElement.lang = language;
    }, [language]);

    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            const message = event.data as ExecResultMessage;
            if (message.type === 'navigate' && typeof message.path === 'string') {
                navigate(message.path, message.intent ? { state: { intent: message.intent } } : undefined);
            } else if (message.type === 'repoContext') {
                onRepoContextChange(typeof message.repoRoot === 'string' ? message.repoRoot : null);
            } else if (message.type === 'language') {
                onLanguageChange(normalizeLanguage(message.language));
            }
        }

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [navigate, onLanguageChange, onRepoContextChange]);

    useEffect(() => {
        commandExecutor.requestRepoContext();
    }, []);

    return null;
}

function fallbackRender(props: any) {
    const error = props.error as Error;
    const language = activeLanguage;
    return (
        <div role="alert">
        <p>{translate(language, 'errorBoundary.heading')}</p>
        <pre style={{ color: "red" }}>{error.name}</pre>
        <hr />
        <pre style={{ color: "red" }}>{error.message}</pre>
        <hr />
        <pre style={{ color: "red" }}>{error.stack}</pre>
        </div>
    );
}

function App() {
    const [currentRepoRoot, setCurrentRepoRoot] = React.useState<string | null | undefined>(initialState.currentRepoRoot);
    const [language, setLanguage] = React.useState<LanguageCode>(normalizeLanguage(initialState.language));

    function changeLanguage(nextLanguage: LanguageCode) {
        const normalizedLanguage = normalizeLanguage(nextLanguage);
        activeLanguage = normalizedLanguage;
        setLanguage(normalizedLanguage);
        commandExecutor.setLanguage(normalizedLanguage);
    }

    return (
        <GitChordContext.Provider value={{
            gitChord,
            git: commandExecutor,
            pageGroup,
            currentRepoRoot,
            language,
            onLanguageChange: changeLanguage,
            onCommitOpen: commitId => commandExecutor.openCommit(commitId),
            openPage: request => commandExecutor.openPage(request),
            uiControls: {
                languageSwitcher: true,
                themeSwitcher: false,
            },
        }}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <HostBridge
                    language={language}
                    onLanguageChange={setLanguage}
                    onRepoContextChange={setCurrentRepoRoot}
                />
                <GitChordGui />
            </MemoryRouter>
        </GitChordContext.Provider>
    );
}
  
createRoot(document.getElementById('root')!).render(
    <ErrorBoundary fallbackRender={fallbackRender}>
        <App />
    </ErrorBoundary>
);
