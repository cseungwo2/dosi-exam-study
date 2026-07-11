// 크롭 후 실행. images/ 에 실제 존재하는 파일에 맞춰 questions.js 의 figure/drawFigure 경로를 정리한다.
// - 문제 그림 파일이 없으면 figure 제거.
// - 정답(-answer) 파일이 없는데 문제 그림이 있으면: 그 문제 그림이 정답이 표시된 도면이므로
//   drawFigure를 문제 그림으로 돌리고 figure는 제거(문제 풀 때 답이 노출되지 않도록).
// - 정답 파일도 문제 파일도 없으면 drawFigure 제거.
import fs from 'node:fs';

const imgs = new Set(fs.readdirSync('images'));
let src = fs.readFileSync('data/questions.js', 'utf8').replace(/^const /, 'globalThis.');
eval(src);
const Q = globalThis.QUESTIONS;

let changed = 0;
for (const q of Q) {
  const base = String(q.id).replace(/-[a-z]$/, '');
  const hasFig = imgs.has(`${base}.jpg`);
  const hasAns = imgs.has(`${base}-answer.jpg`);

  if (q.figure && !hasFig) { delete q.figure; changed++; }

  if (q.answer && q.answer.drawFigure) {
    if (hasAns) {
      q.answer.drawFigure = `images/${base}-answer.jpg`;
    } else if (hasFig) {
      q.answer.drawFigure = `images/${base}.jpg`;
      if (q.figure) { delete q.figure; changed++; }
    } else {
      delete q.answer.drawFigure; changed++;
    }
  }
}

fs.writeFileSync('data/questions.js', 'const QUESTIONS = ' + JSON.stringify(Q, null, 2) + ';\n');

// 검증: 남은 모든 그림 경로가 실제 파일을 가리키는지
const missing = [];
for (const q of Q) {
  for (const p of [q.figure, q.answer && q.answer.drawFigure].filter(Boolean)) {
    if (!imgs.has(p.replace('images/', ''))) missing.push(`${q.id}: ${p}`);
  }
}
console.log(`정리 ${changed}건, 남은 그림참조 누락 ${missing.length}건`);
for (const m of missing) console.log('  -', m);
