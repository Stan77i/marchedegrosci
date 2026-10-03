// Carte de Côte d'Ivoire (géométrie réelle Natural Earth via world-atlas, d3-geo) : producteurs du catalogue.
(function () {
  const NEIGH = ['430', '324', '466', '854', '288'];
  let topoP = null;
  const getTopo = () => (topoP ||= fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json').then(r => r.json()));

  async function draw(svg, { points = [], focus = null, dest = null, zones = [], onPin, compact = false } = {}) {
    const topo = await getTopo();
    const all = topojson.feature(topo, topo.objects.countries).features;
    const civ = all.find(f => f.id === '384');
    const W = 600, H = 600;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const proj = d3.geoMercator().fitExtent([[36, 26], [W - 36, H - 40]], civ);
    const path = d3.geoPath(proj);
    const P = (lat, lon) => proj([lon, lat]);
    const root = d3.select(svg); root.selectAll('*').remove();
    const uid = 'm' + Math.random().toString(36).slice(2, 7);
    const defs = root.append('defs');
    defs.append('filter').attr('id', uid + 'b').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%').append('feGaussianBlur').attr('stdDeviation', 14);
    defs.append('clipPath').attr('id', uid + 'c').append('path').attr('d', path(civ));
    root.append('g').selectAll('path').data(all.filter(f => NEIGH.includes(f.id))).join('path').attr('d', path).attr('fill', 'var(--color-neutral-200)').attr('stroke', 'var(--color-neutral-300)');
    root.append('text').attr('x', W * 0.6).attr('y', H - 16).attr('class', 'map-sea').text('GOLFE DE GUINÉE');
    root.append('path').attr('d', path(civ)).attr('fill', 'var(--color-surface)').attr('stroke', 'var(--color-accent-2-700)').attr('stroke-width', 1.6).attr('stroke-linejoin', 'round');
    const zg = root.append('g').attr('clip-path', `url(#${uid}c)`);
    zones.forEach(([lat, lon], i) => { const [x, y] = P(lat, lon); zg.append('circle').attr('cx', x).attr('cy', y).attr('r', 0).attr('fill', 'var(--color-accent-2-400)').attr('opacity', .7).attr('filter', `url(#${uid}b)`).transition().delay(i * 90).duration(700).attr('r', compact ? 40 : 58); });
    const fg = root.append('g');
    const D = dest ? P(dest[0], dest[1]) : null;
    if (D) points.forEach((pt, i) => {
      const [x, y] = P(pt.producer.latitude, pt.producer.longitude);
      if (Math.hypot(x - D[0], y - D[1]) < 14) return;
      const mx = (x + D[0]) / 2, my = (y + D[1]) / 2, dx = D[0] - x, dy = D[1] - y;
      const p = fg.append('path').attr('d', `M${x},${y} Q${mx - dy * .25},${my + dx * .25} ${D[0]},${D[1]}`).attr('class', 'map-flow').attr('data-p', pt.producer.id);
      const len = p.node().getTotalLength();
      p.attr('stroke-dasharray', len).attr('stroke-dashoffset', len).transition().delay(250 + i * 120).duration(900).attr('stroke-dashoffset', 0).on('end', function () { d3.select(this).attr('stroke-dasharray', '2 7').classed('moving', true); });
    });
    const pg = root.append('g');
    points.forEach((pt, i) => {
      const pr = pt.producer, [x, y] = P(pr.latitude, pr.longitude);
      const g = pg.append('g').attr('class', 'map-pin' + (pr.id === focus ? ' active' : '')).attr('data-p', pr.id).attr('transform', `translate(${x},${y})`).attr('tabindex', 0).attr('role', 'button').attr('aria-label', `${pr.name}, ${pr.city}`)
        .on('click', () => onPin && onPin(pr.id)).on('keydown', e => { if (e.key === 'Enter') onPin && onPin(pr.id); });
      g.append('circle').attr('class', 'pin-halo').attr('r', 0).transition().delay(150 + i * 80).duration(500).attr('r', 15);
      g.append('circle').attr('class', 'pin-dot').attr('r', 0).transition().delay(150 + i * 80).duration(500).ease(d3.easeBackOut).attr('r', 6.5);
      if (!compact || pr.id === focus) g.append('text').attr('x', 11).attr('y', 4).text(pr.city);
    });
    if (D) root.append('circle').attr('cx', D[0]).attr('cy', D[1]).attr('r', 10).attr('class', 'dest-ring');
    return {
      select(id) { pg.selectAll('.map-pin').classed('active', function () { return this.dataset.p === id; }); fg.selectAll('.map-flow').classed('active', function () { return this.dataset.p === id; }); },
    };
  }
  window.MDGMap = { draw };
})();
