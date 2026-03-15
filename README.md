# Polyglot

Polyglot is a multi-client translation project with three active surfaces:

- a web editor for quick multilingual notes
- a Chrome extension for translating page selections into Obsidian-ready notes
- an Expo / React Native mobile app for translation, local history, Obsidian note review, and playful quiz sessions

## Clients

### Web client

- Location: `index.html`, `css/`, `js/`
- Purpose: editor-first multilingual input workspace
- Release notes: [`docs/release-notes/web.md`](docs/release-notes/web.md)

### Chrome extension

- Location: `chrome-extension/`
- Purpose: translate selected page text and push notes into Obsidian
- Release notes: [`docs/release-notes/chrome-extension.md`](docs/release-notes/chrome-extension.md)

### React Native mobile app

- Location: `mobile/`
- Purpose: mobile translation workspace with local history, Obsidian note preview, and archive review quizzes
- Release notes: [`docs/release-notes/mobile.md`](docs/release-notes/mobile.md)

## Repository layout

```text
polygot/
|-- chrome-extension/
|-- css/
|-- docs/release-notes/
|-- js/
|   `-- data/
|-- mobile/
|   |-- App.js
|   |-- app.json
|   `-- src/
|-- CHANGELOG.md
|-- BACKLOG.md
`-- index.html
```

## Run the mobile app

```bash
cd mobile
npm install
npm run start
```

The mobile client includes:

- source and target language selection
- Google Translate-backed translation requests
- pronunciation support for Japanese and Chinese targets
- local translation history with AsyncStorage
- Obsidian note generation, markdown copy, share, and deep-link launch
- markdown note import from Obsidian files on the phone
- quiz deck generation from imported Obsidian review notes
- streak and XP tracking for repeat review sessions
- optional local-model quiz remix for native builds
- local GGUF model hookup for native on-device note analysis

## Web and extension

The web client remains editor-first and the Chrome extension remains selection-first.

- Open `index.html` directly or serve the repo root to work on the web client.
- Load `chrome-extension/` as an unpacked MV3 extension from `chrome://extensions`.

## Release notes

Client-specific version notes now live in dedicated files:

- [`CHANGELOG.md`](CHANGELOG.md)
- [`docs/release-notes/web.md`](docs/release-notes/web.md)
- [`docs/release-notes/chrome-extension.md`](docs/release-notes/chrome-extension.md)
- [`docs/release-notes/mobile.md`](docs/release-notes/mobile.md)

## Deploy

The web client is deployed through Firebase Hosting:

```bash
firebase deploy
```
