// 배치 6개를 병합·검수하고 data/questions.js 와 data/crop-manifest.json 을 생성한다.
import fs from 'node:fs';

const DIR = 'data/extracted';
let all = [];
for (let i = 1; i <= 6; i++) {
  all = all.concat(JSON.parse(fs.readFileSync(`${DIR}/batch-${i}.json`, 'utf8')));
}

// roundUnknown 재매핑 — 원본 페이지 대조로 확정한 회차 (sourceImage 기준)
for (const q of all) {
  const img = q.sourceImage || '';
  if (img.includes('151549456_10')) {
    // 책 77쪽: 2019 제4회의 계속 (문제 4·5번)
    q.year = 2019; q.round = '제4회';
    q.id = q.id.replace(/^unknown-0?4/, '2019-4-04').replace(/^unknown-0?5/, '2019-4-05');
    delete q.roundUnknown;
  } else if (img.includes('151758430_16')) {
    // 책 113쪽: 2024 제3회의 계속 (문제 4~6번)
    q.year = 2024; q.round = '제3회';
    q.id = q.id.replace(/^unknown-0?4/, '2024-3-04').replace(/^unknown-0?5/, '2024-3-05').replace(/^unknown-0?6/, '2024-3-06');
    delete q.roundUnknown;
  }
}

// 그림 경로 세팅 + 크롭 매니페스트 수집 (소문항 -a/-b는 같은 그림 공유)
const baseOf = (id) => String(id).replace(/-[a-z]$/, '');
const cropQ = {}, cropA = {};
for (const q of all) {
  const bid = baseOf(q.id);
  for (const f of q.figureNeeded || []) {
    if (f.kind === 'question') {
      q.figure = `images/${bid}.jpg`;
      cropQ[bid] = { baseId: bid, sourceImage: q.sourceImage, description: f.description };
    }
    if (f.kind === 'answer') {
      q.answer = q.answer || {};
      q.answer.drawFigure = `images/${bid}-answer.jpg`;
      cropA[bid] = { baseId: bid, sourceImage: q.sourceImage, description: f.description };
    }
  }
}

// 검수
const roundNum = (r) => { const m = String(r || '').match(/제\s*(\d+)/); return m ? +m[1] : 99; };
const ids = new Set();
const errs = [];
for (const q of all) {
  if (ids.has(q.id)) errs.push(`중복 id: ${q.id}`);
  ids.add(q.id);
  const a = q.answer || {};
  if (q.type === 'blank' && !(Array.isArray(a.blanks) && a.blanks.length)) errs.push(`${q.id}: blank인데 blanks 없음`);
  if (q.type === 'calc' && !(a.calc && a.calc.value != null && a.calc.value !== '')) errs.push(`${q.id}: calc인데 value 없음`);
  if (q.type === 'essay' && !a.essay) errs.push(`${q.id}: essay인데 essay 없음`);
  if (q.type === 'draw' && !(q.figure || (a && a.drawFigure) || a.essay)) errs.push(`${q.id}: draw인데 그림/설명 없음`);
  if (!q.year || !q.round) errs.push(`${q.id}: 회차 미확정 (year/round null)`);
}

// 내부 필드 제거 + source 태그
for (const q of all) {
  delete q.sourceImage; delete q.figureNeeded; delete q.roundUnknown;
  delete q.incomplete; delete q.reviewNote;
  q.source = q.source || '기출';
}

// 정렬: 연도 → 회차 → id(자연 정렬)
all.sort((a, b) =>
  (a.year || 9999) - (b.year || 9999) ||
  roundNum(a.round) - roundNum(b.round) ||
  String(a.id).localeCompare(String(b.id), undefined, { numeric: true })
);

fs.writeFileSync('data/questions.js', 'const QUESTIONS = ' + JSON.stringify(all, null, 2) + ';\n');
fs.writeFileSync('data/crop-manifest.json', JSON.stringify({ question: Object.values(cropQ), answer: Object.values(cropA) }, null, 2));

const rounds = [...new Set(all.map((q) => `${q.year} ${q.round}`))];
console.log(`총 ${all.length}문제, ${rounds.length}회차, 크롭대상 문제그림 ${Object.keys(cropQ).length} / 답그림 ${Object.keys(cropA).length}`);
console.log('검수 오류:', errs.length);
for (const e of errs) console.log('  -', e);
