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
            const scored: [Dirent, number][] = files.map((x) => [
              x,
              -smithWatermanBased(filter, x.name),
            ]);
            scored.sort((a, b) => a[1] - b[1]);
            sorted = scored.map((x) => x[0]);
          }

          qp.items = (
            filter === "" || filter === "."
              ? [
                  {
                    label: ".",
                    description: "Add to workspace",
                    alwaysShow: true,
                  },
                ]
              : Array<vscode.QuickPickItem>()
          ).concat(
            sorted.map((x) => ({
              label: x.isDirectory() ? `${x.name}${path.sep}` : x.name,
              alwaysShow: true,
            }))
          );
          return;
        }

        qp.items = [];
      };
      qp.onDidChangeValue(updateItems);
      qp.onDidAccept(() => {
        const label = qp.selectedItems[0].label;
        let val = qp.value;

        if (val.startsWith("~")) val = val.slice(2);

        const filterStart = val.lastIndexOf(path.sep) + 1;

        if (label === ".") {
          let selectedPath = val.slice(0, filterStart);
          if (rel !== undefined) selectedPath = path.join(rel, selectedPath);

          const folds = vscode.workspace.workspaceFolders;
          vscode.workspace.updateWorkspaceFolders(
            folds !== undefined ? folds.length : 0,
            null,
            { uri: vscode.Uri.file(selectedPath) }
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
