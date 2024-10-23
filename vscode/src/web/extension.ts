import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
        vscode.commands.registerCommand('git-chord.show', () => {
            const panel = vscode.window.createWebviewPanel(
                'git-chord-panel',
                'Git Chord',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                },
            );

            const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'web', 'webview', 'index.js')).toString();
            panel.webview.html = getWebviewContent(scriptUri);
        })
    );
}

function getWebviewContent(scriptUri: string) {
    return `
		<!DOCTYPE html>
		<html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Git Chord</title>
            </head>
            <body>
                <div id="root"></div>
                <script src="${scriptUri}"></script>
            </body>
		</html>
    `;
}

export function deactivate() {}
