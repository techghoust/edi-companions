# EDI COMPANION: USER GUIDE

this guide covers local installation, setup and everyday use of EDI Developer Journal Companion for VS Code, PyCharm, WebStorm and CLion

---

## BEFORE INSTALLATION

make sure that:

- EDI Developer Journal 0.4 or newer is installed or available as a portable application;
- VS Code `1.96.0` or newer, or PyCharm, WebStorm or CLion `2025.2` or newer is installed;
- the project is opened as a local folder in VS Code;
- the EDI application supports Integration Protocol v1

the IDE plugin and EDI must run under the same operating-system user

---

## INSTALL FROM VSIX

1. open VS Code;
2. open the Command Palette with `Ctrl+Shift+P`;
3. run `Extensions: Install from VSIX...`;
4. select `edi-vscode-0.3.0.vsix`;
5. run `Developer: Reload Window`

to verify the installation, open the Command Palette and type `EDI:`. the EDI commands should appear in the list

### command-line installation

```powershell
code --install-extension .\edi-vscode-0.3.0.vsix --force
```

---

## INSTALL IN PYCHARM, WEBSTORM OR CLION

1. download the JetBrains plugin ZIP from the EDI Developer Journal Companion release;
2. open **Settings -> Plugins**;
3. open the gear menu and choose **Install Plugin from Disk...**;
4. select the downloaded ZIP and restart the IDE when prompted.

the shared plugin supports PyCharm, WebStorm and CLion 2025.2 or newer. its commands are available under **Tools -> EDI** and in the editor context menu

---

## CONNECT EDI

the extension first checks whether EDI is already running. if it is closed, the extension tries to find and start it

automatic detection checks standard application locations on Windows and `/usr/bin` or `/usr/local/bin` on Linux. on macOS it checks `/Applications` and `~/Applications`

on macOS, the runtime descriptor is read from `~/Library/Application Support/EDI Developer Journal/integration.json`

for a portable build or a custom executable path:

1. run `EDI: Open Project in EDI`;
2. choose **Select EDI Executable** when VS Code reports that EDI was not found;
3. select `EDI Developer Journal.exe` on Windows or the EDI executable on Linux;
4. run the command again

the path can also be changed in VS Code Settings by searching for `EDI executable path`

in PyCharm, WebStorm or CLion, use `Tools -> EDI -> Configure EDI Executable` to select a portable executable or app bundle

---

## OPEN A PROJECT

1. open a project folder in VS Code;
2. run `EDI: Open Project in EDI` from the Command Palette;
3. EDI opens the matching project;
4. if the project is unknown, complete the project creation or linking form in EDI

in a multi-root workspace, EDI uses the folder containing the active editor. if no active file identifies the folder, VS Code asks which workspace folder to use

in a JetBrains IDE, EDI uses the IDE project's root folder

---

## ADD A NOTE

1. open a source file;
2. optionally select the relevant code;
3. right click inside the editor;
4. choose `Send to EDI -> Add Note`;
5. enter a title;
6. enter an optional comment and press Enter

the note receives the selected code and source context. with no selection, EDI receives the file, language and cursor position without the full document text

---

## ADD A DECISION

use `Send to EDI -> Add Decision` when a code fragment explains a technical choice

- the title becomes the decision title;
- the optional comment becomes the reason;
- the new decision starts with the `active` status;
- file, selection, branch and commit context are attached when available

---

## ADD AN EXPERIMENT

use `Send to EDI -> Add Experiment` for a hypothesis, test or prototype

- the title becomes the experiment title;
- the optional comment becomes the hypothesis;
- the new experiment starts with the `planned` status;
- the source location is stored with the experiment

---

## ADD RESEARCH

use `Send to EDI -> Add Research` for useful code context or a finding that should remain in project memory

- the title becomes the research title;
- the optional comment and selected code become its notes;
- the item is created as research type `note`

links and local media can still be added from the EDI application

## JETBRAINS IDE COMMANDS

the same commands are available from `Tools -> EDI` and from the editor context menu:

- open project in EDI;
- add note;
- add decision;
- add experiment;
- add research;
- configure the EDI executable or app bundle

when adding an item from an editor, the companion sends the current file, language, cursor or selected range and selected text only. without a selection, the full file is never sent

---

## SETTINGS

open VS Code Settings and search for `EDI Developer Journal`

### EDI executable path

`edi.executablePath`

stores a custom path to the EDI executable. leave it empty to use automatic detection

### automatic detection

`edi.autoDetect`

when enabled, the extension checks standard application locations if EDI is not already running

### success notifications

`edi.showSuccessNotifications`

turn this off to hide confirmation messages after successful commands. errors remain visible

---

## TROUBLESHOOTING

### EDI could not be found

choose **Select EDI Executable** and point the extension to the application file. for the current portable Windows build, this is the file named `EDI Developer Journal.exe`

### open a project folder first

VS Code currently has no local workspace. use `File -> Open Folder...`, then run the EDI command again

### this workspace is not linked

EDI has opened the project form. create the project or open the existing repository there, then repeat the Add command

### the commands do not appear

run `Developer: Reload Window`. if that does not help, open Extensions, find EDI Developer Journal Companion and confirm that it is enabled

### EDI did not start

start EDI manually and repeat the command. if the executable was moved, update `edi.executablePath`

### remote workspace unsupported

open the repository as a local desktop folder. the current version does not transfer remote workspace files to a local EDI instance

---

## UPDATE

install the newer VSIX through `Extensions: Install from VSIX...`. VS Code replaces the existing version. reload the window after installation

project memory remains inside EDI and is not stored in the extension

---

## UNINSTALL

1. open Extensions in VS Code;
2. find **EDI Developer Journal Companion**;
3. choose **Uninstall**;
4. reload VS Code

uninstalling the extension does not remove EDI projects or journal data
