# 도시계획기사 실기 학습 웹앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기출문제 사진 53장을 추출해 PC·폰 브라우저에서 타이핑 채점으로 공부하는 정적 웹앱을 GitHub Pages에 배포한다.

**Architecture:** 서버 없는 단일 페이지 앱. 채점 로직(`js/grading.js`)은 순수 함수로 분리해 `node --test`로 테스트하고, UI(`js/app.js`)는 3개 뷰(홈/풀이/오답노트)를 렌더링하며 localStorage에 진행을 저장한다. 문제은행은 `data/questions.js`(전역 `QUESTIONS` 배열)로 포함해 `file://`에서도 동작하게 한다. 사진 판독은 Claude 비전 서브에이전트 병렬 작업으로 수행한다.

**Tech Stack:** 바닐라 HTML/CSS/JS (빌드 없음), Node.js 내장 test runner (채점 로직 테스트), Python Pillow (그림 크롭), GitHub Pages (배포)

## Global Constraints

- 외부 JS 라이브러리·프레임워크·빌드 도구 금지 (스펙: 바닐라 단일 페이지)
- 문제 데이터 스키마는 스펙의 JSON 구조를 따름 (`id`, `year`, `round`, `number`, `points`, `type: essay|blank|calc|draw`, `question`, `answer{essay,blanks,calc{value,solution},drawFigure}`, `keywords`, `figure`)
- 원본 사진(KakaoTalk_*.jpg)은 레포에 커밋하지 않음 — 크롭된 `images/*.jpg`만 포함
- 모바일 우선 반응형 (기준 폭 ~400px, PC는 max-width 720px 가운데 정렬)
- UI 문구는 한국어
- 커밋 메시지 끝: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 작업 디렉토리: `C:\Users\tmddd\dosi-exam-study`

---

### Task 1: 채점 로직 (grading.js) — TDD

**Files:**
- Create: `js/grading.js`
- Test: `tests/grading.test.mjs`

**Interfaces:**
- Produces (전역 `Grading` 객체, node에서는 `globalThis.Grading`):
  - `normalize(s: string): string` — 소문자화, 공백·마침표 제거, 전각→반각
  - `matchAnswer(input: string, expected: string): boolean` — normalize 후 동등 비교, `|`로 구분된 복수 허용답(`"국토교통부장관|국토부장관"`) 중 하나면 true (`/`는 축척 표기와 충돌하여 `|`로 확정)
  - `gradeBlanks(inputs: string[], expected: string[]): {correct: boolean[], allCorrect: boolean}`
  - `gradeCalc(input: string, expectedValue: string): boolean` — 숫자만 추출해 비교 (`"25%"`→`25`, `"10층"`→`10`), 숫자 없으면 matchAnswer로 폴백
  - `findKeywords(input: string, keywords: string[]): {keyword: string, found: boolean}[]` — normalize 기준 포함 여부

- [ ] **Step 1: node 사용 가능 확인**

Run: `node --version`
Expected: `v18` 이상. 없으면 사용자에게 보고하고 채점 로직 테스트를 브라우저 콘솔 수동 검증으로 대체.

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/grading.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/grading.js';
const G = globalThis.Grading;

test('normalize: 공백·마침표 제거, 전각 변환', () => {
  assert.equal(G.normalize(' 국토교통부 장관. '), '국토교통부장관');
  assert.equal(G.normalize('２５％'), '25%');
});

test('matchAnswer: 복수 허용답 슬래시 구분', () => {
  assert.ok(G.matchAnswer('국토부장관', '국토교통부장관/국토부장관'));
  assert.ok(!G.matchAnswer('대통령', '국토교통부장관/국토부장관'));
});

test('gradeBlanks: 빈칸별 채점과 전체 판정', () => {
  const r = G.gradeBlanks(['지형도면', '오년마다'], ['지형도면', '5년마다']);
  assert.deepEqual(r.correct, [true, false]);
  assert.equal(r.allCorrect, false);
});

