import * as vscode from "vscode";

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { smithWatermanBased } from "./fuzzy";
import { Dirent } from "fs";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("open-by-path.open-by-path", () => {
      const qp = vscode.window.createQuickPick();
      qp.title = "Open by Path";
      qp.placeholder = "Path to open…";

      const homedir = os.homedir();

      let rel: string | undefined;
      const updateItems = async (x: string) => {
        const wsPaths = new Set(
          vscode.workspace.workspaceFolders?.map((x) => x.uri.fsPath) ?? []
        );

        const p = path.parse(x);
        x = x.slice(p.root.length);

        const absolute = p.root !== "";

        rel = undefined;
        if (!absolute && x.startsWith("~")) {
          rel = homedir;
          x = x.slice(1);
        }
        if (rel === undefined) {
          rel = vscode.window.activeTextEditor?.document.fileName;
          if (rel !== undefined) rel = path.dirname(rel);
        }
        if (rel === undefined)
          rel = (vscode.workspace.workspaceFolders ?? [])[0]?.uri.fsPath;
        if (rel === undefined) rel = homedir;

        if (!absolute && rel !== undefined)
          // Can't use `path` since `path.join("a/b/", "./.")` is `"a/b"` (strips trailing `/`)
          x = rel + path.sep + x;

        qp.title = rel.replace(homedir, "~");

        const parts = x.split(path.sep);

        let filter = parts.length === 0 ? "" : parts[parts.length - 1];
        filter = filter.toLocaleLowerCase();

        for (let i = 1; i <= parts.length; ++i) {
          let subpath = parts.slice(0, -i).join(path.sep);

          if (absolute) subpath = p.root + subpath;

          let files;
          try {
            files = await fs.readdir(subpath, {
              withFileTypes: true,
            });
          } catch (e) {
            continue;
          }

          let sorted = files;
          if (filter !== "") {
            const scored: [Dirent, number][] = [];
            files.forEach((x) => {
              const score = smithWatermanBased(filter, x.name);
              if (score >= 0.2) {
                scored.push([x, score]);
              }
            });
            scored.sort((a, b) => b[1] - a[1]);
            // Prints candidates to developer console when uncommented
            // console.log(scored.map((x) => `${x[1]} ${x[0].name}`).join('\n'))
            sorted = scored.map((x) => x[0]);
          }

          qp.items = (
            filter === "" || filter === "."
              ? [
                  {
                    label: ".",
                    description: "Open window",
                    alwaysShow: true,
                  },
                ]
              : Array<vscode.QuickPickItem>()
          ).concat(
            sorted.map((x) => ({
              label: x.isDirectory() ? `${x.name}${path.sep}` : x.name,
              alwaysShow: true,
            })),
            wsPaths.has(subpath) ? [] : [
              {
                label: ".",
                description: "Add to workspace",
                alwaysShow: true,
              },
            ]
          );
          return;
        }

        qp.items = [];
      };
      qp.onDidChangeValue(updateItems);
      qp.onDidAccept(async () => {
        const selected = qp.selectedItems[0];
        const label = selected.label;
        let val = qp.value;

        if (val.startsWith("~")) val = val.slice(2);

        const filterStart = val.lastIndexOf(path.sep) + 1;

        if (label === ".") {
          let selectedPath = val.slice(0, filterStart);
          if (rel !== undefined) selectedPath = path.join(rel, selectedPath);

          const uri = vscode.Uri.file(selectedPath);

          if (selected.description === "Open window") {
            const cmd = vscode.commands.executeCommand(
              "vscode.openFolder",
              uri,
              {
                forceNewWindow: true,
              }
            );
            qp.dispose();
            await cmd;
            return;
          }

          const folds = vscode.workspace.workspaceFolders;
          vscode.workspace.updateWorkspaceFolders(
            folds !== undefined ? folds.length : 0,
            null,
            { uri }
          );
          qp.dispose();
          return;
        }

        let newPath = val.slice(0, filterStart) + label;

        if (!label.endsWith(path.sep)) {
          if (rel !== undefined) newPath = path.join(rel, newPath);
          vscode.workspace
            .openTextDocument(vscode.Uri.file(newPath))
            .then(vscode.window.showTextDocument);
          qp.dispose();
          return;
        }

        qp.value = newPath;
      });
      updateItems("");
      qp.show();
    })
  );
}

export function deactivate() {}
