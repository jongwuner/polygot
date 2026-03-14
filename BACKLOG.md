# Polyglot Backlog

## Immediate Fixes
- Restore native editor shortcuts: `Ctrl/Cmd+C`, `Ctrl/Cmd+V`, `Ctrl/Cmd+A`, `Ctrl/Cmd+Z`.
- Stop the custom key handlers from breaking OS/browser IME behavior.
- Rework Chinese input so it cooperates with composition events instead of relying on `keydown` only.

## Shared Features
- DeepL integration
- Markdown export

## Web
- Add translation history storage as a first-class feature.
- Export translation history to an Obsidian-friendly `.md` file.
- Support exporting either:
  - the full history
  - selected history items
- Each history item should keep:
  - timestamp
  - source language
  - target language
  - original text
  - translated text
  - optional source URL or page title when available
- Recommended markdown shape:

```md
# Polyglot Translation Archive

## 2026-02-22 14:30 | EN -> KO
> original text

translated text

Source: https://example.com
```

## Chrome Extension
- Drag text to collect it
- Keep the Obsidian save format aligned with the web export format

## App
- React Native

## Notes
- The current web app is an editor, not a translation-history product yet.
- For the web export feature, implement order should be:
  1. translation action
  2. history persistence
  3. `.md` export