test('gradeCalc: 단위 무시 숫자 비교', () => {
  assert.ok(G.gradeCalc('25%', '25%'));
  assert.ok(G.gradeCalc('10층', '10층'));
  assert.ok(G.gradeCalc(' 25 ', '25%'));
  assert.ok(!G.gradeCalc('30', '25%'));
});

test('findKeywords: 포함 여부 표시', () => {
  const r = G.findKeywords('정비기반시설이 열악하고', ['정비기반시설', '공동이용시설']);
  assert.deepEqual(r, [
    { keyword: '정비기반시설', found: true },
    { keyword: '공동이용시설', found: false },
  ]);
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `node --test tests/`
Expected: FAIL (`Cannot find module '../js/grading.js'`)

- [ ] **Step 4: 최소 구현**

`js/grading.js`:
```js
(function (global) {
  'use strict';

  function toHalfWidth(s) {
    return s.replace(/[！-～]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    ).replace(/　/g, ' ');
  }

  function normalize(s) {
    return toHalfWidth(String(s ?? ''))
      .toLowerCase()
      .replace(/[\s.·,]/g, '');
  }

  function matchAnswer(input, expected) {
    const n = normalize(input);
    if (!n) return false;
    return String(expected).split('/').some((alt) => normalize(alt) === n);
  }

  function gradeBlanks(inputs, expected) {
    const correct = expected.map((exp, i) => matchAnswer(inputs[i] ?? '', exp));
    return { correct, allCorrect: correct.every(Boolean) };
  }

  function extractNumber(s) {
    const m = toHalfWidth(String(s ?? '')).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  function gradeCalc(input, expectedValue) {
    const expNum = extractNumber(expectedValue);
    const inNum = extractNumber(input);
    if (expNum !== null && inNum !== null) return inNum === expNum;
    return matchAnswer(input, expectedValue);
  }

  function findKeywords(input, keywords) {
    const n = normalize(input);
    return (keywords || []).map((keyword) => ({
      keyword,
      found: n.includes(normalize(keyword)),
    }));
  }

  global.Grading = { normalize, matchAnswer, gradeBlanks, gradeCalc, findKeywords };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test tests/`
Expected: 5 pass, 0 fail

- [ ] **Step 6: 커밋**

```bash
git add js/grading.js tests/grading.test.mjs
git commit -m "feat: 유형별 채점 로직 (빈칸·계산·키워드)"
```

---

### Task 2: 사진 53장 → 문제 추출 (병렬 서브에이전트)

**Files:**
- Create: `data/extracted/batch-1.json` … `batch-6.json` (중간 산출물)
- 원천: `C:\Users\tmddd\Desktop\도시계획기사기출이미지\*.jpg` (53장)

**Interfaces:**
- Produces: batch JSON — 스키마는 Global Constraints의 문제 스키마와 동일하되 두 필드 추가:
  - `sourceImage: "KakaoTalk_….jpg"` (출처 사진 파일명)
  - `figureNeeded: { kind: "question"|"answer", description: "그림 내용 설명" }[]` — 크롭이 필요한 그림 목록 (없으면 빈 배열). 크롭 좌표는 Task 3에서 결정.
- 이 단계에서 `figure`/`answer.drawFigure`는 채우지 않음 (Task 3에서 채움)

- [ ] **Step 1: 사진을 6묶음으로 나눠 병렬 서브에이전트 디스패치**

Agent tool로 6개 general-purpose 에이전트 동시 실행. 묶음: `151549456` 시리즈 30장을 10장×3, `151758430` 시리즈 23장을 8+8+7로. 각 에이전트 프롬프트에 포함할 것:
- 할당된 사진 파일 경로 목록 (절대경로)
- 문제 스키마 전문과 예시 1개 (아래 예시 그대로):
```json
{
  "id": "2018-2-01",
  "year": 2018,
  "round": "제2회",
  "number": 1,
  "points": 6,
  "type": "essay",
  "question": "도시 및 주거 환경 정비법에 의한 정비사업의 종류에 대하여 서술하시오.",
  "answer": { "essay": "가. 주거환경개선사업: …\n나. 재개발사업: …\n다. 재건축사업: …" },
  "keywords": ["주거환경개선사업", "재개발사업", "재건축사업"],
  "sourceImage": "KakaoTalk_20260711_151549456.jpg",
  "figureNeeded": []
}
```
- 규칙: 사진은 90° 회전돼 있음(세로 텍스트) / 페이지 상단 헤더에서 연도·회차 읽기 — 헤더가 없으면 직전 사진과 같은 회차로 간주 / 소문항(가·나, 1)·2))은 별도 문제로 분리하고 id에 `-a`,`-b` 접미사 / 손글씨 필기 무시 / `type` 판정: 빈칸 기호(①㉠괄호)가 있고 정답이 단어 나열이면 `blank`, 수식·계산이면 `calc`, 작도 요구면 `draw`, 나머지 `essay` / `blanks` 배열 순서는 문제의 빈칸 순서와 일치 / 복수 허용 표기는 `|`로 구분 / 그림이 문제 이해에 필수면 `figureNeeded`에 기록
- 출력: 할당 묶음의 모든 문제를 JSON 배열로 `data/extracted/batch-N.json`에 Write (UTF-8)

