import * as vscode from "vscode";

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

import Fuse from "fuse.js";

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
        if (rel === undefined) rel = process.cwd();

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
            const fuse = new Fuse(files, {
              keys: ["name"],
              includeScore: true,
              threshold: 1.0,
              ignoreLocation: true,
            });
            sorted = fuse.search(filter).map((x) => x.item);
          }

          qp.items = sorted.map((x) => ({
            label: x.isDirectory() ? `${x.name}${path.sep}` : x.name,
            alwaysShow: true,
          }));
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
