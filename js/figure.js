// 図（数直線・座標平面・図形・立体）を SVG で描く
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

  // 立体：角柱・角錐・直方体・円柱・円錐・球を斜め上から見た形で描く（見えない辺は点線）
  function solid(fig) {
    const yaw = (-28 * Math.PI) / 180;
    const pitch = (25 * Math.PI) / 180;
    // 3D の点 (x, y, z)（y が上）を回転して、画面の点と奥行きを返す
    function view([x, y, z]) {
      const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
      const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
      const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
      const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
      return [x1, y2, z2];
    }
    const shape = fig.shape;
    const h = fig.h || 0;
    const r = fig.r || 0;
    const lines = []; // { a: [x,y], b: [x,y], hidden }
    const paths = []; // { d (3D の点列), hidden }
    const extra = []; // 補助線
    const labelsAt = []; // { p: 3D の点, text }

    // 多面体（角柱・角錐・直方体）
    function polyhedron(verts, faces) {
      const v = verts.map(view);
      const faceVisible = faces.map((f) => {
        const [a, b2, c] = f.map((i) => v[i]);
        const nz = (b2[0] - a[0]) * (c[1] - a[1]) - (b2[1] - a[1]) * (c[0] - a[0]);
        return nz > 0;
      });
      const edges = new Map();
      faces.forEach((f, fi) => {
        f.forEach((i, k) => {
          const j = f[(k + 1) % f.length];
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          const e = edges.get(key) || { i, j, visible: false };
          e.visible = e.visible || faceVisible[fi];
          edges.set(key, e);
        });
      });
      edges.forEach((e) => lines.push({ a: v[e.i], b: v[e.j], hidden: !e.visible }));
      return v;
    }
    const ring = (n, rad, y, offset) => Array.from({ length: n }, (_, k) => {
      const t = offset + (2 * Math.PI * k) / n;
      return [rad * Math.cos(t), y, rad * Math.sin(t)];
    });
    let verts = [];
    if (shape === 'cuboid') {
      const w = fig.w / 2;
      const d = fig.d / 2;
      verts = [[-w, 0, d], [w, 0, d], [w, 0, -d], [-w, 0, -d], [-w, h, d], [w, h, d], [w, h, -d], [-w, h, -d]];
      polyhedron(verts, [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]);
      // 頂点の名前：上の面が ABCD（A が手前左）、下の面が EFGH（E は A の真下）
      if (fig.vertexLabels) {
        const names = ['E', 'F', 'G', 'H', 'A', 'B', 'C', 'D'];
        verts.forEach((v3, i) => labelsAt.push({ p: v3, text: names[i], vertex: true }));
      }
      if (fig.labels) {
        if (fig.labels.w) labelsAt.push({ p: [0, -0.18 * h, d], text: fig.labels.w });
        if (fig.labels.d) labelsAt.push({ p: [w + 0.15 * fig.w, 0, 0], text: fig.labels.d });
        if (fig.labels.h) labelsAt.push({ p: [w + 0.3 * fig.w, h / 2, d], text: fig.labels.h });
      }
    } else if (shape === 'prism' || shape === 'pyramid') {
      const n = fig.sides || 4;
      // 辺の数が奇数のときは頂点を手前に、偶数のときは辺を手前に向ける
      const offset = n % 2 === 1 ? Math.PI / 2 : Math.PI / 2 + Math.PI / n;
      const base = ring(n, r, 0, offset);
      // 面は外から見て反時計回り（円周の点の並びが逆向きなので、面ごとに逆にする）
      const flip = (faces) => faces.map((f) => [...f].reverse());
      if (shape === 'prism') {
        verts = [...base, ...ring(n, r, h, offset)];
        const faces = [[...Array(n).keys()].reverse(), [...Array(n).keys()].map((k) => k + n)];
        for (let k = 0; k < n; k += 1) faces.push([k, (k + 1) % n, ((k + 1) % n) + n, k + n]);
        polyhedron(verts, flip(faces));
      } else {
        verts = [...base, [0, h, 0]];
        const faces = [[...Array(n).keys()].reverse()];
        for (let k = 0; k < n; k += 1) faces.push([k, (k + 1) % n, n]);
        polyhedron(verts, flip(faces));
      }
      if (fig.labels && fig.labels.h) {
        if (shape === 'pyramid') {
          extra.push([[0, 0, 0], [0, h, 0]]);
          labelsAt.push({ p: [0.12 * r, h * 0.4, 0], text: fig.labels.h, side: 'right' });
        } else {
          // 手前で右側の縦の辺の横に置く
          const vv = base.map(view);
          let best = 0;
          vv.forEach((p, k) => { if (p[0] + p[2] * 0.3 > vv[best][0] + vv[best][2] * 0.3) best = k; });
          labelsAt.push({ p: [base[best][0] * 1.25, h / 2, base[best][2] * 1.25], text: fig.labels.h });
        }
      }
      if (fig.labels && fig.labels.a) {
        // 手前の底辺の真ん中
        let best = 0;
        let bestZ = -Infinity;
        for (let k = 0; k < n; k += 1) {
          const m = base[k].map((c, i) => (c + base[(k + 1) % n][i]) / 2);
          const z = view(m)[2];
          if (z > bestZ) { bestZ = z; best = k; }
        }
        const m = base[best].map((c, i) => (c + base[(best + 1) % n][i]) / 2);
        labelsAt.push({ p: [m[0] * 1.25, -0.08 * (h || r), m[2] * 1.25], text: fig.labels.a });
      }
    } else if (shape === 'cylinder' || shape === 'cone' || shape === 'sphere') {
      const N = 72;
      const circle = (y, rad) => Array.from({ length: N + 1 }, (_, k) => {
        const t = (2 * Math.PI * k) / N;
        return [rad * Math.cos(t), y, rad * Math.sin(t)];
      });
      // 手前半分は実線、奥半分は点線
      const splitEllipse = (pts, hideBack) => {
        let cur = [];
        let curHidden = null;
        pts.forEach((p3) => {
          const hidden = hideBack && view(p3)[2] < 0;
          if (curHidden !== null && hidden !== curHidden) {
            paths.push({ pts: cur, hidden: curHidden });
            cur = [cur[cur.length - 1]];
          }
          cur.push(p3);
          curHidden = hidden;
        });
        paths.push({ pts: cur, hidden: curHidden });
      };
      // 画面上で左右のはしになる円周上の点
      const sideAngles = () => {
        let minT = 0;
        let maxT = 0;
        let minX = Infinity;
        let maxX = -Infinity;
        for (let k = 0; k < 360; k += 1) {
          const t = (k * Math.PI) / 180;
          const x = view([r * Math.cos(t), 0, r * Math.sin(t)])[0];
          if (x < minX) { minX = x; minT = t; }
          if (x > maxX) { maxX = x; maxT = t; }
        }
        return [minT, maxT];
      };
      if (shape === 'cylinder') {
        splitEllipse(circle(0, r), true);
        splitEllipse(circle(h, r), false);
        sideAngles().forEach((t) => {
          lines.push({ a: view([r * Math.cos(t), 0, r * Math.sin(t)]), b: view([r * Math.cos(t), h, r * Math.sin(t)]), hidden: false });
        });
        if (fig.labels && fig.labels.h) {
          const t = sideAngles()[1];
          labelsAt.push({ p: [r * Math.cos(t) * 1.3, h / 2, r * Math.sin(t) * 1.3], text: fig.labels.h });
        }
        if (fig.labels && fig.labels.r) {
          extra.push([[0, h, 0], [r, h, 0]]);
          labelsAt.push({ p: [r / 2, h + 0.08 * (h + r), 0], text: fig.labels.r });
        }
      } else if (shape === 'cone') {
        splitEllipse(circle(0, r), true);
        sideAngles().forEach((t) => {
          lines.push({ a: view([r * Math.cos(t), 0, r * Math.sin(t)]), b: view([0, h, 0]), hidden: false });
        });
        if (fig.labels && fig.labels.h) {
          extra.push([[0, 0, 0], [0, h, 0]]);
          labelsAt.push({ p: [0.12 * r, h * 0.4, 0], text: fig.labels.h, side: 'right' });
        }
        if (fig.labels && fig.labels.r) {
          extra.push([[0, 0, 0], [r, 0, 0]]);
          labelsAt.push({ p: [r / 2, -0.12 * (h + r) / 2, 0], text: fig.labels.r });
        }
        if (fig.labels && fig.labels.l) {
          const t = sideAngles()[1];
          labelsAt.push({ p: [r * Math.cos(t) * 0.75, h / 2, r * Math.sin(t) * 0.75], text: fig.labels.l, side: 'right' });
        }
      } else {
        // 球：輪郭の円と、赤道（奥半分は点線）
        paths.push({ circle: true });
        splitEllipse(circle(0, r), true);
        if (fig.labels && fig.labels.r) {
          extra.push([[0, 0, 0], [r, 0, 0]]);
          labelsAt.push({ p: [r / 2, 0.12 * r, 0], text: fig.labels.r });
        }
      }
    }

    // 画面の範囲を決める
    const all = [];
    lines.forEach((l) => all.push(l.a, l.b));
    paths.forEach((pth) => (pth.pts || []).forEach((p3) => all.push(view(p3))));
    if (shape === 'sphere') all.push(view([0, r, 0]), view([0, -r, 0]), [-r, 0, 0], [r, 0, 0]);
    labelsAt.forEach((l) => all.push(view(l.p)));
    if (all.length === 0) return document.createComment('empty solid');
    const minX = Math.min(...all.map((p3) => p3[0]));
    const maxX = Math.max(...all.map((p3) => p3[0]));
    const minY = Math.min(...all.map((p3) => p3[1]));
    const maxY = Math.max(...all.map((p3) => p3[1]));
    const scale = 200 / Math.max(maxX - minX, maxY - minY, 0.001);
    const pad = 26;
    const width = (maxX - minX) * scale + pad * 2;
    const height = (maxY - minY) * scale + pad * 2;
    const X = (p3) => (pad + (p3[0] - minX) * scale).toFixed(1);
    const Y = (p3) => (pad + (maxY - p3[1]) * scale).toFixed(1);

    const svg = svgEl('svg', {
      class: 'figure solid',
      viewBox: `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`,
      role: 'img',
      'aria-label': '立体の図',
    });
    paths.forEach((pth) => {
      if (pth.circle) {
        const c = view([0, 0, 0]);
        svg.append(svgEl('circle', { cx: X(c), cy: Y(c), r: (r * scale).toFixed(1), class: 'edge' }));
        return;
      }
      const d = pth.pts.map((p3, k) => `${k ? 'L' : 'M'}${X(view(p3))} ${Y(view(p3))}`).join('');
      svg.append(svgEl('path', { d, class: pth.hidden ? 'edge is-hidden' : 'edge' }));
    });
    lines.forEach((l) => {
      svg.append(svgEl('line', { x1: X(l.a), y1: Y(l.a), x2: X(l.b), y2: Y(l.b), class: l.hidden ? 'edge is-hidden' : 'edge' }));
    });
    extra.forEach(([p1, p2]) => {
      const a1 = view(p1);
      const b1 = view(p2);
      svg.append(svgEl('line', { x1: X(a1), y1: Y(a1), x2: X(b1), y2: Y(b1), class: 'edge is-aux' }));
    });
    // 頂点の名前は、画面上で図の中心から外側へ 13px ずらす
    const vtx = labelsAt.filter((l) => l.vertex).map((l) => view(l.p));
    const mid = vtx.length ? [vtx.reduce((t, q) => t + q[0], 0) / vtx.length, vtx.reduce((t, q) => t + q[1], 0) / vtx.length] : [0, 0];
    labelsAt.forEach((l) => {
      const p3 = view(l.p);
      if (l.vertex) {
        const dx = p3[0] - mid[0];
        const dy = p3[1] - mid[1];
        const len = Math.hypot(dx, dy) || 1;
        const lx = Number(X(p3)) + (dx / len) * 13;
        const ly = Number(Y(p3)) - (dy / len) * 13 + 5;
        svg.append(svgEl('text', { x: lx.toFixed(1), y: ly.toFixed(1), class: 'solid-label is-vertex' }, l.text));
        return;
      }
      svg.append(svgEl('text', { x: X(p3), y: (Number(Y(p3)) + 4).toFixed(1), class: `solid-label${l.side === 'right' ? ' is-left' : ''}${l.vertex ? ' is-vertex' : ''}` }, l.text));
    });
    return svg;
  }

  function render(fig) {
    if (fig && fig.type === 'solid') return solid(fig);
    if (fig && fig.type === 'geometry') return geometry(fig);
    if (fig && fig.type === 'numberLine') return numberLine(fig);
    if (fig && fig.type === 'coordPlane') return coordPlane(fig);
    console.warn('[図] 対応していない図です', fig);
    return document.createComment('unsupported figure');
  }

  return { render };
})();
