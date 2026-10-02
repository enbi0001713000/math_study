// 学習の進捗を localStorage に保存する
const Progress = (() => {
  const STORAGE_KEY = 'math-study-progress';
  const VERSION = 1;
  const HISTORY_LIMIT = 20;
  // 弱点の判定：この回数以上答えていて、正答率がこの値未満
  const WEAK_MIN_ANSWERED = 5;
  const WEAK_ACCURACY = 0.7;

  let state = null;
  let storageOk = true;

  function emptyState() {
    return { version: VERSION, units: {}, mistakes: {} };
  }

  function load() {
    if (state) return state;
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      storageOk = false;
      console.warn('[進捗] localStorage を使えないため、記録は保存されません', err);
    }
    state = emptyState();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === VERSION && parsed.units && parsed.mistakes) {
          state = parsed;
        } else {
          throw new Error('形式が違います');
        }
      } catch (err) {
        console.warn('[進捗] 保存されていた記録を読み込めませんでした。新しく記録を始めます', err);
        try {
          localStorage.setItem(`${STORAGE_KEY}-broken`, raw);
        } catch (e) { /* 退避できなくても続ける */ }
      }
    }
    return state;
  }

  function save() {
    if (!storageOk) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      storageOk = false;
      console.warn('[進捗] 記録を保存できませんでした', err);
    }
  }

  function unitRecord(unitId) {
    const units = load().units;
    if (!units[unitId]) {
      units[unitId] = { sections: {}, stats: {}, test: { best: null, passed: false, passedAt: null, history: [] } };
    }
    return units[unitId];
  }

  function now() {
    return new Date().toISOString();
  }

  function markSectionDone(unitId, sectionId) {
    const record = unitRecord(unitId);
    if (!record.sections[sectionId]) {
      record.sections[sectionId] = { done: true, doneAt: now() };
      save();
    }
  }

  // 答えを1回記録する。間違えたら復習リストに入れ、正解したら外す
  function addAnswer(unitId, problem, correct) {
    const record = unitRecord(unitId);
    const stat = record.stats[problem.section] || { answered: 0, correct: 0 };
    stat.answered += 1;
    if (correct) stat.correct += 1;
    record.stats[problem.section] = stat;

    const mistakes = load().mistakes;
    if (correct) {
      delete mistakes[problem.id];
    } else {
      const prev = mistakes[problem.id];
      mistakes[problem.id] = { unitId, section: problem.section, count: (prev ? prev.count : 0) + 1, lastAt: now() };
    }
  }

  function recordAnswer(unitId, problem, correct) {
    addAnswer(unitId, problem, correct);
    save();
  }

  function recordTest(unitId, grade) {
    grade.results.forEach((r) => addAnswer(unitId, r.problem, r.correct));
    const { test } = unitRecord(unitId);
    test.history.push({ at: now(), score: grade.score, passed: grade.passed });
    if (test.history.length > HISTORY_LIMIT) test.history.splice(0, test.history.length - HISTORY_LIMIT);
    if (test.best === null || grade.score > test.best) test.best = grade.score;
    if (grade.passed && !test.passed) {
      test.passed = true;
      test.passedAt = now();
    }
    save();
  }

  // 復習リストで解き直して正解した問題を外す（正答率には数えない）
  function resolveMistake(problemId) {
    delete load().mistakes[problemId];
    save();
  }

  function accuracyOf(answered, correct) {
    return answered === 0 ? null : correct / answered;
  }

  function isWeak(answered, accuracy) {
    return answered >= WEAK_MIN_ANSWERED && accuracy !== null && accuracy < WEAK_ACCURACY;
  }

  // sectionIds を渡すと、完了した小単元の数をその範囲で数える
  function unitSummary(unitId, sectionIds = null) {
    const record = load().units[unitId];
    if (!record) {
      return {
        status: 'new', doneCount: 0, doneSections: [], answered: 0, correct: 0, accuracy: null,
        weak: false, best: null, passed: false, testCount: 0, sections: {},
      };
    }
    const doneSections = Object.keys(record.sections).filter((id) => !sectionIds || sectionIds.includes(id));
    let answered = 0;
    let correct = 0;
    const sections = {};
    Object.entries(record.stats).forEach(([sectionId, stat]) => {
      answered += stat.answered;
      correct += stat.correct;
      const accuracy = accuracyOf(stat.answered, stat.correct);
      sections[sectionId] = { ...stat, accuracy, weak: isWeak(stat.answered, accuracy) };
    });
    const accuracy = accuracyOf(answered, correct);
    let status = 'new';
    if (record.test.passed) status = 'passed';
    else if (doneSections.length > 0 || answered > 0 || record.test.history.length > 0) status = 'learning';
    return {
      status,
      doneCount: doneSections.length,
      doneSections,
      answered,
      correct,
      accuracy,
      weak: isWeak(answered, accuracy),
      best: record.test.best,
      passed: record.test.passed,
      testCount: record.test.history.length,
      sections,
    };
  }

  function isPassed(unitId) {
    const record = load().units[unitId];
    return Boolean(record && record.test.passed);
  }

  // 新しく間違えた順
  function mistakes() {
    return Object.entries(load().mistakes)
      .map(([problemId, m]) => ({ problemId, ...m }))
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }

  function isStorageAvailable() {
    load();
    return storageOk;
  }

  return {
    WEAK_MIN_ANSWERED,
    WEAK_ACCURACY,
    markSectionDone,
    recordAnswer,
    recordTest,
    resolveMistake,
    unitSummary,
    isPassed,
    mistakes,
    isStorageAvailable,
  };
})();
