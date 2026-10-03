// 図（数直線・座標平面・図形）を SVG で描く
const Figure = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let clipCount = 0;

  function svgEl(tag, attrs = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // 数値の目もりラベル（負の数は全角のマイナス記号で表示）
  function formatNumber(n) {
    return n < 0 ? `−${-n}` : String(n);
  }

  function numberLine(fig) {
    const step = 36;
    const padding = 24;
    const count = fig.max - fig.min;
    const width = count * step + padding * 2;
    const height = 76;
    const axisY = 44;
    const xOf = (v) => padding + (v - fig.min) * step;

    const svg = svgEl('svg', {
      class: 'figure number-line',
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': `${formatNumber(fig.min)}から${formatNumber(fig.max)}までの数直線`,
    });

    svg.append(svgEl('line', { x1: padding - 12, y1: axisY, x2: width - padding + 12, y2: axisY, class: 'axis' }));
    svg.append(svgEl('path', {
      d: `M${width - padding + 12} ${axisY} l-8 -5 v10 z`,
      class: 'arrow',
    }));

    for (let v = fig.min; v <= fig.max; v += 1) {
      const x = xOf(v);
      svg.append(svgEl('line', { x1: x, y1: axisY - 5, x2: x, y2: axisY + 5, class: 'tick' }));
      svg.append(svgEl('text', { x, y: axisY + 22, class: `tick-label${v === 0 ? ' is-zero' : ''}` }, formatNumber(v)));
    }

    (fig.points || []).forEach((point) => {
      const x = xOf(point.value);
      svg.append(svgEl('circle', { cx: x, cy: axisY, r: 5, class: 'point' }));
      svg.append(svgEl('text', { x, y: axisY - 14, class: 'point-label' }, point.label));
    });

    return svg;
  }

  // 座標平面：目もり・点・比例のグラフ（y=ax）・反比例のグラフ（y=a/x）
  function coordPlane(fig) {
    const unit = 22;
    const pad = 22;
    const { min, max } = fig;
    const size = (max - min) * unit + pad * 2;
    const px = (x) => pad + (x - min) * unit;
    const py = (y) => pad + (max - y) * unit;

    const svg = svgEl('svg', {
      class: 'figure coord-plane',
      viewBox: `0 0 ${size} ${size}`,
      role: 'img',
      'aria-label': '座標平面のグラフ',
    });

    // 方眼
    for (let v = min; v <= max; v += 1) {
      svg.append(svgEl('line', { x1: px(v), y1: py(min), x2: px(v), y2: py(max), class: 'grid' }));
      svg.append(svgEl('line', { x1: px(min), y1: py(v), x2: px(max), y2: py(v), class: 'grid' }));
    }
    // 軸（矢印つき）
    svg.append(svgEl('line', { x1: px(min) - 8, y1: py(0), x2: px(max) + 8, y2: py(0), class: 'axis' }));
    svg.append(svgEl('line', { x1: px(0), y1: py(min) + 8, x2: px(0), y2: py(max) - 8, class: 'axis' }));
    svg.append(svgEl('path', { d: `M${px(max) + 12} ${py(0)} l-8 -4 v8 z`, class: 'arrow' }));
    svg.append(svgEl('path', { d: `M${px(0)} ${py(max) - 12} l-4 8 h8 z`, class: 'arrow' }));
    svg.append(svgEl('text', { x: px(max) + 6, y: py(0) + 16, class: 'axis-label' }, 'x'));
    svg.append(svgEl('text', { x: px(0) + 10, y: py(max) - 4, class: 'axis-label' }, 'y'));
    svg.append(svgEl('text', { x: px(0) - 7, y: py(0) + 14, class: 'tick-label' }, 'O'));
    // 目もりの数（範囲が広いときは2つおき）
    const step = max - min >= 10 ? 2 : 1;
    for (let v = min; v <= max; v += 1) {
      if (v === 0 || v % step !== 0) continue;
      svg.append(svgEl('text', { x: px(v), y: py(0) + 14, class: 'tick-label' }, formatNumber(v)));
      svg.append(svgEl('text', { x: px(0) - 5, y: py(v) + 4, class: 'tick-label is-y' }, formatNumber(v)));
    }

    // グラフ：範囲内の点をつないで描き、方眼の外ははみ出さないように切り取る
    clipCount += 1;
    const clipId = `coord-clip-${clipCount}`;
    const clip = svgEl('clipPath', { id: clipId });
    clip.append(svgEl('rect', { x: px(min), y: py(max), width: px(max) - px(min), height: py(min) - py(max) }));
    svg.append(clip);
    const inRange = (y) => y >= min - 0.5 && y <= max + 0.5;
    function plot(f, from, to) {
      let d = '';
      let drawing = false;
      const n = 240;
      for (let i = 0; i <= n; i += 1) {
        const x = from + ((to - from) * i) / n;
        const y = f(x);
        if (Number.isFinite(y) && inRange(y)) {
          d += `${drawing ? 'L' : 'M'}${px(x).toFixed(1)} ${py(y).toFixed(1)}`;
          drawing = true;
        } else {
          drawing = false;
        }
      }
      if (d) svg.append(svgEl('path', { d, class: 'graph', 'clip-path': `url(#${clipId})` }));
    }
    (fig.graphs || []).forEach((g) => {
      if (g.kind === 'linear') plot((x) => g.a * x, min, max);
      if (g.kind === 'inverse') {
        plot((x) => g.a / x, min, -0.05);
        plot((x) => g.a / x, 0.05, max);
      }
    });

    (fig.points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).forEach((p) => {
      svg.append(svgEl('circle', { cx: px(p.x), cy: py(p.y), r: 4, class: 'point' }));
      if (p.label) {
        svg.append(svgEl('text', { x: px(p.x) + 9, y: py(p.y) - 7, class: 'point-label' }, p.label));
      }
    });
    return svg;
  }

  // 図形：点・線分・多角形・円・おうぎ形・角の印・ラベル（座標は y が上向き）
  function geometry(fig) {
    // 正しい形の点だけを使い、ない点を使う要素は描かない
    const pts = {};
    Object.entries(fig.points || {}).forEach(([n, v]) => {
      if (Array.isArray(v) && v.length === 2 && v.every(Number.isFinite)) pts[n] = v;
    });
    const P = (name) => pts[name];
    const has = (...names) => names.every((n) => n in pts);
    const ok = {
      segments: (fig.segments || []).filter((s) => has(...s)),
      polygons: (fig.polygons || []).filter((s) => has(...s)),
      circles: (fig.circles || []).filter((c) => has(c.center) && Number.isFinite(c.r)),
      sectors: (fig.sectors || []).filter((c) => has(c.center) && Number.isFinite(c.r)),
      angles: (fig.angles || []).filter((a) => has(a.vertex, a.from, a.to)),
      labels: (fig.labels || []).filter((l) => Array.isArray(l.pos) && l.pos.every(Number.isFinite)),
    };
    // 図全体が入る範囲を求める
    const xs = [];
    const ys = [];
    Object.values(pts).forEach(([x, y]) => { xs.push(x); ys.push(y); });
    ok.circles.forEach((c) => {
      const [cx, cy] = P(c.center);
      xs.push(cx - c.r, cx + c.r);
      ys.push(cy - c.r, cy + c.r);
    });
    // おうぎ形は弧の上の点だけで範囲を決める（空白を作らない）
    ok.sectors.forEach((c) => {
      const [cx, cy] = P(c.center);
      for (let i = 0; i <= 24; i += 1) {
        const t = ((c.from + ((c.to - c.from) * i) / 24) * Math.PI) / 180;
        xs.push(cx + c.r * Math.cos(t));
        ys.push(cy + c.r * Math.sin(t));
      }
      xs.push(cx);
      ys.push(cy);
    });
    ok.labels.forEach((l) => { xs.push(l.pos[0]); ys.push(l.pos[1]); });
    if (xs.length === 0) return document.createComment('empty geometry');
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const scale = 240 / span;
    const pad = 30;
    const width = (maxX - minX) * scale + pad * 2;
    const height = (maxY - minY) * scale + pad * 2;
    const sx = (x) => pad + (x - minX) * scale;
    const sy = (y) => pad + (maxY - y) * scale;
    const at = (name) => [sx(P(name)[0]), sy(P(name)[1])];

    const svg = svgEl('svg', {
      class: 'figure geometry',
      viewBox: `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`,
      role: 'img',
      'aria-label': '図形',
    });

    // おうぎ形（色をぬる）
    ok.sectors.forEach((sec) => {
      const [cx, cy] = at(sec.center);
      const r = sec.r * scale;
      const a1 = (sec.from * Math.PI) / 180;
      const a2 = (sec.to * Math.PI) / 180;
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy - r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy - r * Math.sin(a2);
      const large = sec.to - sec.from > 180 ? 1 : 0;
      svg.append(svgEl('path', {
        d: `M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${large} 0 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`,
        class: 'shape sector',
      }));
    });
    ok.polygons.forEach((poly) => {
      svg.append(svgEl('polygon', { points: poly.map((n) => at(n).join(',')).join(' '), class: 'shape' }));
    });
    ok.circles.forEach((c) => {
      const [cx, cy] = at(c.center);
      svg.append(svgEl('circle', { cx, cy, r: c.r * scale, class: 'shape circle' }));
    });
    ok.segments.forEach(([m, n]) => {
      const [x1, y1] = at(m);
      const [x2, y2] = at(n);
      svg.append(svgEl('line', { x1, y1, x2, y2, class: 'segment' }));
    });

    // 角の印：直角は四角、それ以外は弧（小さいほうの角）
    ok.angles.forEach((ang) => {
      const [vx, vy] = at(ang.vertex);
      const [fx, fy] = at(ang.from);
      const [tx, ty] = at(ang.to);
      let a1 = Math.atan2(vy - fy, fx - vx);
      let a2 = Math.atan2(vy - ty, tx - vx);
      let diff = a2 - a1;
      while (diff <= -Math.PI) diff += 2 * Math.PI;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff < 0) { [a1, a2] = [a2, a1]; diff = -diff; }
      const r = 18;
      if (ang.right) {
        const u = [Math.cos(a1), -Math.sin(a1)];
        const w = [Math.cos(a2), -Math.sin(a2)];
        const k = 11;
        svg.append(svgEl('path', {
          d: `M${vx + u[0] * k} ${vy + u[1] * k} L${vx + (u[0] + w[0]) * k} ${vy + (u[1] + w[1]) * k} L${vx + w[0] * k} ${vy + w[1] * k}`,
          class: 'angle-mark',
        }));
      } else {
        const p1 = [vx + r * Math.cos(a1), vy - r * Math.sin(a1)];
        const p2 = [vx + r * Math.cos(a2), vy - r * Math.sin(a2)];
        svg.append(svgEl('path', {
          d: `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} A${r} ${r} 0 0 0 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`,
          class: 'angle-mark',
        }));
      }
      if (ang.label) {
        const mid = a1 + diff / 2;
        const lr = r + 14;
        svg.append(svgEl('text', { x: vx + lr * Math.cos(mid), y: vy - lr * Math.sin(mid) + 4, class: 'angle-label' }, ang.label));
      }
    });

    // 点の名前：図の中心から外へずらして置く
    const names = Object.keys(pts);
    const cx0 = names.reduce((t, n) => t + P(n)[0], 0) / (names.length || 1);
    const cy0 = names.reduce((t, n) => t + P(n)[1], 0) / (names.length || 1);
    names.forEach((n) => {
      if ((fig.hidePoints || []).includes(n)) return;
      const [x, y] = at(n);
      svg.append(svgEl('circle', { cx: x, cy: y, r: 2.5, class: 'vertex' }));
      let dx = P(n)[0] - cx0;
      let dy = P(n)[1] - cy0;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      if (len < 1e-6) { dx = -0.7; dy = -0.7; }
      svg.append(svgEl('text', { x: x + dx * 14, y: y - dy * 14 + 5, class: 'vertex-label' }, n));
    });
    ok.labels.forEach((l) => {
      svg.append(svgEl('text', { x: sx(l.pos[0]), y: sy(l.pos[1]) + 4, class: 'length-label' }, l.text));
    });
    return svg;
  }

  function render(fig) {
    if (fig && fig.type === 'geometry') return geometry(fig);
    if (fig && fig.type === 'numberLine') return numberLine(fig);
    if (fig && fig.type === 'coordPlane') return coordPlane(fig);
    console.warn('[図] 対応していない図です', fig);
    return document.createComment('unsupported figure');
  }

  return { render };
})();
