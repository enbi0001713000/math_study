// データの読み込みと必須項目のチェック
const Data = (() => {
  const UNIT_FIELDS = ['id', 'grade', 'name', 'prerequisites'];
  const SECTION_FIELDS = ['id', 'name'];
  const PROBLEM_FIELDS = ['id', 'section', 'role', 'question', 'answers', 'hints', 'solution'];
  const PROBLEM_ROLES = ['example', 'check', 'test'];
  const BLOCK_TYPES = ['text', 'math', 'figure'];

  let unitMapCache = null;
  const unitCache = {};

  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(`${path} の読み込みに失敗しました（${res.status}）`);
    }
    return res.json();
  }

  function warnMissing(obj, fields, label) {
    fields.forEach((field) => {
      if (obj[field] === undefined || obj[field] === null) {
        console.warn(`[データ] ${label}: 必須項目「${field}」がありません`);
      }
    });
  }

  function validateUnitMap(map) {
    if (!Array.isArray(map.grades)) {
      console.warn('[データ] units.json: grades が配列ではありません');
      map.grades = [];
    }
    if (!Array.isArray(map.units)) {
      console.warn('[データ] units.json: units が配列ではありません');
      map.units = [];
    }

    const gradeIds = new Set(map.grades.map((g) => g.id));
    const unitIds = new Set();

    map.units.forEach((unit, i) => {
      const label = `units.json の単元 ${unit.id || `#${i}`}`;
      warnMissing(unit, UNIT_FIELDS, label);
      if (unitIds.has(unit.id)) {
        console.warn(`[データ] ${label}: 単元IDが重複しています`);
      }
      unitIds.add(unit.id);
      if (unit.grade && !gradeIds.has(unit.grade)) {
        console.warn(`[データ] ${label}: 区分「${unit.grade}」が grades にありません`);
      }
      if (unit.prerequisites !== undefined && !Array.isArray(unit.prerequisites)) {
        console.warn(`[データ] ${label}: prerequisites が配列ではありません`);
        unit.prerequisites = [];
      }
      if (unit.keys !== undefined && unit.keys !== null && !Array.isArray(unit.keys)) {
        console.warn(`[データ] ${label}: keys が配列ではありません`);
      }
    });

    map.units.forEach((unit) => {
      (unit.prerequisites || []).forEach((pre) => {
        if (!unitIds.has(pre)) {
          console.warn(`[データ] 単元 ${unit.id}: 前提単元「${pre}」が存在しません`);
        }
      });
    });
  }

  function validateUnit(unit, unitId) {
    const label = `units/${unitId}.json`;
    if (unit.id !== unitId) {
      console.warn(`[データ] ${label}: id が「${unitId}」と一致しません`);
    }
    if (!Array.isArray(unit.sections)) {
      console.warn(`[データ] ${label}: sections が配列ではありません`);
      unit.sections = [];
    }
    const sectionIds = new Set();
    unit.sections.forEach((section, i) => {
      const sectionLabel = `${label} の小単元 ${section.id || `#${i}`}`;
      warnMissing(section, SECTION_FIELDS, sectionLabel);
      sectionIds.add(section.id);
      if (section.explanation === undefined) return;
      if (!Array.isArray(section.explanation)) {
        console.warn(`[データ] ${sectionLabel}: explanation が配列ではありません`);
        section.explanation = [];
        return;
      }
      section.explanation.forEach((block, j) => {
        const blockLabel = `${sectionLabel} の解説ブロック #${j}`;
        if (!BLOCK_TYPES.includes(block.type)) {
          console.warn(`[データ] ${blockLabel}: type「${block.type}」は使えません`);
        } else if (block.type === 'figure') {
          validateFigure(block.figure, blockLabel);
        } else {
          warnMissing(block, ['text'], blockLabel);
        }
      });
    });

    if (!Array.isArray(unit.problems)) {
      console.warn(`[データ] ${label}: problems が配列ではありません`);
      unit.problems = [];
    }
    const problemIds = new Set();
    unit.problems.forEach((problem, i) => {
      const problemLabel = `${label} の問題 ${problem.id || `#${i}`}`;
      warnMissing(problem, PROBLEM_FIELDS, problemLabel);
      if (!('figure' in problem)) {
        console.warn(`[データ] ${problemLabel}: 必須項目「figure」がありません（図がないときは null）`);
      }
      if (problemIds.has(problem.id)) {
        console.warn(`[データ] ${problemLabel}: 問題IDが重複しています`);
      }
      problemIds.add(problem.id);
      if (problem.section && !sectionIds.has(problem.section)) {
        console.warn(`[データ] ${problemLabel}: 小単元「${problem.section}」が sections にありません`);
      }
      if (problem.role && !PROBLEM_ROLES.includes(problem.role)) {
        console.warn(`[データ] ${problemLabel}: role「${problem.role}」は使えません`);
      }
      if (problem.answers !== undefined && (!Array.isArray(problem.answers) || problem.answers.length === 0)) {
        console.warn(`[データ] ${problemLabel}: answers は1つ以上の正解を持つ配列にしてください`);
      }
      if (problem.hints !== undefined && !Array.isArray(problem.hints)) {
        console.warn(`[データ] ${problemLabel}: hints が配列ではありません`);
      }
      // 不足していても画面が止まらないようにする
      if (!Array.isArray(problem.answers)) problem.answers = [];
      if (!Array.isArray(problem.hints)) problem.hints = [];
      if (problem.figure) validateFigure(problem.figure, problemLabel);
    });
  }

  function validateFigure(figure, label) {
    if (!figure || typeof figure !== 'object') {
      console.warn(`[データ] ${label}: figure がありません`);
      return;
    }
    if (figure.type === 'numberLine') {
      if (typeof figure.min !== 'number' || typeof figure.max !== 'number' || figure.min >= figure.max) {
        console.warn(`[データ] ${label}: 数直線の min・max が正しくありません`);
      }
    } else {
      console.warn(`[データ] ${label}: 図の種類「${figure.type}」には対応していません`);
    }
  }

  async function loadUnitMap() {
    if (!unitMapCache) {
      const map = await fetchJson('data/units.json');
      validateUnitMap(map);
      unitMapCache = map;
    }
    return unitMapCache;
  }

  async function loadUnit(unitId) {
    if (!unitCache[unitId]) {
      const unit = await fetchJson(`data/units/${unitId}.json`);
      validateUnit(unit, unitId);
      unitCache[unitId] = unit;
    }
    return unitCache[unitId];
  }

  return { loadUnitMap, loadUnit };
})();
