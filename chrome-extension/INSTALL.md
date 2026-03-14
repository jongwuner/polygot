# Polyglot Chrome Extension Setup

## 1. Load the extension in Chrome
1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder:

`C:\Users\jklh0\OneDrive\문서\GitHub\polygot\chrome-extension`

## 2. Configure Obsidian target
1. Click the Polyglot extension icon.
2. Enter your Obsidian vault name exactly as it appears in Obsidian.
3. Enter the target note path.

Example:
- Vault name: `MyVault`
- Archive file path: `Inbox/Foreign Language Archive`

4. Click `Save Settings`.

## 3. Set or change the shortcut
1. Open `chrome://extensions/shortcuts`.
2. Find `Polyglot Translate`.
3. Set `Translate selection and send it to Obsidian`.
4. Recommended shortcut:
- Windows: `Alt+T` or `Ctrl+Shift+Y`
- Mac: `Option+T` or `Command+Shift+Y`

## 4. How to use it
1. Open any normal web page.
2. Drag to select text.
3. Press the shortcut.
4. Chrome translates the selected text and sends a new entry to Obsidian immediately.

## 5. Obsidian requirements
- The Obsidian desktop app must be installed.
- The first time Chrome opens an `obsidian://` link, allow the external app launch.
- The vault name in the extension must match the actual vault name.

## 6. Limits
- It does not work on restricted Chrome pages such as `chrome://*` and the Chrome Web Store.
- If no text is selected, nothing is saved.
- If the vault name is missing, the page shows an error toast instead of saving.
