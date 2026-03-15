# Chrome Extension Release Notes

## v1.5.1 - 2026-03-14

- Moved the extension back to immediate Obsidian note delivery.
- Removed queued-save behavior from the popup workflow.
- Kept drag, context-menu, shortcut, and popup translation entry points aligned on the same save path.

## v1.5.0 - 2026-03-14

- Added temporary queued-save handling for translation results.
- Added popup queue controls for saving the next item or the full queue.
- Separated immediate translation from explicit save actions.

## v1.4.1 - 2026-03-14

- Hardened content script messaging after extension reloads.
- Added fallback note construction when the background context is invalidated.
- Improved user-facing error messaging for refresh-required states.

## v1.4.0 - 2026-03-14

- Added pronunciation display for Chinese and Japanese translations.
- Added the right-click context menu entry for selected text.
- Included pronunciation metadata in popup results and generated Obsidian notes.

## v1.3.0 - 2026-03-14

- Added explicit source and target language selectors.
- Added direction swap support.
- Added folder selection behavior for Obsidian archive output.

## v1.2.0 - 2026-03-14

- Switched archive storage to per-language folders grouped under `polygot`.
- Generated one markdown file per translation instead of appending to a daily note.
- Added popup archive-base configuration and path preview.

## v1.1.0 - 2026-03-14

- Added the floating drag-to-translate button next to page selections.
- Translated selected text directly from the page and saved it into Obsidian.

## v1.0.0 - 2026-03-14

- Shipped the initial MV3 Chrome extension.
- Added the `Alt+T` translation shortcut for selected text.
- Added quick translate in the popup and Obsidian URI integration.
