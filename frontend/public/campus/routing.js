/* Offline campus routing. Geometry-derived connections are estimates, not a surveyed network. */
(function (root) {
  'use strict';
  const STEP = .6; // Web Mercator map units (~0.41 ground metres at HG).
  const transit = new Set(['Hallway', 'Stairs', 'Elevator', 'Entrance and Exit', 'Ramp', 'Exhibition', 'Common Room']);
  const floor = f => f.attributes.LEVEL_ID;
  const kind = f => f.attributes.USE_TYPE;
  const name = f => f.attributes.NAME_LONG || f.attributes.NAME || f.id;
  const key = s => String(s).trim().toUpperCase().replace(/^ETH[. ]/, '').replace(/\s/g, '');
  const building = f => floor(f)?.split('.').slice(0, -1).join('.');
  const label = f => `${building(f)?.replace(/^ETH\./, '')} ${f.attributes.Suchfeld1 || name(f).replace(/^\S+\s+/, '')}`;
  const center = f => { const b = f.geometry.bounds; return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };
  function inside(p, g) {
    let hit = false;
    for (const ring of g.parts) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  }
  function segmentDistance(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  class Heap {
    constructor() { this.items = []; }
    push(v) { const a = this.items; let i = a.length; a.push(v); while (i) { const p = (i - 1) >> 1; if (a[p][0] <= v[0]) break; a[i] = a[p]; i = p; } a[i] = v; }
    pop() { const a = this.items, top = a[0], end = a.pop(); if (a.length) { let i = 0; while (2 * i + 1 < a.length) { let c = 2 * i + 1; if (c + 1 < a.length && a[c + 1][0] < a[c][0]) c++; if (a[c][0] >= end[0]) break; a[i] = a[c]; i = c; } a[i] = end; } return top; }
  }
  function create(dataset) {
    if (dataset.format === 'arcgis-viewer-compact-v1') dataset = (typeof module !== 'undefined' ? require('./data.js') : root.ArcGISData).normalize(dataset);
    const units = dataset.layers.filter(l => /^Units\b/i.test(l.name)).flatMap(l => l.features)
      .filter(f => floor(f) && f.geometry?.type === 3);
    const details = dataset.layers.filter(l => l.name === 'Details').flatMap(l => l.features)
      .filter(f => floor(f) && f.geometry)
      .flatMap(f => f.geometry.parts.map(part => {
        const bounds=[Infinity,Infinity,-Infinity,-Infinity];
        for(const [x,y] of part){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}
        return {...f,geometry:{...f.geometry,parts:[part],bounds}};
      }));
    const orders = new Map(dataset.layers.filter(l => /^Levels\b/i.test(l.name)).flatMap(l => l.features)
      .map(f => [floor(f), Number(f.attributes.VERTICAL_ORDER)]));
    const levels = [...new Set(units.map(floor))].sort((a, b) => orders.get(a) - orders.get(b));
    const areas = units.filter(f => transit.has(kind(f)));
    const rooms = units.filter(f => !['Cabinet', 'Service Room', 'Storage Room', ''].includes(kind(f)));
    const locationStarts = new WeakSet();
    const lookup = new Map();
    for (const f of rooms) for (const value of [label(f), name(f), f.attributes.Suchfeld1, f.attributes.Suchfeld2, f.attributes.Suchfeld3]) if (value) {
      const k = key(value);
      if (!lookup.has(k)) lookup.set(k, f);
      else if (lookup.get(k) !== f) lookup.set(k, null);
    }
    function findRoom(value) {
      if (value && typeof value === 'object' && locationStarts.has(value)) return value;
      if (rooms.includes(value)) return value;
      const result = lookup.get(key(value));
      if (result === null) throw new Error(`Room name is ambiguous: ${value}. Include the building, for example CAB E 11.`);
      return result;
    }
    const sr = dataset.layers.find(l => /^Units\b/i.test(l.name))?.spatialReference;
    const wkid = sr?.latestWkid ?? sr?.lastestWkid ?? sr?.wkid;
    const supported = [3857, 102100, 102113, 900913].includes(wkid);
    const metres = units.length ? 1 / Math.cosh(center(units[0])[1] / 6378137) : 1;
    const cache = new Map();
    function grid(level, endpoints, mode) {
      const extras = endpoints.filter(f => floor(f) === level && !transit.has(kind(f)));
      const cacheKey = level + ':' + mode + ':' + extras.map(f => f.id).sort().join('|');
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const shapes = areas.filter(f => floor(f) === level && (mode !== 'elevator' || kind(f) !== 'Stairs')).concat(extras);
      if (!shapes.length) return null;
      const b = [Infinity, Infinity, -Infinity, -Infinity];
      for (const f of shapes) { const v = f.geometry.bounds; b[0] = Math.min(b[0], v[0]); b[1] = Math.min(b[1], v[1]); b[2] = Math.max(b[2], v[2]); b[3] = Math.max(b[3], v[3]); }
      const x0 = Math.floor(b[0] / STEP) * STEP - STEP, y0 = Math.floor(b[1] / STEP) * STEP - STEP;
      const w = Math.ceil((b[2] - x0) / STEP) + 2, h = Math.ceil((b[3] - y0) / STEP) + 2;
      if (w * h > 2000000) throw new Error('Floor geometry is too large to route safely.');
      const cells = new Uint8Array(w * h);
      const point = i => [x0 + (i % w) * STEP, y0 + Math.floor(i / w) * STEP];
      function raster(f, padding, visit) {
        const v = f.geometry.bounds;
        for (let y = Math.max(0, Math.floor((v[1] - padding - y0) / STEP)); y <= Math.min(h - 1, Math.ceil((v[3] + padding - y0) / STEP)); y++)
          for (let x = Math.max(0, Math.floor((v[0] - padding - x0) / STEP)); x <= Math.min(w - 1, Math.ceil((v[2] + padding - x0) / STEP)); x++) visit(y * w + x, point(y * w + x));
      }
      for (const f of shapes) raster(f, 0, (i, p) => { if (inside(p, f.geometry)) cells[i] = 1; });
      const base = cells.slice();
      // Wall strokes block movement; captured door strokes reopen only the local aperture.
      for (const f of details.filter(f => floor(f) === level && /^WAND/.test(kind(f)))) raster(f, .43, (i, p) => {
        if (cells[i] && f.geometry.parts.some(part => part.some((v, j) => j && segmentDistance(p, part[j - 1], v) < .43))) cells[i] = 0;
      });
      for (const f of details.filter(f => floor(f) === level && kind(f) === 'TUER')) raster(f, .65, (i, p) => {
        if (f.geometry.parts.some(part => part.some((v, j) => j && segmentDistance(p, part[j - 1], v) <= .65))) {
          // Allow sub-cell gaps at doors, but never create a bridge across an unmodelled room.
          const x = i % w, y = Math.floor(i / w);
          if (base[i] || [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => x+dx>=0 && x+dx<w && y+dy>=0 && y+dy<h && base[i+dy*w+dx])) cells[i] = 1;
        }
      });
      function anchor(f) {
        const c = f.locationPoint || center(f); let best = -1, distance = Infinity;
        raster(f, 0, (i, p) => { if (cells[i] && inside(p, f.geometry)) { const d = Math.hypot(p[0]-c[0], p[1]-c[1]); if (d < distance) { best=i; distance=d; } } });
        return best;
      }
      const result = { level, cells, w, h, point, anchor };
      if (cache.size > 35) cache.clear();
      cache.set(cacheKey, result); return result;
    }
    function locationStart(point,level) {
      if(!supported)throw new Error('Location routing requires Web Mercator map geometry.');
      if(!point?.every(Number.isFinite) || point.length!==2)throw new Error('Invalid start location.');
      const containing=rooms.filter(f=>floor(f)===level && inside(point,f.geometry));
      containing.sort((a,b)=>{
        const size=f=>(f.geometry.bounds[2]-f.geometry.bounds[0])*(f.geometry.bounds[3]-f.geometry.bounds[1]);
        return size(a)-size(b);
      });
      if(!containing.length)throw new Error('Your location is outside mapped rooms and walkable areas on this floor. Check the selected building and floor, or enter a room manually.');
      const f=containing[0];
      const start={...f,id:`location:${level}:${point.join(',')}`,attributes:{...f.attributes,NAME:'Your location',NAME_LONG:'Your location'},locationPoint:[...point]};
      locationStarts.add(start);return start;
    }
    function route(from, to, mode = 'fastest', maxSeconds = Infinity) {
      if (!supported) throw new Error('Routing requires the captured Web Mercator geometry.');
      const start = findRoom(from), end = findRoom(to);
      if (!start || !end) throw new Error(`Room not found: ${!start ? from : to}. Choose a room with its building from the suggestions.`);
      if (building(start) !== building(end)) throw new Error('Routes between buildings are disabled. Choose two rooms in the same building.');
      const routeLevels = levels.filter(l => l.startsWith(building(start) + '.'));
      const grids = routeLevels.map(l => grid(l, [start, end], mode)).filter(Boolean);
      let count = 0;
      for (const g of grids) { g.offset = count; count += g.cells.length; }
      const byLevel = new Map(grids.map(g => [g.level, g]));
      const startGrid = byLevel.get(floor(start)), endGrid = byLevel.get(floor(end));
      const a = startGrid.anchor(start), z = endGrid.anchor(end);
      if (a < 0 || z < 0) throw Object.assign(new Error('A room has no captured walkable interior.'), { code: 'NO_INTERIOR' });
      const source = startGrid.offset + a, target = endGrid.offset + z;
      const links = new Map();
      const connectors = areas.filter(f => building(f) === building(start) && ['Stairs', 'Elevator'].includes(kind(f)) && (mode !== 'elevator' || kind(f) !== 'Stairs') && (mode !== 'stairs' || kind(f) !== 'Elevator'));
      function link(u, v, seconds, type, f, t) { if (!links.has(u)) links.set(u, []); links.get(u).push({ v, seconds, type, from: f, to: t }); }
      // Match overlapping footprints on the nearest served floor above each connector.
      for (const f of connectors) {
        const order = orders.get(floor(f));
        const candidates = connectors.filter(t => kind(t) === kind(f) && orders.get(floor(t)) > order &&
          inside(center(f), t.geometry) && inside(center(t), f.geometry));
        const nextOrder = Math.min(...candidates.map(t => orders.get(floor(t))));
        for (const t of candidates.filter(t => orders.get(floor(t)) === nextOrder)) {
          const fg = byLevel.get(floor(f)), tg = byLevel.get(floor(t)), fi = fg.anchor(f), ti = tg.anchor(t);
          if (fi < 0 || ti < 0) continue;
          const type = kind(f), seconds = type === 'Elevator' ? 35 + (nextOrder - order) * 4 : (nextOrder - order) * 12;
          link(fg.offset + fi, tg.offset + ti, seconds, type, f, t);
          link(tg.offset + ti, fg.offset + fi, seconds, type, t, f);
        }
      }
      // Dijkstra minimizes travel time, including elevator wait and vertical travel.
      const costs = new Float64Array(count); costs.fill(Infinity); costs[source] = 0;
      const previous = new Int32Array(count); previous.fill(-1);
      const transitions = new Map(), heap = new Heap(); heap.push([0, source, startGrid]);
      const walkSeconds = STEP * metres / 1.35;
      while (heap.items.length) {
        const [cost, id, g] = heap.pop(); if (cost !== costs[id]) continue; if (cost > maxSeconds) break; if (id === target) break;
        const i = id - g.offset, x = i % g.w, y = Math.floor(i / g.w);
        function relax(v, seconds, vg, transition) {
          const next = cost + seconds;
          if (next < costs[v]) { costs[v] = next; previous[v] = id; if (transition) transitions.set(v, transition); else transitions.delete(v); heap.push([next, v, vg]); }
        }
        for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
          if (x+dx<0 || x+dx>=g.w || y+dy<0 || y+dy>=g.h) continue;
          const j = i + dy*g.w+dx;
          if (!g.cells[j] || (dx && dy && (!g.cells[i+dx] || !g.cells[i+dy*g.w]))) continue;
          relax(g.offset+j, walkSeconds * (dx && dy ? Math.SQRT2 : 1), g);
        }
        for (const edge of links.get(id) || []) relax(edge.v, edge.seconds, byLevel.get(floor(edge.to)), edge);
      }
      if (!Number.isFinite(costs[target]) || costs[target] > maxSeconds) throw Object.assign(new Error('No connected route in this capture for these rooms and travel mode. Door or floor connections may be missing.'), { code: 'NO_ROUTE' });
      const ids = []; for (let id = target; id !== -1; id = previous[id]) ids.push(id); ids.reverse();
      const segments = [], changes = []; let distance = 0;
      for (let n=0; n<ids.length; n++) {
        const id=ids[n], g=grids.find(g => id>=g.offset && id<g.offset+g.cells.length), p=g.point(id-g.offset);
        if (!segments.length || segments.at(-1).level !== g.level) segments.push({ level:g.level, points:[] });
        const points=segments.at(-1).points;
        if (points.length) distance+=Math.hypot(p[0]-points.at(-1)[0],p[1]-points.at(-1)[1])*metres;
        points.push(p);
        if (transitions.has(id)) changes.push(transitions.get(id));
      }
      return { start, end, seconds:costs[target], distance, segments, changes };
    }
    async function nearestToilet(from, toiletType, mode = 'fastest', onProgress = () => {}) {
      if (!["Men's Toilet", "Women's Toilet"].includes(toiletType)) throw new Error('Choose men’s or women’s toilets.');
      if (!supported) throw new Error('Routing requires the captured Web Mercator geometry.');
      const start = findRoom(from);
      if (!start) throw new Error(`Room not found: ${from}. Choose a room with its building from the suggestions.`);
      const candidates = rooms.filter(f => kind(f) === toiletType && building(f) === building(start));
      if (!candidates.length) throw new Error(`No ${toiletType.toLowerCase()} locations in this building.`);
      try {
        const result = await nearestRoom(from, candidates, mode, onProgress);
        return result && {...result, toiletType};
      } catch(error) {
        if (error.message.startsWith('No reachable matching room')) throw new Error(`No reachable ${toiletType.toLowerCase()} in this capture for this travel mode. Door or floor connections may be missing.`);
        throw error;
      }
    }
    async function nearestRoom(from, candidates, mode = 'fastest', onProgress = () => {}) {
      if (!supported) throw new Error('Routing requires the captured Web Mercator geometry.');
      const start = findRoom(from);
      if (!start) throw new Error(`Room not found: ${from}. Choose a room with its building from the suggestions.`);
      candidates = candidates.filter(f => rooms.includes(f) && building(f) === building(start));
      if (!candidates.length) throw new Error('No matching rooms in this building.');
      // Check nearby rooms first to get an early bound, then compare every candidate by route time.
      const c = center(start);
      const proximity = f => { const p = center(f); return Math.hypot(p[0]-c[0],p[1]-c[1]); };
      candidates.sort((a,b) => proximity(a)-proximity(b));
      let best = null;
      for (let i=0; i<candidates.length; i++) {
        if (onProgress(i, candidates.length) === false) return null;
        await new Promise(resolve => setTimeout(resolve, 0));
        const candidate = candidates[i];
        if (best) {
          const a = start.geometry.bounds, b = candidate.geometry.bounds;
          const dx = Math.max(0, a[0] - b[2], b[0] - a[2]);
          const dy = Math.max(0, a[1] - b[3], b[1] - a[3]);
          if (Math.hypot(dx, dy) * metres / 1.35 > best.seconds) continue;
        }
        try {
          const result = route(start, candidate, mode, best?.seconds ?? Infinity);
          if (!best || result.seconds < best.seconds) best = result;
        } catch (error) {
          if (!['NO_ROUTE', 'NO_INTERIOR'].includes(error.code)) throw error;
        }
      }
      if (!best) throw new Error('No reachable matching room in this capture for this travel mode. Door or floor connections may be missing.');
      return { ...best, candidatesChecked:candidates.length };
    }
    return { units, areas, rooms, levels, route, nearestToilet, nearestRoom, findRoom, locationStart, label, supported, stats: { walkable:areas.length, stairs:areas.filter(f=>kind(f)==='Stairs').length, elevators:areas.filter(f=>kind(f)==='Elevator').length } };
  }
  const api = { create, inside, STEP };
  if (typeof module !== 'undefined') module.exports = api; else root.HGRouting = api;
})(globalThis);
