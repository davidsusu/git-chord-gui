import {
    CommandExecutorGitChord,
    CommandResult,
    GitChordContext,
    GitChordGui,
} from '@git-chord/gui-core';
import type { CommandExecutorInterface, PageGroup, PageOpenRequest } from '@git-chord/gui-core';
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
        };
    }
}

type PendingRequest = {
    resolve: (result: CommandResult) => void;
    timeoutId: number;
};

type ExecResultMessage = {
    type?: string;
    id?: string;
    result?: {
        status?: number;
        stdout?: string;
        stderr?: string;
    };
};

class VsCodeCommandExecutor implements CommandExecutorInterface {

    private readonly vscode = acquireVsCodeApi();

    private readonly pendingRequests = new Map<string, PendingRequest>();

    private nextRequestId = 1;

    constructor() {
        window.addEventListener('message', event => {
            this.handleMessage(event.data as ExecResultMessage);
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
            pendingRequest.resolve(new CommandResult(1, '', 'Timed out while executing git chord command.'));
        }, 30000);

        return new Promise(resolve => {
            this.pendingRequests.set(id, { resolve, timeoutId });
            this.vscode.postMessage({ type: 'exec', id, command });
        });
    }

    openPage(request: PageOpenRequest) {
        this.vscode.postMessage({ type: 'openPage', request });
    }

    private handleMessage(message: ExecResultMessage) {
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

const commandExecutor = new VsCodeCommandExecutor();
const gitChord = new CommandExecutorGitChord(commandExecutor);
const initialState = window.__GIT_CHORD_INITIAL_STATE__ ?? {};
const pageGroup = initialState.group ?? { type: 'global' as const };
const initialPath = initialState.path ?? '/';

function HostNavigation() {
    const navigate = useNavigate();

    useEffect(() => {
        function handleMessage(event: MessageEvent) {
            const message = event.data as { type?: string, path?: string };
            if (message.type === 'navigate' && typeof message.path === 'string') {
                navigate(message.path);
            }
        }

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [navigate]);

    return null;
}

function fallbackRender(props: any) {
    const error = props.error as Error;
    return (
        <div role="alert">
        <p>Something went wrong:</p>
        <pre style={{ color: "red" }}>{error.name}</pre>
        <hr />
        <pre style={{ color: "red" }}>{error.message}</pre>
        <hr />
        <pre style={{ color: "red" }}>{error.stack}</pre>
        </div>
    );
}
  
createRoot(document.getElementById('root')!).render(
    <ErrorBoundary fallbackRender={fallbackRender}>
        <GitChordContext.Provider value={{ gitChord, pageGroup, openPage: request => commandExecutor.openPage(request) }}>
            <MemoryRouter initialEntries={[initialPath]}>
                <HostNavigation />
                <GitChordGui />
            </MemoryRouter>
        </GitChordContext.Provider>
    </ErrorBoundary>
);
