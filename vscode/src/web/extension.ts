import { execFile } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { DEFAULT_LANGUAGE, normalizeLanguage, translate } from './i18n';
import type { LanguageCode } from './i18n';

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
    commitIds?: unknown;
    request?: unknown;
    language?: unknown;
    commitId?: unknown;
};

type GitGraphCommit = {
    id: string;
    parentIds: string[];
    refs: string[];
    subject: string;
    timestamp: number | null;
};

type GitGraphData = {
    commits: GitGraphCommit[];
};

type PageOpenRequest = {
    type?: unknown;
    path?: unknown;
    repoRoot?: unknown;
    intent?: unknown;
};

const panels = new Map<string, PanelRecord>();
const CREATE_SNAPSHOT_INTENT = { type: 'createSnapshot' };
const COMMIT_DOCUMENT_SCHEME = 'git-chord-commit';
const COMMIT_ID_PATTERN = /^[0-9a-f]{7,40}$/i;

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(COMMIT_DOCUMENT_SCHEME, {
            provideTextDocumentContent: provideCommitDocumentContent,
        }),
        vscode.commands.registerCommand('git-chord.about', () => {
            openGitChordPanel(context, { type: 'global' }, '/about');
        }),
        vscode.commands.registerCommand('git-chord.cliHelp', () => {
            openGitChordPanel(context, { type: 'global' }, '/cli-help');
        }),
        vscode.commands.registerCommand('git-chord.repoState', () => {
            void openCurrentRepoPage(context, '/');
        }),
        vscode.commands.registerCommand('git-chord.createSnapshot', () => {
            void openCurrentRepoPage(context, '/', undefined, CREATE_SNAPSHOT_INTENT);
        }),
        vscode.commands.registerCommand('git-chord.repoStateFromExplorer', (uri?: vscode.Uri, selectedUris?: vscode.Uri[]) => {
            void openExplorerRepoState(context, uri, selectedUris);
        }),
        vscode.window.onDidChangeActiveTextEditor(() => {
            void refreshGlobalPanelRepoContext();
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            void refreshGlobalPanelRepoContext();
        }),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('gitChord.language')) {
                void broadcastLanguage();
            }
        }),
    );

    if (vscode.workspace.getConfiguration('gitChord').get<boolean>('openOnStartup')) {
        setTimeout(() => openGitChordPanel(context, { type: 'global' }, '/about'), 500);
    }
}

