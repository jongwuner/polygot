# Polyglot

5개 국어 입력기 + 번역 Chrome Extension.

한국어 · English · 日本語 · 中文 · Deutsch

## Live

Firebase Hosting: [polyglot-f8ea5.web.app](https://polyglot-f8ea5.web.app)

---

## Project Structure

```
polygot/
├── index.html                 ← Web app entry
├── css/style.css              ← Styles
├── js/
│   ├── data/
│   │   ├── romaji-kana.js     ← Romaji → Hiragana/Katakana mapping
│   │   ├── pinyin-hanzi.js    ← Pinyin → Hanzi dictionary
│   │   └── config.js          ← Tone system, UI config, hints
│   ├── editor.js              ← Core editor logic + UI helpers
│   ├── ime-japanese.js        ← Japanese IME handler
│   ├── ime-chinese.js         ← Chinese IME handler
│   └── app.js                 ← Init + event listeners
├── chrome-extension/          ← Chrome Extension (MV3)
│   ├── manifest.json
│   ├── background.js          ← Translation API + shortcut handler
│   ├── content.js             ← Text capture + floating panel
│   ├── popup.html/css/js      ← Extension popup UI
│   └── INSTALL.md             ← Setup guide
├── firebase.json              ← Firebase Hosting config
└── BACKLOG.md                 ← Roadmap
```

---

## Web App

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+1` | Switch to 한국어 |
| `Ctrl+2` | Switch to English |
| `Ctrl+3` | Switch to 日本語 |
| `Ctrl+4` | Switch to 中文 |
| `Ctrl+5` | Switch to Deutsch |

### Korean (한국어)

OS의 한/영 전환을 사용하여 입력합니다.

- **Windows**: `한/영` 키 또는 `Right Alt`
- **Mac**: `⌘+Space` 또는 `Caps Lock`

Quick Insert 버튼으로 된소리(ㄲ,ㄸ,ㅃ,ㅆ,ㅉ)와 이중모음(ㅘ,ㅙ,ㅚ 등) 삽입 가능.

### Japanese (日本語)

로마자를 입력하면 자동으로 히라가나로 변환됩니다.

| Input | Output | Note |
|---|---|---|
| `konnichiha` | こんにちは | 소문자 → 히라가나 |
| `KONNICHIHA` | コンニチハ | 대문자 → 카타카나 |
| `nn` / `n'` | ん | |
| `kitte` | きって | 같은 자음 2개 → っ |
| `thi` | てぃ | 외래어: ティー |
| `fa` | ふぁ | 외래어: ファン |

- `Enter`: 버퍼 확정
- `Esc`: 버퍼 취소

### Chinese (中文)

핀인을 입력한 후 Space를 누르면 한자 후보가 표시됩니다.

| Step | Example |
|---|---|
| 핀인 입력 | `nihao` |
| 성조 추가 (선택) | `2` → `níhao` |
| 성조 변경 | `3` → `nǐhao` |
| 성조 제거 | `5` → `nihao` |
| 한자 후보 표시 | `Space` |
| 후보 선택 | `1`~`9` |
| 핀인 그대로 확정 | `Enter` |

- `v`를 입력하면 `ü`로 처리됩니다. (예: `nv3` → `nǚ`)

### German (Deutsch)

직접 입력합니다. 특수 문자는 Quick Insert 버튼 사용:

`ä` `ö` `ü` `Ä` `Ö` `Ü` `ß` `€`

### Toolbar

- **Copy**: 텍스트를 클립보드에 복사
- **Clear**: 현재 언어의 텍스트 초기화
- **Save**: `.txt` 파일로 다운로드

---

## Chrome Extension

웹 브라우저에서 텍스트를 드래그하고 단축키를 누르면 번역 후 Obsidian에 자동 저장합니다.

### Setup

1. `chrome://extensions` → 개발자 모드 ON
2. "압축해제된 확장 프로그램을 로드합니다" → `chrome-extension` 폴더 선택
3. 확장 프로그램 아이콘 클릭 → Vault 이름, Archive 파일 경로 설정 → Save

### Usage

**방법 1 — 드래그 (마우스)**
1. 웹 페이지에서 텍스트 드래그
2. 선택 영역 옆에 **Translate** 버튼이 나타남
3. 클릭하면 번역 패널 표시 → Copy 또는 Save to Obsidian

**방법 2 — 단축키**
1. 텍스트 선택 후 `Alt+T`
2. 바로 번역 + Obsidian 저장 (단축키 변경: `chrome://extensions/shortcuts`)

### Obsidian Archive Format

```markdown
---
#### English → 한국어  |  2026-03-14 14:30
> The original selected text here

번역된 텍스트

*Source: [Page Title](https://example.com)*
```

### Popup Quick Translate

확장 프로그램 아이콘을 클릭하면 팝업에서 직접 번역할 수도 있습니다.

### Requirements

- Obsidian 데스크톱 앱 설치 필요
- 처음 사용 시 Chrome에서 `obsidian://` 링크 열기 허용

---

## Development

### Modify Guide

| What to change | File |
|---|---|
| Styling | `css/style.css` |
| Hanzi dictionary | `js/data/pinyin-hanzi.js` |
| Romaji→Kana map | `js/data/romaji-kana.js` |
| Language config / hints | `js/data/config.js` |
| Japanese IME logic | `js/ime-japanese.js` |
| Chinese IME logic | `js/ime-chinese.js` |
| Editor core | `js/editor.js` |
| HTML layout | `index.html` |
| Extension | `chrome-extension/` |

### Deploy

```bash
firebase deploy
```

---

Copyright Grady Lee.
