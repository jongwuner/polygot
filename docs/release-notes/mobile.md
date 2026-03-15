# React Native Mobile Release Notes

## v1.2.0 - 2026-03-15

- Added an Obsidian review quiz workflow for imported archive notes.
- Added note-only quiz deck generation that turns headings, bullets, quotes, and key terms into short review cards.
- Added optional local-model quiz remix using the imported GGUF model on native development builds.
- Added session scoring, streak tracking, and XP-style progress for repeat review loops.

## v1.1.0 - 2026-03-15

- Added Obsidian markdown import so notes can be picked from the phone and reopened inside the app.
- Added a dedicated AI workflow for selected notes.
- Added GGUF model import and `llama.rn` integration scaffolding for on-device local inference in native development builds.
- Added local model settings for context size, output tokens, and GPU layer offload.

## v1.0.0 - 2026-03-15

- Shipped the first Expo / React Native mobile client.
- Added a translation workspace with source and target language controls.
- Added Google Translate-backed translation requests with pronunciation for Japanese and Chinese targets.
- Added local translation history with AsyncStorage persistence.
- Added Obsidian note path preview, markdown copy, share, and deep-link launch.
- Added client settings for vault name, archive base path, and archive folder mode.
