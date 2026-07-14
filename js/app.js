(function () {
  'use strict';

  var STORAGE_KEY = 'dosi-progress-v1';
  var app = document.getElementById('app');

  // ---------------------------------------------------------------------
  // Progress persistence
  // ---------------------------------------------------------------------
  function loadProgress() {
    var raw;
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      raw = stored ? JSON.parse(stored) : {};
    } catch (e) {
      raw = {};
    }
    var migrated = Stats.migrateProgress(raw);
    return migrated;
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) {
      /* storage unavailable — ignore */
    }
  }

  var loaded = loadProgress();
  var progress = loaded.progress;
  if (loaded.changed) saveProgress();

  function getEntry(id) {
    return Stats.normalizeEntry(progress[id]);
  }

  function setEntry(id, patch) {
    var cur = getEntry(id);
    progress[id] = {
      correct: patch.correct != null ? patch.correct : cur.correct,
      wrong: patch.wrong != null ? patch.wrong : cur.wrong,
      lastCorrect: patch.lastCorrect != null ? patch.lastCorrect : cur.lastCorrect,
      lastAnswer: patch.lastAnswer != null ? patch.lastAnswer : cur.lastAnswer,
      inWrongNote: patch.inWrongNote != null ? patch.inWrongNote : cur.inWrongNote
    };
    saveProgress();
  }

  // ---------------------------------------------------------------------
  // Session state (in-memory only — not persisted across reloads)
  // ---------------------------------------------------------------------
  var session = null; // { ids, index, stats:{correct,wrong}, mode, locked }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function displayAnswer(s) {
    return String(s).split('|').join(' 또는 ');
  }

  function circled(i) {
    // ① is U+2460; supports up to 20 items, falls back to plain number.
    if (i >= 1 && i <= 20) return String.fromCodePoint(0x2460 + (i - 1));
    return '(' + i + ')';
  }

  function questionLabel(q) {
    // 하위 문항(2-a, 2-b …)은 number가 같아 화면에서 구분되지 않는다. 접미사는 id에만 있다.
    var m = /-([a-z])$/.exec(q.id);
    return q.number + '번' + (m ? ' (' + m[1] + ')' : '');
  }

  function questionById(id) {
    for (var i = 0; i < QUESTIONS.length; i++) {
      if (QUESTIONS[i].id === id) return QUESTIONS[i];
    }
    return null;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function roundKey(q) {
    return q.year + ' ' + q.round;
  }

  function groupByRound() {
    var order = [];
    var map = {};
    for (var i = 0; i < QUESTIONS.length; i++) {
      var q = QUESTIONS[i];
      var key = roundKey(q);
      if (!map[key]) { map[key] = []; order.push(key); }
      map[key].push(q.id);
    }
    return { order: order, map: map };
  }

  function statsOfIds(ids) {
    return Stats.accuracy(progress, ids);
  }

  // ---------------------------------------------------------------------
  // 모의고사 — 문제 뽑기는 js/mock.js
  // ---------------------------------------------------------------------
  function startMockSession() {
    var paper = Mock.pick(QUESTIONS);
    session = {
      ids: paper.ids,
      index: 0,
      stats: { correct: 0, wrong: 0 },
      mode: 'mock',
      pts: paper.pts,
      parentNo: paper.parentNo,
      totalPoints: paper.totalPoints,
      score: 0,
      parents: paper.parents
    };
    location.hash = '#quiz';
    render();
  }

  function formatAcc(acc) {
    return acc == null ? '-' : acc + '%';
  }

  function wrongNoteIds() {
    var ids = [];
    for (var i = 0; i < QUESTIONS.length; i++) {
      var e = progress[QUESTIONS[i].id];
      if (e && e.inWrongNote) ids.push(QUESTIONS[i].id);
    }
    return ids;
  }

  // ---------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------
  function render() {
    var hash = location.hash || '#home';
    if ((hash === '#quiz' || hash === '#review') && session) {
      renderQuizView();
    } else {
      if (hash === '#quiz' || hash === '#review') {
        // direct nav / refresh with no active session — bounce home
        location.hash = '#home';
      }
      renderHome();
    }
  }

  window.addEventListener('hashchange', render);

  // ---------------------------------------------------------------------
  // Home view
  // ---------------------------------------------------------------------
  function renderHome() {
    var allIds = QUESTIONS.map(function (q) { return q.id; });
    var overall = statsOfIds(allIds);
    var answered = overall.attempted;
    var total = overall.total;
    var pct = total === 0 ? 0 : Math.round((answered / total) * 100);
    var wrongIds = wrongNoteIds();

    var groups = groupByRound();
    var roundButtons = groups.order.map(function (key) {
      var ids = groups.map[key];
      var s = statsOfIds(ids);
      var roundPct = ids.length === 0 ? 0 : Math.round((s.attempted / ids.length) * 100);
      return (
        '<button type="button" class="btn round-btn" data-action="start-round" data-round-key="' +
        escapeHtml(key) + '">' +
        '<span class="round-main">' +
        '<span class="round-name">' + escapeHtml(key) + '</span>' +
        '<span class="round-count">' + ids.length + '문제 · 정답률 ' + formatAcc(s.accuracy) + '</span>' +
        '</span>' +
        '<span class="round-gauge"><span class="round-gauge-fill" style="width:' + roundPct + '%"></span></span>' +
        '</button>'
      );
    }).join('');

    var html =
      '<div class="page page-home">' +
      '<div class="home-top">' +
      '<h1 class="home-header">도시계획기사 실기<span class="home-sub">기출 학습</span></h1>' +
      '<button type="button" class="btn-reset" data-action="reset-progress"' +
      (answered === 0 ? ' disabled' : '') + '>기록 초기화</button>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-row">' +
      '<div class="stat"><span class="stat-value">' + answered + '<em>/' + total + '</em></span><span class="stat-label">푼 문제</span></div>' +
      '<div class="stat"><span class="stat-value">' + formatAcc(overall.accuracy) + '</span><span class="stat-label">정답률</span></div>' +
      '<div class="stat"><span class="stat-value">' + wrongIds.length + '</span><span class="stat-label">오답노트</span></div>' +
      '</div>' +
      '<div class="progress-bar"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>' +
      '<div class="btn-list">' +
      '<button type="button" class="btn btn-primary" data-action="start-mock">모의고사</button>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn-secondary" data-action="start-random">전체 랜덤</button>' +
      '<button type="button" class="btn btn-secondary" data-action="start-review"' +
      (wrongIds.length === 0 ? ' disabled' : '') + '>오답노트 ' + wrongIds.length + '</button>' +
      '</div>' +
      '</div>' +
      '<h2>회차별</h2>' +
      '<div class="btn-list">' + roundButtons + '</div>' +
      '</div>';

    app.innerHTML = html;
  }

  function startRoundSession(key) {
    var groups = groupByRound();
    var ids = groups.map[key];
    if (!ids || !ids.length) return;
    session = { ids: ids, index: 0, stats: { correct: 0, wrong: 0 }, mode: 'round' };
    location.hash = '#quiz';
    render();
  }

  function startRandomSession() {
    var ids = shuffle(QUESTIONS.map(function (q) { return q.id; }));
    session = { ids: ids, index: 0, stats: { correct: 0, wrong: 0 }, mode: 'random' };
    location.hash = '#quiz';
    render();
  }

  function startReviewSession() {
    var ids = wrongNoteIds();
    if (!ids.length) return;
    session = { ids: ids, index: 0, stats: { correct: 0, wrong: 0 }, mode: 'review' };
    location.hash = '#review';
    render();
  }

  // ---------------------------------------------------------------------
  // Quiz view
  // ---------------------------------------------------------------------
  function renderQuizView() {
    if (session.index >= session.ids.length) {
      renderSummary();
      return;
    }
    var id = session.ids[session.index];
    var q = questionById(id);
    if (!q) {
      // stale id (shouldn't happen) — skip it
      session.index++;
      renderQuizView();
      return;
    }

    var metaParts = [q.year + ' ' + q.round, questionLabel(q)];
    if (q.points != null) metaParts.push(q.points + '점');

    var figureHtml = '';
    if (q.figure) {
      figureHtml =
        '<div class="quiz-figure-wrap">' +
        '<img class="quiz-figure fig-img" src="' + escapeHtml(q.figure) + '" alt="문제 그림">' +
        '</div>';
    }

    var inputHtml = renderInputArea(q);
    var actionsHtml = renderActionsArea(q);

    var html =
      '<div class="page page-quiz">' +
      '<div class="quiz-header">' +
      '<a href="#home" class="link-home" data-action="go-home">← 홈</a>' +
      '<span class="quiz-progress">' +
      (session.mode === 'mock'
        ? session.parentNo[id] + ' / ' + session.parents + '문항'
        : (session.index + 1) + ' / ' + session.ids.length) +
      '</span>' +
      '</div>' +
      '<div class="quiz-meta">' + escapeHtml(metaParts.join(' · ')) + '</div>' +
      '<div class="quiz-question pre">' + escapeHtml(q.question) + '</div>' +
      figureHtml +
      '<div class="quiz-input-area">' + inputHtml + '</div>' +
      '<div class="quiz-actions">' + actionsHtml + '</div>' +
      '<div class="quiz-result" id="quiz-result"></div>' +
      '<div class="quiz-next">' +
      '<button type="button" class="btn btn-secondary" data-action="next" id="next-btn" disabled>다음 문제</button>' +
      '</div>' +
      '</div>';

    app.innerHTML = html;

    var figImg = app.querySelector('.fig-img');
    if (figImg) attachImageFallback(figImg, '(그림 준비 중)');
  }

  function attachImageFallback(img, message) {
    img.addEventListener('error', function onErr() {
      img.removeEventListener('error', onErr);
      var div = document.createElement('div');
      div.className = 'figure-missing';
      div.textContent = message;
      if (img.parentNode) img.parentNode.replaceChild(div, img);
      else img.replaceWith(div);
    });
  }

  function renderInputArea(q) {
    if (q.type === 'blank') {
      var rows = '';
      var blanks = (q.answer && q.answer.blanks) || [];
      for (var i = 0; i < blanks.length; i++) {
        rows +=
          '<div class="blank-row">' +
          '<label>' + circled(i + 1) + '</label>' +
          '<input type="text" class="blank-input" data-idx="' + i + '" autocomplete="off">' +
          '<span class="blank-mark" data-mark-idx="' + i + '"></span>' +
          '</div>';
      }
      return rows;
    }
    if (q.type === 'calc') {
      return '<input type="text" class="calc-input" placeholder="값을 입력하세요" autocomplete="off">';
    }
    if (q.type === 'essay') {
      return '<textarea class="essay-input" rows="5" placeholder="답안을 입력하세요"></textarea>';
    }
    if (q.type === 'draw') {
      return '<p class="draw-hint">종이에 직접 그려보세요.</p>';
    }
    return '';
  }

  function renderActionsArea(q) {
    if (q.type === 'draw') {
      return '<button type="button" class="btn btn-primary" data-action="reveal-draw">정답 그림 보기</button>';
    }
    return '<button type="button" class="btn btn-primary" data-action="grade">채점</button>';
  }

  function enableNext() {
    var btn = document.getElementById('next-btn');
    if (btn) btn.disabled = false;
  }

  function finalizeAttempt(q, isCorrect, lastAnswerValue) {
    var cur = getEntry(q.id);
    setEntry(q.id, {
      correct: cur.correct + (isCorrect ? 1 : 0),
      wrong: cur.wrong + (isCorrect ? 0 : 1),
      lastCorrect: isCorrect,
      lastAnswer: lastAnswerValue,
      inWrongNote: !isCorrect
    });
    if (isCorrect) session.stats.correct++; else session.stats.wrong++;
    if (session.mode === 'mock' && isCorrect) session.score += session.pts[q.id] || 0;
  }

  function handleGrade(q) {
    var resultEl = document.getElementById('quiz-result');
    var gradeBtn = app.querySelector('[data-action="grade"]');

    if (q.type === 'blank') {
      var inputs = [];
      var inputEls = app.querySelectorAll('.blank-input');
      inputEls.forEach(function (el) { inputs.push(el.value); });
      var expected = q.answer.blanks;
      var result = Grading.gradeBlanks(inputs, expected);

      result.correct.forEach(function (ok, i) {
        var markEl = app.querySelector('[data-mark-idx="' + i + '"]');
        if (markEl) {
          markEl.textContent = ok ? 'O' : 'X';
          markEl.className = 'blank-mark ' + (ok ? 'mark-correct' : 'mark-wrong');
        }
      });
      inputEls.forEach(function (el) { el.disabled = true; });
      if (gradeBtn) gradeBtn.disabled = true;

      var expectedList = expected.map(function (exp, i) {
        return '<div>' + circled(i + 1) + ' 정답: ' + escapeHtml(displayAnswer(exp)) + '</div>';
      }).join('');
      resultEl.innerHTML =
        '<div class="result-box">' +
        '<div class="result-summary ' + (result.allCorrect ? 'is-correct' : 'is-wrong') + '">' +
        (result.allCorrect ? '전체 정답' : '일부/전체 오답') +
        '</div>' + expectedList + '</div>';

      finalizeAttempt(q, result.allCorrect, inputs);
      enableNext();
      return;
    }

    if (q.type === 'calc') {
      var inputEl = app.querySelector('.calc-input');
      var inputVal = inputEl ? inputEl.value : '';
      var isOk = Grading.gradeCalc(inputVal, q.answer.calc.value);
      if (inputEl) inputEl.disabled = true;
      if (gradeBtn) gradeBtn.disabled = true;

      resultEl.innerHTML =
        '<div class="result-box">' +
        '<div class="result-summary ' + (isOk ? 'is-correct' : 'is-wrong') + '">' +
        (isOk ? '정답' : '오답') + ' (정답: ' + escapeHtml(displayAnswer(q.answer.calc.value)) + ')' +
        '</div>' +
        '<div class="calc-solution pre">' + escapeHtml(q.answer.calc.solution) + '</div>' +
        '</div>';

      finalizeAttempt(q, isOk, inputVal);
      enableNext();
      return;
    }

    if (q.type === 'essay') {
      var textEl = app.querySelector('.essay-input');
      var textVal = textEl ? textEl.value : '';
      var kw = Grading.findKeywords(textVal, q.keywords || []);
      if (textEl) textEl.disabled = true;
      if (gradeBtn) gradeBtn.disabled = true;

      var chips = kw.map(function (k) {
        return '<span class="chip ' + (k.found ? 'chip-found' : 'chip-missing') + '">' +
          escapeHtml(k.keyword) + '</span>';
      }).join('');

      resultEl.innerHTML =
        '<div class="result-box">' +
        '<div class="essay-compare">' +
        '<div><h4>내 답안</h4><p class="pre">' + escapeHtml(textVal || '(입력 없음)') + '</p></div>' +
        '<div><h4>모범답안</h4><p class="pre">' + escapeHtml(q.answer.essay) + '</p></div>' +
        '</div>' +
        '<div class="chip-list">' + chips + '</div>' +
        '<div class="confirm-row" id="essay-confirm">' +
        '<button type="button" class="btn btn-correct" data-action="confirm" data-value="correct">맞음</button>' +
        '<button type="button" class="btn btn-wrong" data-action="confirm" data-value="wrong">틀림</button>' +
        '</div>' +
        '</div>';

      session.pendingLastAnswer = textVal;
      return;
    }
  }

  function handleRevealDraw(q) {
    var resultEl = document.getElementById('quiz-result');
    var revealBtn = app.querySelector('[data-action="reveal-draw"]');
    if (revealBtn) revealBtn.disabled = true;

    var imgHtml = '';
    if (q.answer && q.answer.drawFigure) {
      imgHtml =
        '<div class="quiz-figure-wrap">' +
        '<img class="quiz-figure fig-img-answer" src="' + escapeHtml(q.answer.drawFigure) + '" alt="정답 그림">' +
        '</div>';
    }

    resultEl.innerHTML =
      '<div class="result-box">' +
      '<h4>정답 그림</h4>' +
      imgHtml +
      '<div class="confirm-row" id="draw-confirm">' +
      '<button type="button" class="btn btn-correct" data-action="confirm" data-value="correct">맞음</button>' +
      '<button type="button" class="btn btn-wrong" data-action="confirm" data-value="wrong">틀림</button>' +
      '</div>' +
      '</div>';

    var answerImg = resultEl.querySelector('.fig-img-answer');
    if (answerImg) attachImageFallback(answerImg, '(정답 그림 준비 중)');

    session.pendingLastAnswer = '';
  }

  function handleConfirm(q, value) {
    var isCorrect = value === 'correct';
    finalizeAttempt(q, isCorrect, session.pendingLastAnswer || '');
    var confirmRow = document.getElementById('essay-confirm') || document.getElementById('draw-confirm');
    if (confirmRow) {
      confirmRow.outerHTML =
        '<div class="confirmed-label ' + (isCorrect ? 'mark-correct' : 'mark-wrong') + '">' +
        '확정: ' + (isCorrect ? '맞음' : '틀림') + '</div>';
    }
    enableNext();
  }

  function handleNext() {
    session.index++;
    render();
  }

  function renderSummary() {
    var stats = session.stats;
    var totalDone = stats.correct + stats.wrong;
    var isMock = session.mode === 'mock';
    // 대문항 배점 합은 회차마다 다르므로 100점 만점으로 환산한다.
    var score = isMock && session.totalPoints > 0
      ? Math.round((session.score / session.totalPoints) * 100)
      : 0;
    var mockHtml = isMock
      ? '<div class="mock-score ' + (score >= 60 ? 'is-correct' : 'is-wrong') + '">' +
        score + '점 · ' + (score >= 60 ? '합격선 통과' : '합격선(60점) 미달') +
        '</div>'
      : '';
    var html =
      '<div class="page page-summary">' +
      '<div class="summary-box">' +
      '<h2>' + (isMock ? '모의고사 완료' : '세션 완료') + '</h2>' +
      mockHtml +
      '<div class="summary-score">' +
      '<span class="mark-correct">맞음 ' + stats.correct + '</span>' +
      '<span class="mark-wrong">틀림 ' + stats.wrong + '</span>' +
      '</div>' +
      '<p>' + (isMock ? session.parents + '문항 (소문항 ' + totalDone + '개)' : '총 ' + totalDone + '문제') + ' 풀이</p>' +
      '<button type="button" class="btn btn-primary" data-action="go-home">홈으로</button>' +
      '</div>' +
      '</div>';
    app.innerHTML = html;
  }

  // ---------------------------------------------------------------------
  // Event delegation
  // ---------------------------------------------------------------------
  app.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.getAttribute('data-action');

    if (action === 'start-round') {
      startRoundSession(target.getAttribute('data-round-key'));
      return;
    }
    if (action === 'start-mock') {
      startMockSession();
      return;
    }
    if (action === 'start-random') {
      startRandomSession();
      return;
    }
    if (action === 'start-review') {
      startReviewSession();
      return;
    }
    if (action === 'reset-progress') {
      if (!confirm('풀이 기록을 모두 초기화할까요?\n정답률·풀이 수·오답노트가 전부 삭제됩니다.')) return;
      progress = {};
      try { localStorage.removeItem(STORAGE_KEY); } catch (err) { /* ignore */ }
      render();
      return;
    }
    if (action === 'go-home') {
      e.preventDefault();
      session = null;
      location.hash = '#home';
      render();
      return;
    }
    if (action === 'grade') {
      var id1 = session.ids[session.index];
      var q1 = questionById(id1);
      handleGrade(q1);
      return;
    }
    if (action === 'reveal-draw') {
      var id2 = session.ids[session.index];
      var q2 = questionById(id2);
      handleRevealDraw(q2);
      return;
    }
    if (action === 'confirm') {
      var id3 = session.ids[session.index];
      var q3 = questionById(id3);
      handleConfirm(q3, target.getAttribute('data-value'));
      return;
    }
    if (action === 'next') {
      handleNext();
      return;
    }
  });

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  render();
})();
