// 図（数直線・座標平面）を SVG で描く
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

  function render(fig) {
    if (fig && fig.type === 'numberLine') return numberLine(fig);
    if (fig && fig.type === 'coordPlane') return coordPlane(fig);
    console.warn('[図] 対応していない図です', fig);
    return document.createComment('unsupported figure');
  }

  return { render };
})();
