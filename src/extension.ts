import * as vscode from 'vscode';
import { toggleLineLayout, compactBlocks } from './transformer';
import { TransformOptions } from './types';

/**
 * Prompt the user for comma placement when invoked from the command palette
 * without keybinding args.
 */
async function askCommaPlacement(): Promise<boolean> {
	const option = await vscode.window.showQuickPick(
		[
			{ label: 'commaOnSameLine', description: 'Comma At The End Of Line' },
			{ label: 'commaOnNewLine', description: 'Comma At The Start Of New Line' },
		],
		{
			canPickMany: false,
			placeHolder: 'Choose The Comma Placement',
		},
	) || { label: undefined };

	return option.label === 'commaOnNewLine';
}

/**
 * Get the active editor and selected text, or `undefined` if nothing useful
 * is selected.
 */
function getEditorSelection(): { editor: vscode.TextEditor; selection: vscode.Selection; text: string } | undefined {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return undefined;
	}
	const selection = editor.selection;
	const text = editor.document.getText(selection);
	if (!text.trim().length) {
		return undefined;
	}
	return { editor, selection, text };
}

/**
 * Apply a transformed string back to the editor, then format and trim.
 */
async function applyTransform(editor: vscode.TextEditor, selection: vscode.Selection, newText: string): Promise<void> {
	await editor.edit(builder => {
		builder.replace(selection, newText);
	});

	await vscode.commands.executeCommand(
		'editor.action.formatSelection',
		editor.document.uri,
		selection,
	);

	await vscode.commands.executeCommand(
		'editor.action.trimTrailingWhitespace',
		editor.document.uri,
		selection,
	);
}

export function activate(context: vscode.ExtensionContext) {

	// ── Original command: toggle single-line ↔ multi-line ──────────
	const toggleCmd = vscode.commands.registerCommand(
		'extension.singleMultiLine',
		async (args: any) => {
			const ctx = getEditorSelection();
			if (!ctx) {
				return;
			}

			const options: TransformOptions = {
				isCommaOnNewLine: args
					? !!args.isCommaOnNewLine
					: await askCommaPlacement(),
			};

			const newText = toggleLineLayout(ctx.text, options);
			await applyTransform(ctx.editor, ctx.selection, newText);
		},
	);

	// ── New command: compact balanced blocks ───────────────────────
	// Each `{ ... }` block is collapsed to a single line while
	// preserving one-block-per-line structure.
	const compactCmd = vscode.commands.registerCommand(
		'extension.compactBlocks',
		async () => {
			const ctx = getEditorSelection();
			if (!ctx) {
				return;
			}

			const newText = compactBlocks(ctx.text);
			await applyTransform(ctx.editor, ctx.selection, newText);
		},
	);

	context.subscriptions.push(toggleCmd, compactCmd);
}

// this method is called when your extension is deactivated
export function deactivate() { }