- [ ] **Step 2: 산출물 존재·파싱 확인**

Run: `node -e "for(let i=1;i<=6;i++){const a=require('./data/extracted/batch-'+i+'.json');console.log(i, a.length)}"`
Expected: 6개 배치 모두 파싱 성공, 문제 수 출력

- [ ] **Step 3: 커밋**

```bash
git add data/extracted/
git commit -m "data: 기출 사진 53장 1차 추출 (배치 6개)"
```

> **보류 — 선생님 추가자료**: 사용자가 자료를 아직 다운로드하지 않음. 파일을 받으면 Task 2와 동일한 추출→Task 2.5 교차검증 파이프라인으로 `batch-extra-N.json`을 만들어 Task 3 병합에 포함한다 (`source: "추가자료"` 태그). Task 3의 중복 병합 로직이 기출과 겹치는 문제를 자동 처리.

---

### Task 2.5: 교차 검증 (정확성 게이트)

**Files:**
- Modify: `data/extracted/batch-*.json` (검증·수정 반영)
- Create: `data/extracted/verify-report.md` (검증 결과 기록)

**Interfaces:**
- Consumes: Task 2의 batch JSON + 원본 사진
- Produces: 검증 완료된 batch JSON (이후 Task 3은 이 데이터만 신뢰)

- [ ] **Step 1: 검증 서브에이전트 병렬 디스패치**

Task 2와 **다른** 에이전트 6개에 배치를 교차 할당(추출한 에이전트가 자기 것을 검증하지 않도록). 각 에이전트: 할당된 batch JSON의 모든 문제를 원본 사진과 문항 단위 대조 —
- 문제 원문 오타·누락 (특히 법령 용어, 숫자, 단위)
- 정답이 해당 문제의 정답이 맞는지 (문제-답 짝 밀림 검출)
- 빈칸 순서와 `blanks` 배열 순서 일치
- 연도·회차·배점 대조
발견한 불일치는 batch JSON을 직접 수정하고, 수정 내역을 `verify-report.md`에 기록 (`문제ID: 수정 전 → 수정 후`).

- [ ] **Step 2: 재파싱 확인 + 커밋**

Run: `node -e "for(let i=1;i<=6;i++){const a=require('./data/extracted/batch-'+i+'.json');console.log(i, a.length)}"`
Expected: 전 배치 파싱 성공

```bash
git add data/extracted/
git commit -m "data: 원본 대조 교차 검증 반영"
```

---

### Task 3: 병합·검수 + 그림 크롭

