/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from "vscode";
import { readFileSync } from "fs";
import { join } from "path";
let colorMapper: { [colorStr: string]: string[] } = {};

function getColorMapper(path: string) {
  const text = readFileSync(path, { encoding: "utf8" });
  const matches = text.match(/\$[\w-]+:\s*#[\w]{3,6}\b/gim);
  const colorMapper: { [colorStr: string]: string[] } = {};
  if (matches) {
    for (let match of matches) {
      let [colorVar, colorStr] = match.split(/\s*:\s*/);
      colorStr = colorStr.toLowerCase();
      if (!colorMapper[colorStr]) {
        colorMapper[colorStr] = [];
      }
      colorMapper[colorStr].push(colorVar);
    }
  }
  return colorMapper;
}

export function activate(context: vscode.ExtensionContext) {
  const workbenchConfig = vscode.workspace.getConfiguration("cssAction");
  const path = workbenchConfig.get<string>("colorVariablesFile");
  if (!path) {
    return;
  }
  const fullPath = join(vscode.workspace.rootPath || "", path);
  colorMapper = getColorMapper(fullPath);

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [{ language: "scss" }, { language: "vue" }],
      new ColorVarReplacer(),
      {
        providedCodeActionKinds: ColorVarReplacer.providedCodeActionKinds,
      }
    )
  );
}

/**
 * Provides code actions for converting #ffffff to a color var.
 */
export class ColorVarReplacer implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] | undefined {
    const [matchResult, line] = this.isContainColor(document, range);
    if (!matchResult) {
      return;
    }
    const lineRange = line.range;
    const originColor = matchResult[0];

    const colorRange = new vscode.Range(
      lineRange.start.translate(0, matchResult.index),
      lineRange.start.translate(0, matchResult.index + originColor.length)
    );

    const colorVars = colorMapper[originColor.toLowerCase()];

    const fixes = colorVars.map((colorVar) => {
      return this.createFix(document, colorRange, colorVar, originColor);
    });

    if (fixes.length) {
      fixes[0].isPreferred = true;
    }

    return fixes;
  }

  private isContainColor(
    document: vscode.TextDocument,
    range: vscode.Range
  ): [RegExpExecArray | null, vscode.TextLine] {
    const start = range.start;
    const line = document.lineAt(start.line);
    const regex = /#\w{3,6}\b/;
    const matchResult = regex.exec(line.text);
    return [matchResult, line];
  }

  private createFix(
    document: vscode.TextDocument,
    range: vscode.Range,
	colorVar: string,
	originColor: string
  ): vscode.CodeAction {
    const fix = new vscode.CodeAction(
      `Replace ${originColor} with ${colorVar}`,
      vscode.CodeActionKind.QuickFix
    );
    fix.edit = new vscode.WorkspaceEdit();
    fix.edit.replace(document.uri, range, colorVar);
    return fix;
  }
}
