(function (global) {
  'use strict';

  // 실제 시험 규격: 100점 · 150분. 문제은행은 소문항 단위지만 대문항은
  // 공통 지문("다음의 물음에 답하시오")을 공유하므로 대문항 통째로 뽑는다.
  const TARGET_POINTS = 100;
  const MINUTES = 150;
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

  // 배점 합이 100을 넘지 않는 선까지 대문항을 채운다. 호출할 때마다 다른 조합.
  function pick(questions) {
    const picked = [];
    let totalPoints = 0;
    for (const p of shuffle(parents(questions))) {
      if (totalPoints >= TARGET_POINTS) break;
      if (totalPoints + p.points > TARGET_POINTS) continue;
      picked.push(p);
      totalPoints += p.points;
    }
    const ids = [];
    const pts = {};
    for (const p of picked) {
      for (const id of p.ids) {
        pts[id] = p.points / p.ids.length; // 대문항 배점을 소문항에 균등 배분
        ids.push(id);
      }
    }
    return { ids, pts, totalPoints, parents: picked.length };
  }

  global.Mock = { TARGET_POINTS, MINUTES, parents, pick };
})(typeof window !== 'undefined' ? window : globalThis);
