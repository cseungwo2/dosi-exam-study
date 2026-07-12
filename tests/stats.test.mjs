import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/stats.js';
const S = globalThis.Stats;

test('accuracy: 한 번도 안 푼 집합은 null', () => {
  const r = S.accuracy({}, ['a', 'b']);
  assert.equal(r.accuracy, null);
  assert.equal(r.attempted, 0);
  assert.equal(r.total, 2);
});

test('accuracy: 마지막 시도만 반영 — 틀렸다 맞히면 100%', () => {
  const progress = {
    a: { correct: 1, wrong: 3, lastCorrect: true },
    b: { correct: 1, wrong: 5, lastCorrect: true },
  };
  const r = S.accuracy(progress, ['a', 'b']);
  assert.equal(r.accuracy, 100);
  assert.equal(r.attempted, 2);
});

test('accuracy: 누적 카운트가 아무리 좋아도 마지막이 오답이면 오답', () => {
  const progress = { a: { correct: 9, wrong: 0, lastCorrect: false } };
  assert.equal(S.accuracy(progress, ['a']).accuracy, 0);
});

test('accuracy: 부분 응시는 푼 문제만으로 계산', () => {
  const progress = {
    q1: { correct: 1, wrong: 0, lastCorrect: true },
    q2: { correct: 1, wrong: 0, lastCorrect: true },
    q3: { correct: 1, wrong: 0, lastCorrect: true },
    q4: { correct: 1, wrong: 0, lastCorrect: true },
    q5: { correct: 0, wrong: 1, lastCorrect: false },
  };
  const ids = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'];
  const r = S.accuracy(progress, ids);
  assert.equal(r.accuracy, 80);
  assert.equal(r.attempted, 5);
  assert.equal(r.total, 10);
});

test('accuracy: 반올림', () => {
  const progress = {
    a: { correct: 1, wrong: 0, lastCorrect: true },
    b: { correct: 0, wrong: 1, lastCorrect: false },
    c: { correct: 0, wrong: 1, lastCorrect: false },
  };
  // 1/3 = 33.33% → 33
  assert.equal(S.accuracy(progress, ['a', 'b', 'c']).accuracy, 33);
});

test('migrate: 기존 기록의 inWrongNote로 lastCorrect 복원', () => {
  const raw = {
    a: { correct: 2, wrong: 1, inWrongNote: true, lastAnswer: 'x' },
    b: { correct: 1, wrong: 0, inWrongNote: false, lastAnswer: 'y' },
  };
  const { progress, changed } = S.migrateProgress(raw);
  assert.equal(changed, true);
  assert.equal(progress.a.lastCorrect, false);
  assert.equal(progress.b.lastCorrect, true);
  assert.equal(progress.a.lastAnswer, 'x', '기존 필드는 보존');
});

test('migrate: 미응시 기록은 lastCorrect null — 분모에서 제외', () => {
  const raw = { a: { correct: 0, wrong: 0, inWrongNote: false } };
  const { progress } = S.migrateProgress(raw);
  assert.equal(progress.a.lastCorrect, null);
  assert.equal(S.accuracy(progress, ['a']).accuracy, null);
});

test('migrate: 이미 lastCorrect가 있으면 건드리지 않음', () => {
  const raw = { a: { correct: 1, wrong: 1, lastCorrect: true, inWrongNote: true } };
  const { progress, changed } = S.migrateProgress(raw);
  assert.equal(changed, false);
  assert.equal(progress.a.lastCorrect, true, 'inWrongNote로 덮어쓰지 않음');
});

test('migrate: 빈 진행도는 그대로', () => {
  const { progress, changed } = S.migrateProgress({});
  assert.deepEqual(progress, {});
  assert.equal(changed, false);
});

test('normalizeEntry: 결측 기록은 기본값', () => {
  const e = S.normalizeEntry(undefined);
  assert.equal(e.correct, 0);
  assert.equal(e.wrong, 0);
  assert.equal(e.lastCorrect, null);
  assert.equal(e.lastAnswer, '');
  assert.equal(e.inWrongNote, false);
});
