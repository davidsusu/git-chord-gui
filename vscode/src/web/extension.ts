import { execFile } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

type PanelGroup =
    | { type: 'global' }
    | { type: 'repo', repoRoot: string };

type PanelRecord = {
    panel: vscode.WebviewPanel;
    group: PanelGroup;
    disposables: vscode.Disposable[];
};

type WebviewMessage = {
    type?: string;
    id?: string;
    command?: unknown;
    request?: unknown;
};

type PageOpenRequest = {
    type?: unknown;
    path?: unknown;
    repoRoot?: unknown;
};

const panels = new Map<string, PanelRecord>();

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('git-chord.about', () => {
            openGitChordPanel(context, { type: 'global' }, '/about');
        }),
        vscode.commands.registerCommand('git-chord.cliHelp', () => {
            openGitChordPanel(context, { type: 'global' }, '/cli-help');
        }),
        vscode.commands.registerCommand('git-chord.repoState', () => {
            void openCurrentRepoPage(context, '/');
        }),
        vscode.commands.registerCommand('git-chord.repoStateFromExplorer', (uri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
            void openExplorerRepoState(context, uri, selectedUris);
        }),
    );

    if (vscode.workspace.getConfiguration('gitChord').get<boolean>('openOnStartup')) {
        setTimeout(() => openGitChordPanel(context, { type: 'global' }, '/about'), 500);
    }
}

