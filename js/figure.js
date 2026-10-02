// 図（数直線など）を SVG で描く
const Figure = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

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

  function render(fig) {
    if (fig && fig.type === 'numberLine') return numberLine(fig);
    console.warn('[図] 対応していない図です', fig);
    return document.createComment('unsupported figure');
  }

  return { render };
})();
