# Changelog

## Chrome Extension

### v1.5.0 — 2026-03-14
**임시 큐 저장 방식**
- 드래그 / 우클릭 / Alt+T / 팝업 번역 결과를 즉시 Obsidian으로 열지 않고 확장 내부 큐에 임시 저장
- 팝업에 Pending Queue, `Save Next`, `Save All`, `Clear` 버튼 추가
- 개별 번역은 `Queued → ...md` 형태로 경로만 표시
- 필요할 때만 큐를 Obsidian으로 열 수 있도록 저장 타이밍 분리

### v1.4.1 — 2026-03-14
**컨텍스트 무효화 버그 픽스**
- 확장 리로드 뒤 기존 탭에서 발생하던 `Extension context invalidated` 오류 방어
- 드래그 후 `Translate` 클릭 시 `chrome.runtime.sendMessage(...)` 예외 처리 추가
- content script에서 Obsidian note builder fallback 추가
- background 메시지 경로에서 "탭 새로고침 필요" 상태를 일반 번역 실패와 구분
- 팝업 / 드래그 / 우클릭 / 단축키 저장 경로를 `.md` 기준으로 정리

### v1.4.0 — 2026-03-14
**발음 표시 + 우클릭 메뉴**
- 중국어 번역 시 **Pinyin** 자동 표시 (예: nǐ hǎo shìjiè)
- 일본어 번역 시 **Romaji** 자동 표시 (예: kon'nichiwa)
- 발음은 플로팅 패널, 팝업, Obsidian 저장 파일 모두에 포함
- 텍스트 드래그 후 **우클릭 → "Polyglot: Translate"** 컨텍스트 메뉴 추가
- 번역 진입점 3가지: 드래그 버튼 / 우클릭 / Alt+T 단축키

### v1.3.0 — 2026-03-14
**번역 방향 3-way 설정**
- From(소스) / To(타겟) 드롭다운으로 번역 방향 명시 지정
- ⇄ 스왑 버튼으로 방향 전환
- **Save to Folder**: Obsidian 저장 폴더를 Auto 또는 직접 지정 (영어/일본어/중국어/독일어/한국어)
- 소스 언어를 번역 API에 명시 전달 (Auto Detect 지원 유지)

### v1.2.0 — 2026-03-14
**Obsidian 언어별 폴더 구조**
- 저장 경로: `{base}/{언어}/polygot/{YYYY-MM-DD}/{날짜_시간_사이트}.md`
- 소스 언어 자동 감지 → 영어/일본어/중국어/독일어 폴더 자동 분류
- 번역마다 개별 `.md` 파일 생성 (기존: 단일 파일 append)
- 팝업에 Archive Base Path 설정 + 경로 미리보기

### v1.1.0 — 2026-03-14
**드래그 번역 버튼**
- 텍스트 드래그 시 선택 영역 옆에 `P Translate` 플로팅 버튼 표시
- 클릭하면 번역 패널 + Obsidian 저장
- Esc 또는 바깥 클릭으로 닫기

### v1.0.0 — 2026-03-14
**초기 릴리스**
- Manifest V3 Chrome Extension
- Alt+T 단축키로 선택 텍스트 번역 + Obsidian 저장
- Google Translate API (소스 언어 자동 감지)
- Shadow DOM 기반 플로팅 번역 패널 (페이지 스타일 충돌 없음)
- 팝업 UI: Quick Translate + 설정 관리
- Obsidian URI scheme (`obsidian://new?append=true`)으로 아카이브 저장
- 5개 언어 지원: 한국어, English, 日本語, 中文, Deutsch

---

## Web App (index.html)

### v1.3.0 — 2026-03-14
**Obsidian 경로 연동**
- `Path` 버튼으로 웹 앱의 Obsidian 볼트/아카이브 경로 설정 저장
- `Save` 클릭 시 확장과 같은 `{base}/{언어}/polygot/{YYYY-MM-DD}/...md` 경로로 저장
- Obsidian 설정이 없을 때는 기존 `.md` 다운로드로 fallback

### v1.2.0 — 2026-03-14
**입력 커버리지 확장**
- 한국어: Quick Insert에 된소리(ㄲ,ㄸ,ㅃ,ㅆ,ㅉ) + 이중모음(ㅑ,ㅕ,ㅛ,ㅠ,ㅘ,ㅙ,ㅚ,ㅝ,ㅞ,ㅟ,ㅢ 등) 추가 — 22개 → 40개
- 일본어: 현대 외래어 로마지 매핑 추가 (thi→てぃ, dhi→でぃ, twu→とぅ, tsa→つぁ, whi→うぃ 등)
- 중국어: `v`→`ü` 핀인 룩업 버그 수정 (`nv`→女, `lv`→律 정상 동작)
- 중국어: 성조 재수정 가능 (1→ā, 다시 3→ǎ), 5번으로 성조 제거

### v1.1.0 — 2026-03-14
**모듈 분리 리팩토링**
- 단일 784줄 HTML → 8개 파일로 분리
  - `css/style.css` — 스타일
  - `js/data/romaji-kana.js` — 로마지→가나 매핑 데이터
  - `js/data/pinyin-hanzi.js` — 핀인→한자 사전 데이터
  - `js/data/config.js` — 성조, UI 설정, 힌트
  - `js/editor.js` — 에디터 핵심 로직 + UI 헬퍼
  - `js/ime-japanese.js` — 일본어 IME 핸들러
  - `js/ime-chinese.js` — 중국어 IME 핸들러
  - `js/app.js` — 초기화 + 이벤트 리스너
- 기능별 수정이 독립적으로 가능
- Copyright Grady Lee 추가

### v1.0.0 — 2026-03-14
**초기 릴리스**
- 5개 국어 다국어 에디터
- 한국어: OS IME 기반 입력 + 자모 Quick Insert
- 일본어: 로마자→히라가나/카타카나 변환 (소문자/대문자 구분)
- 중국어: 핀인 입력 → 한자 후보 선택, 성조 부호 지원
- 독일어: 직접 입력 + 특수문자(ä,ö,ü,ß) 버튼
- 영어: 직접 입력
- Ctrl+1~5 언어 전환 단축키
- Copy / Clear / Save(.txt) 툴바
- Firebase Hosting 배포
