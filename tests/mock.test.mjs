import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import '../js/mock.js';

const M = globalThis.Mock;

// data/questions.js는 `const QUESTIONS = [...]` 스크립트 — 모듈이 아니라 평가해서 꺼낸다.
const src = readFileSync(new URL('../data/questions.js', import.meta.url), 'utf8');
const QUESTIONS = new Function(src + '; return QUESTIONS;')();

test('대문항은 통째로 뽑힌다 — 소문항이 쪼개지지 않음', () => {
  const byParent = new Map(M.parents(QUESTIONS).map((p) => [p.ids.join(','), p]));
  const picked = new Set(M.pick(QUESTIONS).ids);
  for (const p of byParent.values()) {
    const inside = p.ids.filter((id) => picked.has(id)).length;
    assert.ok(inside === 0 || inside === p.ids.length, `대문항이 쪼개짐: ${p.ids}`);
  }
});

test('한 회는 대문항 13개 — 실제 시험 분량', () => {
  const paper = M.pick(QUESTIONS);
  assert.equal(paper.parents, M.TARGET_PARENTS);
  assert.equal(new Set(Object.values(paper.parentNo)).size, M.TARGET_PARENTS);
});

test('소문항 배점 합 = 총점 (100점 환산의 분모)', () => {
  const paper = M.pick(QUESTIONS);
  const sum = paper.ids.reduce((a, id) => a + paper.pts[id], 0);
  assert.ok(Math.abs(sum - paper.totalPoints) < 1e-9);
});

test('한 시험지에 같은 문제가 두 번 나오지 않는다', () => {
  // 전제: 수도권정비계획법 대문항은 이 4개 회차에 소문항까지 똑같이 실려 있다.
  const REPEATED = ['2021-1-04', '2023-2-02', '2024-3-03', '2025-3-02'];
  const dupes = M.parents(QUESTIONS).filter((p) =>
    REPEATED.some((prefix) => p.ids[0].startsWith(prefix))
  );
  assert.equal(dupes.length, REPEATED.length);
  assert.equal(new Set(dupes.map(M.signature)).size, 1, '전제 확인: 이 4개는 동일 문제');

  for (let i = 0; i < 30; i++) {
    const paper = M.pick(QUESTIONS);
    const sigs = M.parents(QUESTIONS)
      .filter((p) => p.ids.some((id) => paper.parentNo[id]))
      .map(M.signature);
    assert.equal(new Set(sigs).size, sigs.length, '시험지 안에 중복 문제');
  }
});

test('중복 제거 후 고유 대문항은 13개보다 많다 — 뽑을 문제가 모자라지 않음', () => {
  assert.ok(M.unique(QUESTIONS).length > M.TARGET_PARENTS);
});

test('시작할 때마다 문제 조합이 달라진다', () => {
  const key = () => M.pick(QUESTIONS).ids.join('|');
  const papers = new Set([key(), key(), key(), key(), key()]);
  assert.ok(papers.size > 1, '5회 뽑았는데 전부 같은 시험지');
});