function openGitChordPanel(context: vscode.ExtensionContext, group: PanelGroup, pagePath: string): PanelRecord {
    const key = panelGroupKey(group);
    const existingRecord = panels.get(key);
    if (existingRecord) {
        existingRecord.panel.reveal(vscode.ViewColumn.One);
        void existingRecord.panel.webview.postMessage({ type: 'navigate', path: pagePath });
        return existingRecord;
    }

    const panel = vscode.window.createWebviewPanel(
        'git-chord-panel',
        group.type === 'global' ? 'Git Chord' : `Git Chord: ${path.basename(group.repoRoot) || group.repoRoot}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
            ],
        },
    );

    const record: PanelRecord = {
        panel,
        group,
        disposables: [],
    };
    panels.set(key, record);

    panel.onDidDispose(() => {
        panels.delete(key);
        record.disposables.forEach(disposable => disposable.dispose());
    }, null, context.subscriptions);

    record.disposables.push(panel.webview.onDidReceiveMessage(message => {
        void handleWebviewMessage(context, record, message as WebviewMessage);
    }));

    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri, group, pagePath);
    return record;
}

async function openCurrentRepoPage(context: vscode.ExtensionContext, pagePath: string, sourceRecord?: PanelRecord) {
    const repoRoot = await resolveCurrentRepoRoot();
    if (!repoRoot) {
        void vscode.window.showErrorMessage('No Git repository found for the current context.');
        const fallbackPath = pagePath === '/' ? '/repo-state' : pagePath;
        if (sourceRecord) {
            await sourceRecord.panel.webview.postMessage({ type: 'navigate', path: fallbackPath });
            return;
        }
        openGitChordPanel(context, { type: 'global' }, fallbackPath);
        return;
    }

    openGitChordPanel(context, { type: 'repo', repoRoot }, pagePath);
}

async function openExplorerRepoState(context: vscode.ExtensionContext, uri?: vscode.Uri, selectedUris?: vscode.Uri[]) {
    const targetUri = uri ?? selectedUris?.[0];
    if (!targetUri || targetUri.scheme !== 'file') {
        void vscode.window.showErrorMessage('No file-system resource was selected.');
        return;
    }

    const repoRoot = await resolveRepoRootForUri(targetUri);
    if (!repoRoot) {
        void vscode.window.showErrorMessage('No Git repository found for the selected resource.');
        return;
    }

    openGitChordPanel(context, { type: 'repo', repoRoot }, '/');
}

async function handleWebviewMessage(context: vscode.ExtensionContext, record: PanelRecord, message: WebviewMessage) {
    if (message.type === 'openPage') {
        await handleOpenPageRequest(context, record, message.request as PageOpenRequest);
        return;
    }

    if (message.type !== 'exec' || typeof message.id !== 'string' || !Array.isArray(message.command)) {
        return;
    }

    const command = message.command;
    if (!isGitChordCommand(command)) {
        await record.panel.webview.postMessage({
            type: 'execResult',
            id: message.id,
            result: {
                status: 1,
                stdout: '',
                stderr: 'Rejected command: only git chord commands are allowed.',
            },
        });
        return;
    }

    const result = await execCommand(command, resolveCommandWorkingDirectory(record.group));
    await record.panel.webview.postMessage({
        type: 'execResult',
        id: message.id,
        result,
    });
}

async function handleOpenPageRequest(context: vscode.ExtensionContext, sourceRecord: PanelRecord, request: PageOpenRequest) {
    const pagePath = typeof request.path === 'string' ? request.path : '/';

    if (request.type === 'global') {
        openGitChordPanel(context, { type: 'global' }, pagePath);
        return;
    }

    if (request.type === 'repo' && typeof request.repoRoot === 'string') {
        openGitChordPanel(context, { type: 'repo', repoRoot: request.repoRoot }, pagePath);
        return;
    }

    if (request.type === 'currentRepo') {
        await openCurrentRepoPage(context, pagePath, sourceRecord);
    }
}

function isGitChordCommand(command: unknown[]): command is string[] {
    return command.every(part => typeof part === 'string') &&
        command.length >= 2 &&
        command[0] === 'git' &&
        command[1] === 'chord';
}

function execCommand(command: string[], cwd: string | undefined): Promise<{ status: number; stdout: string; stderr: string }> {
    const { file, args } = resolveExecutable(command);
    return new Promise(resolve => {
        execFile(file, args, {
            cwd,
            maxBuffer: 10 * 1024 * 1024,
            windowsHide: true,
        }, (error, stdout, stderr) => {
            const status = typeof error?.code === 'number' ? error.code : (error ? 1 : 0);
            resolve({ status, stdout, stderr: stderr || error?.message || '' });
        });
    });
}

function resolveExecutable(command: string[]): { file: string; args: string[] } {
    const configuredCommandPath = vscode.workspace.getConfiguration('gitChord').get<string>('commandPath')?.trim();
    if (configuredCommandPath) {
        return {
            file: configuredCommandPath,
            args: command.slice(2),
        };
    }

    const [file, ...args] = command;
    return { file, args };
}

function resolveCommandWorkingDirectory(group: PanelGroup): string | undefined {
    if (group.type === 'repo') {
        return group.repoRoot;
    }
    return resolveWorkspaceWorkingDirectory();
}

function resolveWorkspaceWorkingDirectory(): string | undefined {
    const activeDocumentUri = vscode.window.activeTextEditor?.document.uri;
    const activeWorkspaceFolder = activeDocumentUri ? vscode.workspace.getWorkspaceFolder(activeDocumentUri) : undefined;
    const workspaceFolder = activeWorkspaceFolder ?? vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.scheme === 'file' ? workspaceFolder.uri.fsPath : undefined;
}

async function resolveCurrentRepoRoot(): Promise<string | undefined> {
    const activeDocumentUri = vscode.window.activeTextEditor?.document.uri;
    if (activeDocumentUri?.scheme === 'file') {
        const repoRoot = await resolveRepoRootForUri(activeDocumentUri);
        if (repoRoot) {
            return repoRoot;
        }
    }

    for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
        if (workspaceFolder.uri.scheme !== 'file') {
            continue;
        }
        const repoRoot = await resolveRepoRootForUri(workspaceFolder.uri);
        if (repoRoot) {
            return repoRoot;
        }
    }

    return undefined;
}

async function resolveRepoRootForUri(uri: vscode.Uri): Promise<string | undefined> {
    if (uri.scheme !== 'file') {
        return undefined;
    }

    let candidatePath = uri.fsPath;
    try {
        const stat = await vscode.workspace.fs.stat(uri);
        if ((stat.type & vscode.FileType.Directory) === 0) {
            candidatePath = path.dirname(candidatePath);
        }
    } catch {
        candidatePath = path.dirname(candidatePath);
    }

    return resolveRepoRootForPath(candidatePath);
}

function resolveRepoRootForPath(candidatePath: string): Promise<string | undefined> {
    return new Promise(resolve => {
        execFile('git', ['-C', candidatePath, 'rev-parse', '--show-toplevel'], {
            maxBuffer: 1024 * 1024,
            windowsHide: true,
        }, (error, stdout) => {
            if (error) {
                resolve(undefined);
                return;
            }

            const repoRoot = stdout.trim();
            resolve(repoRoot || undefined);
        });
    });
}

function panelGroupKey(group: PanelGroup): string {
    if (group.type === 'global') {
        return 'global';
    }
    return `repo:${group.repoRoot}`;
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, group: PanelGroup, pagePath: string) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.js')).toString();
    const nonce = getNonce();
    const initialState = JSON.stringify({ group, path: pagePath }).replace(/</g, '\\u003c');
    return `
		<!DOCTYPE html>
		<html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Git Chord</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}">window.__GIT_CHORD_INITIAL_STATE__ = ${initialState};</script>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
		</html>
    `;
}

function getNonce() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
}

export function deactivate() {}
