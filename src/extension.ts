import * as vscode from "vscode";
import autodataPlugin from "./markdownItAutodata";

export function activate(_ctx: vscode.ExtensionContext) {
  const getDocPath = () => {
    const ed = vscode.window.activeTextEditor;
    if (ed && ed.document && !ed.document.isUntitled) return ed.document.uri.fsPath;
    return undefined;
  };

  return {
    extendMarkdownIt(md: any) {
      md.use(autodataPlugin, {
        getDocPath,
        outSubdir: ".autodata",
        rasterize: "png" // 预览走 PNG
      });
      return md;
    }
  };
}

export function deactivate() {}
