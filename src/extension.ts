/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from "vscode";
import { readFileSync } from "fs";
import { join } from "path";

const autoCalcPlaceholder = "_AUTO_CALC_";
let colorVariablesFilePath: string | undefined;
let variableMapper = new Map<string, Set<string>>();
let pxSearchRegex: string;
let pxReplaceOptions: string[];
let rootFontSize: number;

function normalizeSizeValue(str: string) {
  const sizeReg = /\b\d+(px|rem|em)\b/g;
  const result = str.toLowerCase().match(sizeReg);
  if (result) {
    return result.join(" ");
  } else {
    return null;
  }
}

function normalizeColorValue(str: string) {
  const colorReg = /#[0-9a-f]{3,8}\b/;
  const result = str.toLowerCase().match(colorReg);
  if (result) {
    return result[0];
  } else {
    return null;
  }
}
function getVariablesMapper(path: string) {
  const text = readFileSync(path, { encoding: "utf8" });
  const matches = text.match(/[$@][\w-]+\s*:\s*.+/gi);
  const varMapper = new Map<string, Set<string>>();
  if (matches) {
    for (let match of matches) {
      let [varName, varValue] = match.split(/\s*:\s*/);
      varValue =
        normalizeSizeValue(varValue) || normalizeColorValue(varValue) || "";
      if (!varMapper.get(varValue)) {
        varMapper.set(varValue, new Set());
      }
      varMapper.get(varValue)!.add(varName);
    }
  }
  return varMapper;
}

function init(context: vscode.ExtensionContext) {
  const workbenchConfig = vscode.workspace.getConfiguration("cssAction");
  colorVariablesFilePath = workbenchConfig.get<string>("colorVariablesFile");
  pxSearchRegex = workbenchConfig.get<string>("pxSearchRegex")!;
  pxReplaceOptions = workbenchConfig.get<string[]>("pxReplaceOptions")!;
  rootFontSize = workbenchConfig.get<number>("rootFontSize")!;

  context.subscriptions.forEach((s) => s.dispose());

  if (colorVariablesFilePath) {
    const fullPath = join(
      vscode.workspace.rootPath || "",
      colorVariablesFilePath
    );
    variableMapper = getVariablesMapper(fullPath);

    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        [{ language: "scss" }, { language: "less" }, { language: "vue" }],
        new ColorVarReplacer(),
        {
          providedCodeActionKinds: ColorVarReplacer.providedCodeActionKinds,
        }
      )
    );
  }

  if (pxSearchRegex) {
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        [{ language: "scss" }, { language: "less" }, { language: "vue" }],
        new PxReplacer(),
        {
          providedCodeActionKinds: PxReplacer.providedCodeActionKinds,
        }
      )
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  init(context);
  vscode.workspace.onDidChangeConfiguration(() => init(context));
}

/**
 * Provides code actions for converting px.
 */
export class PxReplacer implements vscode.CodeActionProvider {
  public regex = new RegExp(pxSearchRegex!, "i");

  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] | undefined {
    const [matchResult, line] = this.isMatchRegex(document, range);
    if (!matchResult) {
      return;
    }
    const lineRange = line.range;
    const originText = matchResult[0].trim();

    const originRange = new vscode.Range(
      lineRange.start.translate(0, matchResult.index),
      lineRange.start.translate(0, matchResult.index + originText.length)
    );

    const targetTexts = this.getReplaceTargets(originText);

    const fixes = targetTexts.map((targetText) =>
      this.createFix(document, originRange, targetText, originText)
    );

    if (fixes.length) {
      fixes[0].isPreferred = true;
    }

    return fixes;
  }

  public getReplaceTargets(originText: string): string[] {
    const normalizedOrigin = normalizeSizeValue(originText) || "";
    const replaces = pxReplaceOptions!.map((target) => {
      if (target === autoCalcPlaceholder) {
        return normalizedOrigin
          .split(/\s+/)
          .map((item) => {
            const unit = item.replace(/\d+/, "");
            if (unit === "px") {
              const result = parseInt(item) / rootFontSize;
              const resultStr = result.toFixed(4).replace(/\.?0+$/, "");
              return `${resultStr}rem`;
            } else {
              return item;
            }
          })
          .join(" ");
      } else {
        return originText.replace(this.regex, target);
      }
    });
    const varNameFromMapper = variableMapper.get(normalizedOrigin) || new Set();
    for (let varName of varNameFromMapper) {
      replaces.push(varName);
    }
    return replaces;
  }

  private isMatchRegex(
    document: vscode.TextDocument,
    range: vscode.Range
  ): [RegExpExecArray | null, vscode.TextLine] {
    const line = document.lineAt(range.start);
    const matchResult = this.regex.exec(line.text);
    return [matchResult, line];
  }

  private createFix(
    document: vscode.TextDocument,
    range: vscode.Range,
    targetText: string,
    originText: string
  ): vscode.CodeAction {
    const fix = new vscode.CodeAction(
      `Replace [ ${originText} ] with ${targetText}`,
      vscode.CodeActionKind.QuickFix
    );
    fix.edit = new vscode.WorkspaceEdit();
    fix.edit.replace(document.uri, range, targetText);
    return fix;
  }
}

/**
 * Provides code actions for converting hex color string to a color var.
 */
export class ColorVarReplacer extends PxReplacer {
  public regex = /#([0-9a-f]{3})+\b/i;

  public getReplaceTargets(originText: string): string[] {
    return Array.from(variableMapper.get(originText.toLowerCase()) || []);
  }
}