**Files:**
- Create: `data/questions.js` (최종 문제은행, `const QUESTIONS = [...]`)
- Create: `images/*.jpg` (크롭 그림)
- Create: `scripts/crop.py` (크롭 스크립트)
- Modify: `data/extracted/batch-*.json` → 병합 후 유지(원본 대조용)

**Interfaces:**
- Produces: `data/questions.js` — `const QUESTIONS = [ …문제 객체… ];` 전역 선언. 스키마 필드 중 `sourceImage`·`figureNeeded`는 제거하고, 그림 문제는 `figure: "images/<id>.jpg"` / `answer.drawFigure: "images/<id>-answer.jpg"` 경로로 치환.

- [ ] **Step 1: 배치 병합 + 검수 스크립트**

`scripts/merge.mjs` 작성 후 실행 — 배치 전부(기출 + 추가자료 배치)를 읽어 id 중복 검사, 회차별 문제번호 연속성 확인, `type`별 필수 필드 검증(`blank`→`answer.blanks` 비어있지 않음, `calc`→`answer.calc.value` 존재, `essay`→`answer.essay` 존재, `draw`→`figureNeeded`에 answer 그림 존재), 위반 목록 출력. 위반은 원본 사진을 다시 Read해서 수정.

**중복 병합**: 문제 텍스트를 normalize(공백 제거)해 유사도 비교 → 기출과 추가자료에 같은 문제가 있으면 하나로 합치고 `sources: ["기출","추가자료"]` 태그. 문제은행의 각 문제에 `source` 필드 부여 (홈 화면에서 기출/추가자료 필터 가능하게).

- [ ] **Step 2: 그림 크롭**

`figureNeeded`가 있는 문제마다: 해당 `sourceImage`를 Read로 보고 그림 영역 픽셀 좌표 결정 → `scripts/crop.py`(Pillow: 열기→회전 보정→crop→`images/<id>.jpg` 저장, JPEG quality 85, 최대 폭 1200px 리사이즈)에 좌표 목록 넘겨 일괄 실행. Pillow 없으면 `pip install pillow`.

Run: `python scripts/crop.py`
Expected: `images/` 아래 크롭 파일 생성, 각 파일을 Read로 열어 그림이 온전히 담겼는지 육안 확인 (잘렸으면 좌표 수정 후 재실행)

- [ ] **Step 3: questions.js 생성**

`scripts/merge.mjs`가 최종 배열을 `data/questions.js`로 출력 (`const QUESTIONS = [...];` + 끝에 `\n`). 정렬: 연도→회차→문제번호.

Run: `node -e "eval(require('fs').readFileSync('data/questions.js','utf8'));console.log(QUESTIONS.length, new Set(QUESTIONS.map(q=>q.year+q.round)).size)"`
Expected: 총 문제 수와 회차 수 출력, 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add data/questions.js images/ scripts/
git commit -m "data: 문제은행 병합·검수 + 그림 크롭"
```

---

### Task 4: 웹앱 UI (index.html / css / app.js)

**Files:**
- Create: `index.html`, `css/style.css`, `js/app.js`

**Interfaces:**
- Consumes: `Grading.*` (Task 1 시그니처), 전역 `QUESTIONS` (Task 3)
- Produces: localStorage 키 `dosi-progress-v1` = `{ [questionId]: { correct: number, wrong: number, lastAnswer: string|string[], inWrongNote: boolean } }`

**동작 명세 (뷰 3개, hash 라우팅 `#home` `#quiz` `#review`):**

