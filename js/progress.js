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
        state = sanitize(JSON.parse(raw));
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

  // ---- 書き出し・読み込み ----

  const FILE_APP = 'math-study';

  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const toCount = (v) => (Number.isInteger(v) && v > 0 ? v : 0);
  const toDate = (v) => (typeof v === 'string' ? v : null);

  // 読み込んだ記録を項目ごとに確かめ、正しい形のものだけを取り出す
  function sanitize(input) {
    if (!isObject(input) || input.version !== VERSION || !isObject(input.units) || !isObject(input.mistakes)) {
      throw new Error('記録の形式が正しくありません');
    }
    const units = {};
    Object.entries(input.units).forEach(([unitId, u]) => {
      if (!isObject(u)) return;
      const sections = {};
      Object.entries(isObject(u.sections) ? u.sections : {}).forEach(([id, s]) => {
        if (isObject(s) && s.done === true) sections[id] = { done: true, doneAt: toDate(s.doneAt) };
      });
      const stats = {};
      Object.entries(isObject(u.stats) ? u.stats : {}).forEach(([id, st]) => {
        if (!isObject(st)) return;
        const answered = toCount(st.answered);
        if (answered > 0) stats[id] = { answered, correct: Math.min(toCount(st.correct), answered) };
      });
      const t = isObject(u.test) ? u.test : {};
      const isScore = (v) => typeof v === 'number' && v >= 0 && v <= 100;
      const history = (Array.isArray(t.history) ? t.history : [])
        .filter((h) => isObject(h) && isScore(h.score))
        .map((h) => ({ at: toDate(h.at), score: h.score, passed: h.passed === true }))
        .slice(-HISTORY_LIMIT);
      units[unitId] = {
        sections,
        stats,
        test: {
          best: isScore(t.best) ? t.best : null,
          passed: t.passed === true,
          passedAt: toDate(t.passedAt),
          history,
        },
      };
    });
    const mistakes = {};
    Object.entries(input.mistakes).forEach(([problemId, m]) => {
      if (isObject(m) && typeof m.unitId === 'string' && typeof m.section === 'string') {
        mistakes[problemId] = { unitId: m.unitId, section: m.section, count: Math.max(toCount(m.count), 1), lastAt: toDate(m.lastAt) };
      }
    });
    const result = { version: VERSION, units, mistakes };
    if (toDate(input.lastExportedAt)) result.lastExportedAt = input.lastExportedAt;
    return result;
  }

  // 書き出すファイルの中身。書き出した日時も記録に残す
  function exportData() {
    load().lastExportedAt = now();
    save();
    return { app: FILE_APP, format: VERSION, exportedAt: state.lastExportedAt, progress: state };
  }

  // ファイルの文字列を確かめる。問題があれば Error を投げる
  function parseImport(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error('ファイルを読み取れませんでした（JSON の形式ではありません）');
    }
    if (!isObject(data) || data.app !== FILE_APP) {
      throw new Error('このアプリで書き出したファイルではありません');
    }
    if (data.format !== VERSION) {
      throw new Error('対応していない形式のファイルです');
    }
    return { exportedAt: toDate(data.exportedAt), progress: sanitize(data.progress) };
  }

  // 今の記録を、読み込んだ記録で置き換える
  function replaceWith(progress) {
    state = progress;
    save();
  }

  function lastExportedAt() {
    return load().lastExportedAt || null;
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
    exportData,
    parseImport,
    replaceWith,
    lastExportedAt,
  };
})();
