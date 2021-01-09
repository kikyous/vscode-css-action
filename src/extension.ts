import * as vscode from "vscode";
import { readFileSync } from "fs";
import { join } from "path";
import { render } from 'ejs';

enum BultinTemplateVar {
  remResult = "_REM_RESULT_",
  varName = "_VAR_NAME_",
  matchedText = "_MATCHED_TEXT_",
}
let variablesFilePath: string | undefined;
let variableMapper = new Map<string, Set<string>>();
let pxSearchRegex: string;
let rootFontSize: number;
let pxReplaceOptions: string[];
let colorReplaceOptions: string[];

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
  const matches = text.match(/(?<!\/\/\s*)[$@][\w-]+\s*:\s*.+/gi);
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

const renderVarNamesTpl = (tplString: string, varNames: Array<string>, context: object) => {
  return varNames.map((varName) => {
    return render(tplString, { [BultinTemplateVar.varName]: varName, ...context })
  })
}

const renderOptions = (optionTpls: string[], varNames: Set<string>, context: object) => {
  let result: string[] = [];
  for (const option of optionTpls) {
    if (option.includes(BultinTemplateVar.varName)) {
      result = result.concat(renderVarNamesTpl(option, Array.from(varNames), context));
    } else {
      result.push(render(option, context));
    }
  }
  return result;
}

function init(context: vscode.ExtensionContext) {
  const workbenchConfig = vscode.workspace.getConfiguration("cssAction");
  variablesFilePath = workbenchConfig.get<string>("variablesFile");
  pxSearchRegex = workbenchConfig.get<string>("pxSearchRegex")!;
  rootFontSize = workbenchConfig.get<number>("rootFontSize")!;
  pxReplaceOptions = workbenchConfig.get<string[]>("pxReplaceOptions")!;
  colorReplaceOptions = workbenchConfig.get<string[]>("colorReplaceOptions")!;

  context.subscriptions.forEach((s) => s.dispose());

  if (variablesFilePath) {
    const fullPath = join(
      vscode.workspace.rootPath || "",
      variablesFilePath
    );

    variableMapper = getVariablesMapper(fullPath);

    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        ColorVarReplacer.documentSelectors,
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
        PxReplacer.documentSelectors,
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

abstract class RegexReplacer implements vscode.CodeActionProvider {
  public abstract regex: RegExp;

  public static documentSelectors = [
    { language: "scss" },
    { language: "less" },
    { language: "vue" },
  ];

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

  public abstract getReplaceTargets(originText: string): string[];

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
 * Provides code actions for converting px.
 */
class PxReplacer extends RegexReplacer {
  public regex = new RegExp(pxSearchRegex!, "i");

  private calcRem(originText: string): string {
    return originText
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
  }

  public getReplaceTargets(originText: string): string[] {
    const normalizedOrigin = normalizeSizeValue(originText) || "";

    const varNames = variableMapper.get(normalizedOrigin) || new Set()
    const context = {
      [BultinTemplateVar.matchedText]: originText,
      [BultinTemplateVar.remResult]: this.calcRem(normalizedOrigin)
    }
    return renderOptions(pxReplaceOptions, varNames, context);
  }
}

/**
 * Provides code actions for converting hex color string to a color var.
 */


class ColorVarReplacer extends RegexReplacer {
  public regex = /#[0-9a-f]{3,8}\b/i;

  public getReplaceTargets(originText: string): string[] {
    const varNames = variableMapper.get(originText.toLowerCase()) || new Set()
    const context = {
      [BultinTemplateVar.matchedText]: originText
    }

    return renderOptions(colorReplaceOptions, varNames, context);
  }
}
