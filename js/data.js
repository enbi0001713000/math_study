// データの読み込みと必須項目のチェック
const Data = (() => {
  const UNIT_FIELDS = ['id', 'grade', 'name', 'prerequisites'];
  const SECTION_FIELDS = ['id', 'name'];

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
    unit.sections.forEach((section, i) => {
      warnMissing(section, SECTION_FIELDS, `${label} の小単元 ${section.id || `#${i}`}`);
    });
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
