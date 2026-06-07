import {
    CommandExecutorGitChord,
    CommandResult,
    GitChordContext,
    GitChordGui,
    normalizeLanguage,
    translate,
} from '@git-chord/gui-core';
import type { CommandExecutorInterface, GitGraphData, GitInterface, LanguageCode, PageGroup, PageIntent, PageOpenRequest } from '@git-chord/gui-core';
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { MemoryRouter, useNavigate } from 'react-router-dom';

declare global {
    interface Window {
        gitChordEclipsePost?: (request: string) => void;
        __GIT_CHORD_ECLIPSE_RECEIVE__?: (message: HostMessage) => void;
    }
}

type InitialState = {
    group?: PageGroup;
    path?: string;
    intent?: PageIntent;
    currentRepoRoot?: string | null;
    language?: LanguageCode;
};

type HostMessage = InitialState & {
    type?: string;
    id?: string;
    repoRoot?: string | null;
    result?: {
        status?: number;
        stdout?: string;
        stderr?: string;
    };
    graph?: GitGraphData;
};

type PendingRequest = {
    resolve: (result: CommandResult) => void;
    timeoutId: number;
};

type PendingGraphRequest = {
    resolve: (result: GitGraphData) => void;
    timeoutId: number;
};

const hostMessageListeners = new Set<(message: HostMessage) => void>();

window.__GIT_CHORD_ECLIPSE_RECEIVE__ = message => {
    hostMessageListeners.forEach(listener => listener(message));
};

function addHostMessageListener(listener: (message: HostMessage) => void) {
    hostMessageListeners.add(listener);
    return () => {
        hostMessageListeners.delete(listener);
    };
}

function postHostMessage(message: unknown) {
    if (typeof window.gitChordEclipsePost !== 'function') {
        console.error('Eclipse host bridge is not available.');
        return;
    }

    window.gitChordEclipsePost(JSON.stringify(message));
}

class EclipseCommandExecutor implements CommandExecutorInterface, GitInterface {

    private readonly pendingRequests = new Map<string, PendingRequest>();

    private readonly pendingGraphRequests = new Map<string, PendingGraphRequest>();

    private nextRequestId = 1;

    constructor(private readonly getLanguage: () => LanguageCode) {
        addHostMessageListener(message => this.handleMessage(message));
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
            postHostMessage({ type: 'gitGraph', id, commitIds });
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
            postHostMessage({ type: 'exec', id, command });
        });
    }

    requestInitialState() {
        postHostMessage({ type: 'requestInitialState' });
    }

    requestRepoContext() {
        postHostMessage({ type: 'requestRepoContext' });
    }

    openPage(request: PageOpenRequest) {
        postHostMessage({ type: 'openPage', request });
    }

    setLanguage(language: LanguageCode) {
        postHostMessage({ type: 'setLanguage', language });
    }

    openCommit(commitId: string) {
        postHostMessage({ type: 'openCommit', commitId });
    }

    private handleMessage(message: HostMessage) {
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

let activeLanguage: LanguageCode = 'en-US';
const commandExecutor = new EclipseCommandExecutor(() => activeLanguage);
const gitChord = new CommandExecutorGitChord(commandExecutor);

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
        return addHostMessageListener(message => {
            if (message.type === 'navigate' && typeof message.path === 'string') {
                navigate(message.path, message.intent ? { state: { intent: message.intent } } : undefined);
            } else if (message.type === 'repoContext') {
                onRepoContextChange(typeof message.repoRoot === 'string' ? message.repoRoot : null);
            } else if (message.type === 'language') {
                onLanguageChange(normalizeLanguage(message.language));
            }
        });
    }, [navigate, onLanguageChange, onRepoContextChange]);

    useEffect(() => {
        commandExecutor.requestRepoContext();
    }, []);

    return null;
}

function App() {
    const [initialState, setInitialState] = React.useState<InitialState | null>(null);
    const [currentRepoRoot, setCurrentRepoRoot] = React.useState<string | null>(null);
    const [language, setLanguage] = React.useState<LanguageCode>('en-US');

    useEffect(() => {
        const removeListener = addHostMessageListener(message => {
            if (message.type !== 'initialState') {
                return;
            }

            const nextLanguage = normalizeLanguage(message.language);
            activeLanguage = nextLanguage;
            setLanguage(nextLanguage);
            setCurrentRepoRoot(typeof message.currentRepoRoot === 'string' ? message.currentRepoRoot : null);
            setInitialState(message);
        });
        commandExecutor.requestInitialState();
        return removeListener;
    }, []);

    if (!initialState) {
        return <div className="gc-loading-shell">Loading Git Chord...</div>;
    }

    const pageGroup = initialState.group ?? { type: 'global' as const };
    const initialPath = initialState.path ?? '/about';
    const initialEntry = initialState.intent ? { pathname: initialPath, state: { intent: initialState.intent } } : initialPath;

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

function fallbackRender(props: { error: Error }) {
    const error = props.error;
    return (
        <div role="alert">
            <p>{translate(activeLanguage, 'errorBoundary.heading')}</p>
            <pre style={{ color: 'red' }}>{error.name}</pre>
            <hr />
            <pre style={{ color: 'red' }}>{error.message}</pre>
            <hr />
            <pre style={{ color: 'red' }}>{error.stack}</pre>
        </div>
    );
}

createRoot(document.getElementById('root')!).render(
    <ErrorBoundary fallbackRender={fallbackRender}>
        <App />
    </ErrorBoundary>
);
