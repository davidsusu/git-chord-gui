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
            panel.webview.html = getWebviewContent();
        })
    );
}

function getWebviewContent() {
    return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Git Chord</title>
		</head>
		<body>
			<p>Hello, this is the Git Chord VSCode extension!</p>
		</body>
		</html>
    `;
}

export function deactivate() {}
