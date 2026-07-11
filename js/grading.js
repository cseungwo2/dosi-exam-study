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
      .replace(/(?<!\d)\.|\.(?!\d)/g, '')
      .replace(/[\s·,]/g, '');
  }

  function matchAnswer(input, expected) {
    const n = normalize(input);
    if (!n) return false;
    return String(expected).split('|').some((alt) => normalize(alt) === n);
  }

  function gradeBlanks(inputs, expected) {
    const correct = expected.map((exp, i) => matchAnswer(inputs[i] ?? '', exp));
    return { correct, allCorrect: correct.every(Boolean) };
  }

  function extractNumbers(s) {
    return (toHalfWidth(String(s ?? '')).replace(/,/g, '').match(/-?\d+(\.\d+)?/g) || []).map(parseFloat);
  }

  function gradeCalc(input, expectedValue) {
    const inNums = extractNumbers(input);
    return String(expectedValue).split('|').some((alt) => {
      const expNums = extractNumbers(alt);
      if (expNums.length && inNums.length === expNums.length &&
          expNums.every((v, i) => inNums[i] === v)) return true;
      return matchAnswer(input, alt);
    });
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
