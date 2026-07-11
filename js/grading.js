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
