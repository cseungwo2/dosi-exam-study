import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../js/grading.js';
const G = globalThis.Grading;

test('normalize: 공백·마침표 제거, 전각 변환', () => {
  assert.equal(G.normalize(' 국토교통부 장관. '), '국토교통부장관');
  assert.equal(G.normalize('２５％'), '25%');
});

test('matchAnswer: 복수 허용답 파이프 구분', () => {
  assert.ok(G.matchAnswer('국토부장관', '국토교통부장관|국토부장관'));
  assert.ok(!G.matchAnswer('대통령', '국토교통부장관|국토부장관'));
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

test('normalize: 소수점은 보존, 문장 마침표만 제거', () => {
  assert.equal(G.normalize('1.5'), '1.5');
  assert.equal(G.normalize('끝.'), '끝');
  assert.ok(!G.matchAnswer('1.5', '15'));
});

test('gradeCalc: 축척(분수)은 숫자 시퀀스 전체 비교', () => {
  assert.ok(G.gradeCalc('1/1200', '1/1200'));
  assert.ok(!G.gradeCalc('1/600', '1/1200'));
});

test('gradeCalc: 파이프 구분 복수 허용답', () => {
  assert.ok(G.gradeCalc('30개', '20개|30개'));
  assert.ok(!G.gradeCalc('40개', '20개|30개'));
});
