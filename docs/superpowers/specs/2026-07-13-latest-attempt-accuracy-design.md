# 정답률 최신 시도 기준 전환 — 설계

작성일: 2026-07-13

## 문제

현재 정답률은 **누적 평균**이다. 문제별로 `correct`/`wrong` 횟수를 쌓고, 회차 정답률을 `Σcorrect / Σ(correct+wrong)`로 계산한다 (`js/app.js` `accuracyOfIds`).

그래서 같은 회차를 반복해서 풀면 과거 시도가 현재 실력을 희석한다. 2025 제3회를 처음 풀어 73%가 나오고, 복습 후 다시 풀어 다 맞혀도 화면의 정답률은 100%가 되지 않고 두 시도의 평균 근처에 머문다. 학습자가 보고 싶은 값은 "지금 이 회차를 풀면 몇 점인가"인데 지표가 그것을 답하지 못한다.

## 목표

풀 때마다 정답률이 **가장 최근 시도 기준**으로 갈아치워진다. 다시 풀어 몇 개 틀리면 그 점수로, 다 맞히면 100%로 바뀐다. 전체 247문제와 모든 회차에 동일하게 적용한다.

## 정답률 규칙

```
정답률 = (마지막 시도가 정답인 문제 수) ÷ (한 번이라도 풀어본 문제 수)
```

- 문제 하나는 **마지막 채점 결과 하나만** 정답률에 기여한다. 과거 시도는 정답률에 영향을 주지 않는다.
- 한 번도 풀지 않은 문제는 분모에서 제외한다. 집합 내 풀어본 문제가 0개면 정답률은 `null`(화면에 `-`).
- 회차를 중간까지만 푼 경우 **푼 문제만으로 계산**한다. 회차 완주 여부를 판정하는 상태는 두지 않는다. 회차를 재응시하면 문제를 하나씩 채점할 때마다 해당 문제의 최신 결과가 덮어써지고 정답률이 실시간으로 움직인다.
- 전체 정답률도 같은 규칙을 247문제 전체에 적용한 값이다.

## 데이터

`localStorage` 키 `dosi-progress-v1`은 유지한다. 문제별 기록에 필드를 하나 추가한다.

```js
{
  correct: 3,          // 누적 정답 횟수 (유지하되 정답률 계산에는 미사용)
  wrong: 1,            // 누적 오답 횟수 (동일)
  lastCorrect: true,   // 신규: 마지막 채점 결과. 미응시면 null
  lastAnswer: '...',
  inWrongNote: false
}
```

`correct`/`wrong`는 지우지 않는다. 시도 횟수 정보라 나중에 쓸 수 있고, 제거해도 얻는 게 없다. 다만 화면의 정답률은 전부 `lastCorrect`로 계산한다.

### 기존 기록 마이그레이션

`inWrongNote`는 채점할 때마다 `!isCorrect`로 덮어써져 왔으므로 (`finalizeAttempt`), 그 값은 이미 "마지막 시도에서 틀렸는가"와 정확히 같은 의미다. 따라서 `lastCorrect` 필드가 없는 기존 기록은 다음으로 복원한다.

```
풀어본 기록(correct + wrong > 0)  →  lastCorrect = !inWrongNote
미응시 기록                        →  lastCorrect = null
```

기존 학습 기록은 손실 없이 최신 기준으로 이월된다. 마이그레이션은 로드 시 1회 수행하고 결과를 저장한다.

## 구조

정답률 계산과 마이그레이션을 `js/stats.js`로 분리한다. `grading.js`와 같은 형태의 독립 모듈(전역 `Stats` 노출, Node 테스트에서 import 가능)로 만들어 단위 테스트를 붙인다.

```
Stats.normalizeEntry(raw)        // 결측 필드 채움 + lastCorrect 마이그레이션
Stats.migrateProgress(progress)  // 전체 맵 마이그레이션, {progress, changed} 반환
Stats.accuracy(progress, ids)    // {accuracy: 0~100|null, attempted, total}
```

`js/app.js`는 이 모듈을 호출만 한다. `accuracyOfIds`/`getEntry`의 자체 계산 로직은 `Stats`로 대체한다. `index.html`에 `js/stats.js`를 `grading.js` 다음에 로드한다.

## 화면

- 홈 상단: `147 / 247 문제 풀이 · 정답률 82%` — 정답률만 최신 기준으로 바뀌고 표기는 유지.
- 회차 버튼: `(20문제 · 정답률 80% · 5문제 풀이)` — 부분 응시 중임이 드러나도록 풀이 수를 덧붙인다. 완주했으면 `풀이 수 == 문제 수`가 되어 자연히 확인된다.

## 범위 밖

- 오답노트: 이미 마지막 시도 기준(`inWrongNote = !isCorrect`)으로 동작하므로 새 규칙과 일관된다. 변경하지 않는다.
- 시도 이력·추이 그래프, 유형별 통계, 기기 간 동기화: 이번 범위 아님.

## 테스트

`tests/stats.test.mjs`:

- 미응시 집합 → `accuracy === null`
- 마지막 시도만 반영: 같은 문제를 오답 후 정답 처리하면 100%
- 부분 응시: 5/20 풀어 4개 정답 → 80%, `attempted === 5`
- 마이그레이션: `lastCorrect` 없고 `inWrongNote: true`인 기록 → `lastCorrect === false`
- 마이그레이션: 미응시 기록(`correct: 0, wrong: 0`) → `lastCorrect === null`, 분모 제외
- 누적 카운트 무시: `correct: 9, wrong: 0`이어도 `lastCorrect: false`면 오답으로 계산