1. `index.html`: `<div id="app">` 하나 + 스크립트 로드 순서 `data/questions.js` → `js/grading.js` → `js/app.js`. `<meta name="viewport" content="width=device-width, initial-scale=1">`.
2. **홈 뷰**: 제목, 전체 진행률 바(푼 문제/전체, 정답률), 버튼 목록 — 회차별(`2018 제2회 (12문제 · 정답률 75%)` 형식), `전체 랜덤`, `오답노트 (N문제)`. 회차 버튼 클릭 → 해당 회차 문제 순서대로 풀이 모드, 랜덤 → 전체 셔플, 오답노트 → `inWrongNote:true`인 문제만.
3. **풀이 뷰**: 상단 `현재/전체` + 회차·배점 표시. 문제 텍스트(줄바꿈 유지, `white-space: pre-wrap`). `figure` 있으면 `<img>` 표시. 유형별 입력:
   - `blank`: 빈칸 개수만큼 `<input>` (①, ② 라벨)
   - `calc`: `<input>` 1개
   - `essay`: `<textarea rows=5>`
   - `draw`: 입력 없음, 안내문 "종이에 직접 그려보세요" + [정답 그림 보기] 버튼
   [채점] 버튼 → 결과 영역: blank/calc는 자동 O/X(빈칸별 O/X 표시), essay는 내 답 vs 모범답안 나란히 + `findKeywords` 결과를 키워드 칩(포함=초록, 미포함=빨강)으로 표시하고 [맞음]/[틀림] 버튼으로 확정, draw는 정답 그림 공개 후 [맞음]/[틀림] 확정. calc는 정답 공개 시 `solution` 표시. 결과 확정 시 progress 갱신(틀리면 `inWrongNote=true`, 오답노트 모드에서 맞히면 `false`) 후 [다음 문제] 버튼. 마지막 문제면 세션 요약(맞음/틀림 수) → 홈으로.
4. **스타일**: 모바일 우선, 시스템 폰트, 본문 16px 이상, 버튼 터치 타깃 44px 이상, 무채색 기조 + 정답 초록(#16a34a)/오답 빨강(#dc2626) 포인트. 다크모드 대응은 범위 외.

- [ ] **Step 1: index.html + style.css + app.js 구현** (위 명세 전부)
- [ ] **Step 2: 로컬 서버로 흐름 검증**

Run: `python -m http.server 8000` 후 브라우저에서 `http://localhost:8000` 열기
Expected: 홈→회차 선택→각 유형(blank/calc/essay/draw) 채점→오답노트 반영→새로고침 후 진행률 유지, 콘솔 에러 0건. 폰 폭(DevTools 400px)에서 레이아웃 확인.

- [ ] **Step 3: 커밋**

```bash
git add index.html css/ js/app.js
git commit -m "feat: 학습 웹앱 UI (홈·풀이·오답노트)"
```

---

### Task 5: GitHub 배포

**Files:**
- Create: `.gitignore` (`__pycache__/`, `*.pyc`), `README.md` (한 단락: 용도 + Pages URL + 로컬 실행법)

- [ ] **Step 1: 레포 생성·푸시**

```bash
git add .gitignore README.md && git commit -m "docs: README"
gh repo create dosi-exam-study --public --source . --push
```

- [ ] **Step 2: Pages 활성화**

```bash
gh api repos/cseungwo2/dosi-exam-study/pages -X POST -f "source[branch]=master" -f "source[path]=/" 
```
Expected: 201. (main 브랜치명이 master가 아니면 실제 브랜치명 사용)

- [ ] **Step 3: 접속 검증**

Run: 1~2분 후 `curl -s -o /dev/null -w "%{http_code}" https://cseungwo2.github.io/dosi-exam-study/`
Expected: `200`. URL을 사용자에게 전달 (폰 북마크용).

---

## Self-Review 결과

- 스펙 커버리지: 데이터 구조(T2·T3), 채점 4유형(T1·T4), 화면 3개(T4), 그림 크롭(T3), localStorage(T4), Pages 배포(T5) — 누락 없음
- 플레이스홀더: 코드 필요한 T1은 전체 코드 포함, T4는 동작 명세로 구체화(단일 구현자가 한 세션에서 수행)
- 타입 일관성: `Grading.*` 시그니처와 T4 소비 지점, `QUESTIONS` 스키마와 T2→T3 변환 필드 일치 확인
