(function (global) {
  'use strict';

  function normalizeEntry(raw) {
    var e = raw || {};
    var correct = e.correct || 0;
    var wrong = e.wrong || 0;
    var lastCorrect;
    if (e.lastCorrect === true || e.lastCorrect === false) {
      lastCorrect = e.lastCorrect;
    } else if (correct + wrong > 0) {
      // 이전 버전 기록: inWrongNote가 곧 "마지막 시도에서 틀렸는가"였다.
      lastCorrect = !e.inWrongNote;
    } else {
      lastCorrect = null;
    }
    return {
      correct: correct,
      wrong: wrong,
      lastCorrect: lastCorrect,
      lastAnswer: e.lastAnswer != null ? e.lastAnswer : '',
      inWrongNote: !!e.inWrongNote,
    };
  }

  function migrateProgress(progress) {
    var src = progress || {};
    var out = {};
    var changed = false;
    Object.keys(src).forEach(function (id) {
      var before = src[id] || {};
      out[id] = normalizeEntry(before);
      if (before.lastCorrect !== out[id].lastCorrect) changed = true;
    });
    return { progress: out, changed: changed };
  }

  function attempted(entry) {
    return entry.lastCorrect === true || entry.lastCorrect === false;
  }

  function accuracy(progress, ids) {
    var src = progress || {};
    var done = 0;
    var right = 0;
    (ids || []).forEach(function (id) {
      var e = normalizeEntry(src[id]);
      if (!attempted(e)) return;
      done++;
      if (e.lastCorrect) right++;
    });
    return {
      accuracy: done === 0 ? null : Math.round((right / done) * 100),
      attempted: done,
      total: (ids || []).length,
    };
  }

  global.Stats = {
    normalizeEntry: normalizeEntry,
    migrateProgress: migrateProgress,
    accuracy: accuracy,
  };
})(typeof window !== 'undefined' ? window : globalThis);
