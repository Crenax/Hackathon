/* Shared by the static viewer and sample preparation script. */
(function (root) {
  'use strict';
  function attributes(feature, result) {
    if (feature.namedAttributes) return feature.namedAttributes;
    return Object.fromEntries((feature.attributes ?? []).map((value, i) => {
      const key = Object.keys(value).find(k => k.endsWith('_value'));
      return [result.fields?.[value.index ?? i]?.name ?? String(i), key === 'null_value' ? null : value[key] ?? null];
    }));
  }
  function geometry(feature, result) {
    const g = feature.geometry;
    if (!g?.coords?.length) return null;
    const type = g.geometryType ?? result.geometryType ?? 0;
    if (![0, 1, 2, 3].includes(type)) return null;
    const stride = 2 + Number(Boolean(result.hasZ)) + Number(Boolean(result.hasM));
    const coords = g.coords;
    const lengths = g.lengths?.length ? g.lengths : [coords.length / stride];
    if (lengths.reduce((a, b) => a + Number(b), 0) * stride !== coords.length) return null;
    const transform = result.transform;
    const sx = transform?.scale?.xScale ?? 1, sy = transform?.scale?.yScale ?? 1;
    const tx = transform?.translate?.xTranslate ?? 0, ty = transform?.translate?.yTranslate ?? 0;
    const ySign = transform && (transform.quantizeOriginPostion ?? 0) === 0 ? -1 : 1;
    const parts = [];
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    let cursor = 0;
    for (const length of lengths) {
      let x = 0, y = 0;
      const part = [];
      for (let i = 0; i < length; i++) {
        const dx = Number(coords[cursor]), dy = Number(coords[cursor + 1]);
        cursor += stride;
        if (!Number.isSafeInteger(dx) || !Number.isSafeInteger(dy)) return null;
        // Each ring/path starts with an absolute vertex. Subsequent vertices are deltas.
        if (!transform) { x = dx; y = dy; }
        else if (i === 0 || type === 0) { x = dx; y = dy; }
        else { x += dx; y += dy; }
        const px = x * sx + tx, py = y * sy * ySign + ty;
        if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
        part.push([px, py]);
        bounds[0] = Math.min(bounds[0], px); bounds[1] = Math.min(bounds[1], py);
        bounds[2] = Math.max(bounds[2], px); bounds[3] = Math.max(bounds[3], py);
      }
      parts.push(part);
    }
    return { type, parts, bounds };
  }
  function unpack(input) {
    const layers = input.layers.map(layer => ({...layer, features:layer.features.map(([id,attributes,packed]) => {
      let geometry = null;
      if (packed) {
        const [type,ox,oy,encoded] = packed;
        const bounds = [Infinity,Infinity,-Infinity,-Infinity];
        const parts = encoded.map(values => {
          let x=ox,y=oy;const points=[];
          for(let i=0;i<values.length;i+=2) {
            x+=values[i];y+=values[i+1];const px=x/input.precision,py=y/input.precision;
            points.push([px,py]);bounds[0]=Math.min(bounds[0],px);bounds[1]=Math.min(bounds[1],py);bounds[2]=Math.max(bounds[2],px);bounds[3]=Math.max(bounds[3],py);
          }
          return points;
        });
        geometry={type,parts,bounds};
      }
      return {id,attributes,geometry};
    })}));
    return {...input,format:'arcgis-viewer-v1',layers};
  }
  function normalize(input) {
    if (input?.format === 'arcgis-viewer-compact-v1') return unpack(input);
    if (input?.format === 'arcgis-viewer-v1' && Array.isArray(input.layers)) return input;
    if (!Array.isArray(input?.records)) throw new Error('Choose an ArcGIS capture JSON file containing records.');
    const layers = new Map();
    let observations = 0, skipped = input.skippedRecords ?? 0, unsupported = 0;
    for (const record of input.records) {
      const result = record.decoded?.queryResult?.featureResult;
      if (!result) { skipped++; continue; }
      const url = record.request?.url ?? record.response?.url ?? 'Unknown layer';
      let key = url.split('?')[0];
      try { const u = new URL(url); key = u.origin + u.pathname.replace(/\/query\/?$/, ''); } catch {}
      if (!layers.has(key)) {
        const segments = key.split('/');
        const serverIndex = segments.findIndex(s => /^(FeatureServer|MapServer)$/i.test(s));
        layers.set(key, { id: key, name: serverIndex > 0 ? segments[serverIndex - 1].replace(/_/g, ' ') : key,
          spatialReference: result.spatialReference ?? {}, fields: new Map(), features: new Map() });
      }
      const layer = layers.get(key);
      for (const field of result.fields ?? []) layer.fields.set(field.name, field);
      for (const feature of result.features ?? []) {
        observations++;
        const attrs = attributes(feature, result);
        // Business IDs also exist on queries that omit the object ID field.
        const idField = ['DETAIL_ID', 'UNIT_ID', 'LEVEL_ID', 'FACILITY_ID', 'SITE_ID']
          .find(k => attrs[k] != null && layer.fields.has(k) &&
            (k !== 'UNIT_ID' || /\/Units[^/]*\//i.test(key)) &&
            (k !== 'LEVEL_ID' || /Levels/i.test(key)) &&
            (k !== 'FACILITY_ID' || /Facilities/i.test(key)) &&
            (k !== 'SITE_ID' || /Sites/i.test(key)));
        const oid = result.objectIdFieldName;
        const identity = idField ? `${idField}:${attrs[idField]}` : attrs[oid] != null ? `${oid}:${attrs[oid]}` : JSON.stringify(attrs);
        const shape = geometry(feature, result);
        if ((feature.geometry?.coords?.length || feature.curveGeometry || feature.shapeBuffer) && !shape) unsupported++;
        const previous = layer.features.get(identity);
        layer.features.set(identity, { id: identity, attributes: { ...previous?.attributes, ...attrs },
          geometry: shape ?? previous?.geometry ?? null });
      }
    }
    if (!layers.size) throw new Error('No decoded feature results found in this file.');
    return { format: 'arcgis-viewer-v1', observations, skipped, unsupported,
      layers: [...layers.values()].map(layer => ({ ...layer, fields: [...layer.fields.values()], features: [...layer.features.values()] })) };
  }
  const api = { normalize, geometry, attributes };
  if (typeof module !== 'undefined') module.exports = api;
  else root.ArcGISData = api;
})(globalThis);
