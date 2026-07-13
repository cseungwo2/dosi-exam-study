(function (global) {
  'use strict';

  // 문제은행은 소문항 단위지만 대문항은 공통 지문("다음의 물음에 답하시오")을
  // 공유하므로 대문항 통째로 뽑는다.
  //
  // 분량 기준은 배점이 아니라 대문항 개수다. 문제집 복원본은 회차당 40점어치
  // (대문항 5~6개)만 담고 있어, 100점을 채우려 하면 실제 회차 2.5개분을 긁어와
  // 대문항이 16개까지 불어난다. 실제 시험은 한 회 13문항.
  const TARGET_PARENTS = 13;
  const DEFAULT_POINTS = 6;

  function parents(questions) {
    const map = new Map();
    for (const q of questions) {
      const key = q.year + ' ' + q.round + '#' + q.number;
      if (!map.has(key)) map.set(key, { points: q.points || DEFAULT_POINTS, ids: [] });
      map.get(key).ids.push(q.id);
    }
    return [...map.values()];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 대문항 13개를 뽑는다. 호출할 때마다 다른 조합.
  function pick(questions) {
    const picked = shuffle(parents(questions)).slice(0, TARGET_PARENTS);
    const ids = [];
    const pts = {};
    const parentNo = {}; // 소문항 id → 대문항 순번 (진행 표시용)
    let totalPoints = 0;
    picked.forEach((p, i) => {
      totalPoints += p.points;
      for (const id of p.ids) {
        pts[id] = p.points / p.ids.length; // 대문항 배점을 소문항에 균등 배분
        parentNo[id] = i + 1;
        ids.push(id);
      }
    });
    return { ids, pts, parentNo, totalPoints, parents: picked.length };
  }

  global.Mock = { TARGET_PARENTS, parents, pick };
})(typeof window !== 'undefined' ? window : globalThis);