function openGitChordPanel(context: vscode.ExtensionContext, group: PanelGroup, pagePath: string, intent?: unknown): PanelRecord {
    const key = panelGroupKey(group);
    const existingRecord = panels.get(key);
    if (existingRecord) {
        existingRecord.panel.reveal(vscode.ViewColumn.One);
        void existingRecord.panel.webview.postMessage({ type: 'navigate', path: pagePath, intent });
        void refreshPanelRepoContext(existingRecord);
        void refreshPanelLanguage(existingRecord);
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

    panel.webview.html = getWebviewContent(panel.webview, context.extensionUri, group, pagePath, intent);
    void refreshPanelRepoContext(record);
    void refreshPanelLanguage(record);
    return record;
}

async function openCurrentRepoPage(context: vscode.ExtensionContext, pagePath: string, sourceRecord?: PanelRecord, intent?: unknown) {
    const repoRoot = await resolveCurrentRepoRoot();
    if (!repoRoot) {
        void vscode.window.showErrorMessage(translate(getConfiguredLanguage(), 'extension.noRepoCurrent'));
        const fallbackPath = pagePath === '/' ? '/repo-state' : pagePath;
        if (sourceRecord) {
            await sourceRecord.panel.webview.postMessage({ type: 'navigate', path: fallbackPath, intent });
            return;
        }
        openGitChordPanel(context, { type: 'global' }, fallbackPath, intent);
        return;
    }

    openGitChordPanel(context, { type: 'repo', repoRoot }, pagePath, intent);
}

async function openExplorerRepoState(context: vscode.ExtensionContext, uri?: vscode.Uri, selectedUris?: vscode.Uri[]) {
    const targetUri = uri ?? selectedUris?.[0];
    if (!targetUri || targetUri.scheme !== 'file') {
        void vscode.window.showErrorMessage(translate(getConfiguredLanguage(), 'extension.noFileSelected'));
        return;
    }

    const repoRoot = await resolveRepoRootForUri(targetUri);
    if (!repoRoot) {
        void vscode.window.showErrorMessage(translate(getConfiguredLanguage(), 'extension.noRepoSelected'));
        return;
    }

    openGitChordPanel(context, { type: 'repo', repoRoot }, '/');
}

async function handleWebviewMessage(context: vscode.ExtensionContext, record: PanelRecord, message: WebviewMessage) {
    if (message.type === 'requestRepoContext') {
        await refreshPanelRepoContext(record);
        return;
    }

    if (message.type === 'openPage') {
        await handleOpenPageRequest(context, record, message.request as PageOpenRequest);
        return;
    }

    if (message.type === 'setLanguage') {
        await handleSetLanguage(message.language);
        return;
    }

    if (message.type === 'openCommit') {
        await handleOpenCommit(record, message.commitId);
        return;
    }

    if (message.type === 'gitGraph') {
        await handleGitGraph(record, message.id, message.commitIds);
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
                stderr: translate(getConfiguredLanguage(), 'extension.rejectedCommand'),
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

async function handleGitGraph(record: PanelRecord, id: unknown, commitIdsValue: unknown) {
    if (typeof id !== 'string' || !Array.isArray(commitIdsValue)) {
        return;
    }

    const commitIds = commitIdsValue.filter((commitId): commitId is string => typeof commitId === 'string');
    const repoRoot = record.group.type === 'repo' ? record.group.repoRoot : await resolveCurrentRepoRoot();
    const graph = repoRoot ? await execGitGraph(repoRoot, commitIds) : { commits: [] };
    await record.panel.webview.postMessage({
        type: 'gitGraphResult',
        id,
        graph,
    });
}

async function handleOpenPageRequest(context: vscode.ExtensionContext, sourceRecord: PanelRecord, request: PageOpenRequest) {
    const pagePath = typeof request.path === 'string' ? request.path : '/';

    if (request.type === 'global') {
        openGitChordPanel(context, { type: 'global' }, pagePath);
        return;
    }

    if (request.type === 'repo' && typeof request.repoRoot === 'string') {
        openGitChordPanel(context, { type: 'repo', repoRoot: request.repoRoot }, pagePath, request.intent);
        return;
    }

    if (request.type === 'currentRepo') {
        await openCurrentRepoPage(context, pagePath, sourceRecord, request.intent);
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

async function refreshGlobalPanelRepoContext() {
    const globalRecord = panels.get('global');
    if (!globalRecord) {
        return;
    }
    await refreshPanelRepoContext(globalRecord);
}

async function refreshPanelRepoContext(record: PanelRecord) {
    const repoRoot = record.group.type === 'repo' ? record.group.repoRoot : await resolveCurrentRepoRoot();
    await record.panel.webview.postMessage({
        type: 'repoContext',
        repoRoot: repoRoot ?? null,
    });
}

async function refreshPanelLanguage(record: PanelRecord) {
    await record.panel.webview.postMessage({
        type: 'language',
        language: getConfiguredLanguage(),
    });
}

async function broadcastLanguage() {
    await Promise.all(Array.from(panels.values()).map(refreshPanelLanguage));
}

async function handleSetLanguage(language: unknown) {
    const normalizedLanguage = normalizeLanguage(language);
    await vscode.workspace.getConfiguration('gitChord').update('language', normalizedLanguage, vscode.ConfigurationTarget.Global);
    await broadcastLanguage();
}

async function handleOpenCommit(record: PanelRecord, commitId: unknown) {
    if (typeof commitId !== 'string' || !COMMIT_ID_PATTERN.test(commitId)) {
        void vscode.window.showErrorMessage(translate(getConfiguredLanguage(), 'extension.invalidCommit'));
        return;
    }

    const repoRoot = record.group.type === 'repo' ? record.group.repoRoot : await resolveCurrentRepoRoot();
    if (!repoRoot) {
        void vscode.window.showErrorMessage(translate(getConfiguredLanguage(), 'extension.noRepoCurrent'));
        return;
    }

    const query = new URLSearchParams({ repoRoot, commitId }).toString();
    const uri = vscode.Uri.from({
        scheme: COMMIT_DOCUMENT_SCHEME,
        authority: 'commit',
        path: `/${commitId.slice(0, 12)}.diff`,
        query,
    });

    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const diffDocument = document.languageId === 'diff'
            ? document
            : await vscode.languages.setTextDocumentLanguage(document, 'diff');
        await vscode.window.showTextDocument(diffDocument, { preview: true });
    } catch {
        void vscode.window.showErrorMessage(translate(getConfiguredLanguage(), 'extension.commitOpenFailed'));
    }
}

async function provideCommitDocumentContent(uri: vscode.Uri): Promise<string> {
    const params = new URLSearchParams(uri.query);
    const repoRoot = params.get('repoRoot') ?? '';
    const commitId = params.get('commitId') ?? '';

    if (!repoRoot || !COMMIT_ID_PATTERN.test(commitId)) {
        return translate(getConfiguredLanguage(), 'extension.invalidCommit');
    }

    const result = await execGitShowCommit(repoRoot, commitId);
    if (result.status !== 0) {
        return result.stderr || translate(getConfiguredLanguage(), 'extension.commitOpenFailed');
    }
    return result.stdout;
}

function execGitShowCommit(repoRoot: string, commitId: string): Promise<{ status: number; stdout: string; stderr: string }> {
    return new Promise(resolve => {
        execFile('git', ['-C', repoRoot, 'show', '--stat', '--patch', '--find-renames', '--find-copies', '--color=never', commitId], {
            maxBuffer: 20 * 1024 * 1024,
            windowsHide: true,
        }, (error, stdout, stderr) => {
            const status = typeof error?.code === 'number' ? error.code : (error ? 1 : 0);
            resolve({ status, stdout, stderr: stderr || error?.message || '' });
        });
    });
}

async function execGitGraph(repoRoot: string, commitIds: string[]): Promise<GitGraphData> {
    const normalizedCommitIds = Array.from(new Set(commitIds.filter(commitId => COMMIT_ID_PATTERN.test(commitId))));
    if (normalizedCommitIds.length === 0) {
        return { commits: [] };
    }

    const result = await execGitCommand(repoRoot, [
        'log',
        '--no-color',
        '--topo-order',
        '--date-order',
        '--max-count=80',
        '--format=%H%x00%P%x00%ct%x00%D%x00%s%x1e',
        ...normalizedCommitIds,
    ]);
    if (result.status !== 0) {
        return { commits: [] };
    }

    return { commits: parseGitGraphOutput(result.stdout) };
}

function execGitCommand(repoRoot: string, args: string[]): Promise<{ status: number; stdout: string; stderr: string }> {
    return new Promise(resolve => {
        execFile('git', ['-C', repoRoot, ...args], {
            maxBuffer: 20 * 1024 * 1024,
            windowsHide: true,
        }, (error, stdout, stderr) => {
            const status = typeof error?.code === 'number' ? error.code : (error ? 1 : 0);
            resolve({ status, stdout, stderr: stderr || error?.message || '' });
        });
    });
}

function parseGitGraphOutput(output: string): GitGraphCommit[] {
    return output.split('\x1e')
        .map(record => record.trim())
        .filter(record => record !== '')
        .map(record => {
            const [id = '', parents = '', timestamp = '', refs = '', subject = ''] = record.split('\x00');
            return {
                id,
                parentIds: parents.split(' ').filter(parentId => COMMIT_ID_PATTERN.test(parentId)),
                refs: refs.split(', ').map(ref => ref.trim()).filter(ref => ref !== ''),
                subject,
                timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : null,
            };
        })
        .filter(commit => COMMIT_ID_PATTERN.test(commit.id));
}

function getConfiguredLanguage(): LanguageCode {
    return normalizeLanguage(vscode.workspace.getConfiguration('gitChord').get<string>('language') ?? DEFAULT_LANGUAGE);
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, group: PanelGroup, pagePath: string, intent?: unknown) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.js')).toString();
    const nonce = getNonce();
    const language = getConfiguredLanguage();
    const initialState = JSON.stringify({
        group,
        path: pagePath,
        intent,
        currentRepoRoot: group.type === 'repo' ? group.repoRoot : undefined,
        language,
    }).replace(/</g, '\\u003c');
    return `
		<!DOCTYPE html>
		<html lang="${language}">
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
