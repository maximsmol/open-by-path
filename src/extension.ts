import * as vscode from "vscode";

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { smithWatermanBased } from "./fuzzy";
import { Dirent } from "fs";

const ADD_TO_WORKSPACE_DESCRIPTION = "Add to workspace";
const OPEN_WINDOW_DESCRIPTION = "Open window";
const SET_RELATIVE_DESCRIPTION = "Change starting directory";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("open-by-path.open-by-path", () => {
      const qp = vscode.window.createQuickPick();
      qp.title = "Open by Path";
      qp.placeholder = "Path to open…";

      const homedir = os.homedir();

      const homePath = os.homedir();
      const homePrefix = '~';

      function initialRelative(): string {
        const fileName = vscode.window.activeTextEditor?.document.fileName;
        return fileName
          ? path.dirname(fileName)
          : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? homePath;
      }

      let relative = initialRelative();

      function pathForDisplay(pth: string) {
        return pth.replace(homePath, "~");
      }

      function resolveRelative(pth: string) {
        return path.parse(pth).root === ""
          ? path.join(relative, pth)
          : pth;
      }

      function setRelative(pth = relative) {
        relative = pth;
        qp.title = pathForDisplay(relative!);
      }

      const updateItems = async (input: string) => {
        const wsPaths = new Set(
          vscode.workspace.workspaceFolders?.map((x) => x.uri.fsPath) ?? []
        );
        const inputAsPath = path.parse(input);
        let pth = input;

        const absolute = inputAsPath.root !== "";
        if (absolute) {
          pth = pth.slice(inputAsPath.root.length);
        }

        if (pth.startsWith(homePrefix)) {
          relative = homePath;
          pth = pth.slice(homePrefix.length);
        }

        if (!absolute) {
          pth = pth && pth !== "."
            ? path.join(relative, pth)
            : relative + path.sep;
        }

        setRelative();

        const parts = pth.split(path.sep);
        let filter = parts.length === 0 ? "" : parts[parts.length - 1];
        filter = filter.toLocaleLowerCase();

        // Find the last path component that corresponds to an existing directory and present its contents
        for (let i = 1; i <= parts.length; ++i) {
          let subpath = parts.slice(0, -i).join(path.sep);

          if (absolute) {
            subpath = inputAsPath.root + subpath;
          }

          let files;
          try {
            files = await fs.readdir(subpath, {
              withFileTypes: true,
            });
          } catch (e) {
            continue;
          }
  
          // console.log({ relative, input, filter, pth, subpath });

          let sorted = files;
          if (filter !== "") {
            const scored: [Dirent, number][] = files.map((x) => {
              return [x, smithWatermanBased(filter, x.name)];
            });
            scored.sort((a, b) => b[1] - a[1]);
            // Prints candidates to developer console when uncommented
            // console.log(scored.map((x) => `${x[1]} ${x[0].name}`).join('\n'))
            sorted = scored.map((x) => x[0]);
          }

          const items: vscode.QuickPickItem[] = [];

          if (input === "~") {
            // Expand ~ to home directory
            items.push({ label: "~/", alwaysShow: true });
          } else if (input !== "" && inputAsPath.name === "..") {
            // Allow starting directory to be changed
            items.push({
              label: pathForDisplay(path.join(relative || '', input)),
              description: SET_RELATIVE_DESCRIPTION,
              alwaysShow: true
            });
          } else if (input !== "" && (filter === "" || filter === ".")) {
            // Show "Open window" item for directories outside starting directory
            items.push({ label: ".", description: OPEN_WINDOW_DESCRIPTION, alwaysShow: true });
          }

          items.push(...sorted.map((x) => ({
            label: x.isDirectory() ? `${x.name}${path.sep}` : x.name,
            alwaysShow: true,
          })));

          // Include ability to add path to workspace as final item
          if (!wsPaths.has(subpath)) {
            items.push({
              label: ".",
              description: ADD_TO_WORKSPACE_DESCRIPTION,
              alwaysShow: true,
            });
          }

          qp.items = items;
          return;
        }

        // No suggestions found
        qp.items = [];
      };

      qp.onDidChangeValue(updateItems);

      qp.onDidAccept(async () => {
        const selected = qp.selectedItems[0];
        const label = selected.label;
        let val = qp.value;

        if (val.startsWith("~")) {
          val = val.slice(2);
        }

        const filterStart = val.lastIndexOf(path.sep) + 1;

        if (label === ".") {
          let selectedPath = resolveRelative(val.slice(0, filterStart));
          const uri = vscode.Uri.file(selectedPath);

          switch (selected.description) {
            case ADD_TO_WORKSPACE_DESCRIPTION: {
              const folds = vscode.workspace.workspaceFolders;
              vscode.workspace.updateWorkspaceFolders(
                folds !== undefined ? folds.length : 0,
                null,
                { uri }
              );
              qp.dispose();
              return;
            }
            case OPEN_WINDOW_DESCRIPTION: {
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
          }
        }

        let newPath = val.slice(0, filterStart) + label;

        if (selected.description === SET_RELATIVE_DESCRIPTION) {
          setRelative(path.join(relative!, val));
          qp.value = '';
          return;
        }

        if (!label.endsWith(path.sep)) {
          newPath = resolveRelative(newPath);
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

export function deactivate() { }
