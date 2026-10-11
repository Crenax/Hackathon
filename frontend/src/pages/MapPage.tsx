import { useEffect, useRef, useState } from 'react';
import { GeoAlt, Map as MapIcon, ArrowRight, Crosshair, Plus, Dash } from 'react-bootstrap-icons';
import { buildingOf, floorName, loadCampus, roomName } from '../map/campus';
import type { Availability, Dataset, Feature, Point, Router, RouteResult } from '../map/campus';
import locationsTsv from '../map/locations.tsv?raw';
import './MapPage.css';

const locationRooms = [...new Set(locationsTsv.trim().split(/\r?\n/).slice(1)
  .map(row => row.split('\t')[0].trim()).filter(Boolean))];

export default function MapPage() {
  const [campus, setCampus] = useState<{ data: Dataset; router: Router }>();
  const [error, setError] = useState('');
  const [building, setBuilding] = useState('ETH.HG');
  const [level, setLevel] = useState('ETH.HG.E');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [destination, setDestination] = useState('room');
  const [toilet, setToilet] = useState('any');
  const [mode, setMode] = useState('fastest');
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [availability, setAvailability] = useState<Availability>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [position, setPosition] = useState<GeolocationPosition>();
  const [heading, setHeading] = useState<number>();
  const [tracking, setTracking] = useState(false);
  const [useLocation, setUseLocation] = useState(false);
  const [locationLevel, setLocationLevel] = useState('ETH.HG.E');
  const [locationStatus, setLocationStatus] = useState('');
  const [selected, setSelected] = useState<Feature>();
  const request = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const tracker = useRef<ReturnType<typeof window.MapLocation.tracker> | null>(null);

  useEffect(() => {
    let mounted = true;
    const pendingRequest = request;
    loadCampus().then(value => {
      if (!mounted) return;
      setCampus(value);
      tracker.current = window.MapLocation.tracker({
        onPosition: value => { setPosition(value); setLocationStatus(`Location found · accurate to about ${Math.round(value.coords.accuracy)} m. Select your building and floor.`); },
        onHeading: setHeading,
        onStatus: message => { setLocationStatus(message); setTracking(tracker.current?.active ?? false); },
      });
    }).catch(error => { if (mounted) setError(error.message); });
    return () => { mounted = false; pendingRequest.current++; abort.current?.abort(); tracker.current?.stop(); };
  }, []);

  function clear() {
    request.current++; abort.current?.abort(); setBusy(false); setRoute(null); setAvailability(undefined); setError(''); setStatus('');
  }
  const router = campus?.router;
  const buildings = [...new Set(router?.rooms.map(buildingOf))].sort();
  const levels = router?.levels.filter(item => item.startsWith(building + '.')) ?? [];
  const rooms = locationRooms.filter(room => room.split(/\s+/)[0] === building.replace('ETH.', ''));

  async function findRoute(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!router) return;
    clear();
    const current = request.current;
    const controller = new AbortController(); abort.current = controller;
    setBusy(true); setStatus('Finding your way…');
    // Let the loading state paint before building the indoor routing grids.
    await new Promise(resolve => setTimeout(resolve, 30));
    if (current !== request.current) return;
    try {
      let start: string | Feature = from;
      if (useLocation) {
        if (!tracker.current?.active || !position || Date.now() - position.timestamp > 30000) throw new Error('Your location is out of date. Locate yourself again or choose a starting room.');
        start = router.locationStart(window.MapLocation.project(position.coords.longitude, position.coords.latitude), locationLevel);
      }
      const startRoom = router.findRoom(start);
      if (!startRoom) throw new Error('Choose a starting room from the suggestions, including its building.');
      let result: RouteResult | null;
      const progress = (done: number, total: number) => {
        if (current !== request.current) return false;
        setStatus(`Comparing routes · ${done + 1} of ${total}`); return true;
      };
      if (destination === 'room') result = router.route(start, to, mode);
      else {
        let candidates = router.rooms.filter(item => buildingOf(item) === buildingOf(startRoom));
        if (destination === 'toilet') candidates = candidates.filter(item => toilet === 'any' ? ["Men's Toilet", "Women's Toilet"].includes(item.attributes.USE_TYPE) : item.attributes.USE_TYPE === toilet);
        else {
          setStatus('Checking lecture room availability…');
          const response = await fetch(`/api/lecture-halls?building=${encodeURIComponent(buildingOf(startRoom))}`, { signal: controller.signal, cache: 'no-store' });
          if (response.status === 404) throw new Error('There are no bookable lecture halls in this building.');
          if (!response.ok) throw new Error('Lecture room schedules are unavailable. Please try again.');
          const schedules: Availability = await response.json();
          if (current !== request.current) return;
          setAvailability(schedules);
          const free = new Set(schedules.rooms.filter(item => item.status === 'free').map(item => item.name.replace(/\s/g, '').toUpperCase()));
          candidates = candidates.filter(item => item.attributes.USE_TYPE === 'Lecture Hall' && free.has(roomName(item).replace(/\s/g, '').toUpperCase()));
          if (!candidates.length) throw new Error('No mapped lecture room is confirmed free for the next 30 minutes in this building.');
        }
        if (!candidates.length) throw new Error('No matching toilets are mapped in this building.');
        result = await router.nearestRoom(start, candidates, mode, progress);
      }
      if (current !== request.current || !result) return;
      setRoute(result); setBuilding(buildingOf(result.start)); setLevel(result.segments[0].level); setSelected(undefined); setStatus('');
    } catch (error) {
      if (current === request.current) { setError(error instanceof Error ? error.message : 'Unable to find a route.'); setStatus(''); }
    } finally { if (current === request.current) setBusy(false); }
  }

  const hall = availability?.rooms.find(item => route && item.name.replace(/\s/g, '') === roomName(route.end).replace(/\s/g, ''));
  const time = (value: string) => new Date(value).toLocaleTimeString([], { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit' });
  const point: Point | undefined = position ? window.MapLocation.project(position.coords.longitude, position.coords.latitude) : undefined;

  return <main className="campus-page">
    <div className="campus-heading"><span className="campus-eyebrow"><MapIcon /> CAMPUS GUIDE</span><h1>A little help finding your way.</h1><p>Find a room, take a break, or discover a quiet place to study.</p></div>
    {!campus ? <div className="campus-card" role="status">{error || 'Getting the campus map ready…'}{error && <button onClick={() => window.location.reload()}>Try again</button>}</div> : <div className="campus-layout">
      <section className="campus-card campus-directions" aria-label="Plan your route">
        <h2>Where are you heading?</h2><p className="campus-muted">Directions inside your building.</p>
        <form onSubmit={findRoute}>
          <label>Starting point<input list="campus-rooms" value={useLocation ? 'My current location' : from} readOnly={useLocation} required={!useLocation} placeholder="e.g. HG E 26.1" onChange={event => { clear(); setFrom(event.target.value); }} /></label>
          <button className="campus-location-button" type="button" onClick={async () => {
            clear();
            if (useLocation) { setUseLocation(false); return; }
            setLocationLevel(level); setUseLocation(true);
            if (!tracker.current?.active) setTracking(await tracker.current!.start());
          }}><Crosshair />{useLocation ? 'Choose a room instead' : 'Use my location'}</button>
          {useLocation && <p className="campus-hint">Starting on {locationLevel.replace('ETH.', '').replace('.', ' · floor ')}. Select the building and floor you are on using the map controls.</p>}
          <label>Destination<select value={destination} onChange={event => { clear(); setDestination(event.target.value); }}><option value="room">A room</option><option value="toilet">Closest toilet</option><option value="lecture">Closest free lecture room</option></select></label>
          {destination === 'room' && <label>Room<input list="campus-rooms" value={to} required placeholder="e.g. HG F 5" onChange={event => { clear(); setTo(event.target.value); }} /></label>}
          {destination === 'toilet' && <label>Toilet preference<select value={toilet} onChange={event => { clear(); setToilet(event.target.value); }}><option value="any">Any toilet</option><option value="Women's Toilet">Women’s toilet</option><option value="Men's Toilet">Men’s toilet</option></select></label>}
          {destination === 'lecture' && <p className="campus-hint">We check ETH bookings for rooms free for at least the next 30 minutes.</p>}
          <label>How would you like to go?<select value={mode} onChange={event => { clear(); setMode(event.target.value); }}><option value="fastest">Fastest route</option><option value="stairs">Use stairs</option><option value="elevator">Use elevators</option></select></label>
          <datalist id="campus-rooms">{rooms.map(room => <option key={room} value={room} />)}</datalist>
          <button className="campus-primary" disabled={busy} type="submit">{busy ? 'Finding your route…' : 'Get directions'}<ArrowRight /></button>
          {(busy || route) && <button className="campus-text-button" type="button" onClick={clear}>{busy ? 'Cancel' : 'Clear directions'}</button>}
        </form>
        <div aria-live="polite">{status && <p className="campus-hint">{status}</p>}{error && <p className="campus-error" role="alert">{error}</p>}</div>
        {route && <section className="campus-route" aria-label="Your directions"><span className="campus-eyebrow">YOUR ROUTE</span><h3>{Math.max(1, Math.ceil(route.seconds / 60))} min <span>· {Math.round(route.distance)} m</span></h3><p>{roomName(route.start)} → {roomName(route.end)}</p><p className="campus-hint">{destination === 'toilet' ? `Closest reachable ${route.end.attributes.USE_TYPE} by travel time` : destination === 'lecture' ? 'Closest verified free lecture room by travel time' : 'Estimated walking time'}</p>
          {hall && <div className="campus-availability"><strong>{hall.freeForRestOfDay ? 'Free for the rest of today' : `Free until ${time(hall.freeUntil!)}`}</strong><small>Checked {time(availability!.checkedAt)} · free through {time(availability!.windowEndsAt)} (Zurich). Bookings do not confirm occupancy or door access.</small></div>}
          {availability?.rooms.some(item => item.status === 'unknown') && <p className="campus-hint">Rooms with unavailable schedules were excluded.</p>}
          <ol>{route.segments.map((segment, index) => <li key={`${segment.level}-${index}`}><button className={level === segment.level ? 'active' : ''} onClick={() => setLevel(segment.level)}>Floor {floorName(segment.level)}</button><span>{route.changes[index] ? `Walk to the ${route.changes[index].type.toLowerCase()} and continue to floor ${floorName(route.changes[index].to.attributes.LEVEL_ID)}.` : `Continue to ${roomName(route.end)}.`}</span></li>)}</ol>
        </section>}
      </section>
      <section className="campus-card campus-map-card" aria-label="Campus floor map">
        <div className="campus-map-toolbar"><label>Building<select value={building} onChange={event => { clear(); setBuilding(event.target.value); setLevel(router!.levels.find(item => item.startsWith(event.target.value + '.'))!); setLocationLevel(router!.levels.find(item => item.startsWith(event.target.value + '.'))!); setSelected(undefined); }} >{buildings.map(item => <option key={item} value={item}>{item.replace('ETH.', '')}</option>)}</select></label><label>Floor<select value={level} onChange={event => { if (useLocation) { clear(); setLocationLevel(event.target.value); } setLevel(event.target.value); setSelected(undefined); }}>{levels.map(item => <option key={item} value={item}>{floorName(item)}</option>)}</select></label><button type="button" className="campus-locate" onClick={async () => {
          if (tracking) { tracker.current?.stop(); setTracking(false); setPosition(undefined); setHeading(undefined); setUseLocation(false); setLocationStatus('Location tracking stopped.'); clear(); }
          else { setLocationLevel(level); setTracking(await tracker.current!.start()); }
        }}><GeoAlt />{tracking ? 'Stop locating' : 'Locate me'}</button></div>
        <FloorMap data={campus.data} router={router!} level={level} route={route} selected={selected} select={setSelected} position={tracking && level === locationLevel ? point : undefined} accuracy={position?.coords.accuracy} heading={heading} />
        {selected && <div className="campus-selection"><div><strong>{router!.label(selected)}</strong><small>{selected.attributes.USE_TYPE}</small></div><button onClick={() => { clear(); setUseLocation(false); setFrom(router!.label(selected)); }}>Start here</button><button onClick={() => { clear(); setDestination('room'); setTo(router!.label(selected)); }}>Go here</button><button aria-label="Close room selection" onClick={() => setSelected(undefined)}>×</button></div>}
        <div className="campus-map-caption"><span><i className="campus-dot room" />Rooms</span><span><i className="campus-dot toilet" />Toilets</span><span><i className="campus-dot stairs" />Stairs</span><span><i className="campus-dot elevator" />Elevators</span><span><i className="campus-dot path" />Your route</span><span>Scroll to zoom · drag to move</span></div>
        {locationStatus && <p className="campus-location-status" role="status">{locationStatus}</p>}
        <p className="campus-hint campus-map-note">Indoor GPS can be approximate. Choose a room if the blue dot is misplaced. Routes are estimates based on available floor plans; elevator routes do not guarantee accessibility.</p>
      </section>
    </div>}
  </main>;
}

function FloorMap({ data, router, level, route, selected, select, position, accuracy, heading }: { data: Dataset; router: Router; level: string; route: RouteResult | null; selected?: Feature; select: (room: Feature) => void; position?: Point; accuracy?: number; heading?: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [camera, setCamera] = useState<{ level: string; zoom: number; x: number; y: number }>({ level, zoom: 1, x: 0, y: 0 });
  const view = camera.level === level ? camera : { level, zoom: 1, x: 0, y: 0 };
  useEffect(() => {
    const map = svg.current;
    if (!map) return;
    // React's delegated wheel listener is passive; use a native listener so
    // zooming consumes the wheel gesture before the browser scrolls the page.
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!event.deltaY) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? map.clientHeight : 1);
      const factor = Math.exp(-Math.max(-100, Math.min(100, delta)) * 0.002);
      setCamera(previous => {
        const current = previous.level === level ? previous : { level, zoom: 1, x: 0, y: 0 };
        const zoom = Math.max(0.7, Math.min(10, current.zoom * factor));
        const matrix = map.getScreenCTM();
        if (!matrix) return { ...current, zoom };
        const anchor = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        const box = map.viewBox.baseVal;
        const ratio = current.zoom / zoom;
        return { level, zoom,
          x: current.x + (anchor.x - box.x - box.width / 2) * (1 - ratio),
          y: current.y + (anchor.y - box.y - box.height / 2) * (1 - ratio) };
      });
    };
    map.addEventListener('wheel', handleWheel, { passive: false });
    return () => map.removeEventListener('wheel', handleWheel);
  }, [level]);
  const shapes = data.layers.filter(layer => /^Units|^Details/.test(layer.name)).flatMap(layer => layer.features).filter(item => item.geometry && item.attributes.LEVEL_ID === level);
  const units = shapes.filter(item => item.geometry.type === 3);
  const bounds = units.reduce((b, item) => [Math.min(b[0], item.geometry.bounds[0]), Math.min(b[1], item.geometry.bounds[1]), Math.max(b[2], item.geometry.bounds[2]), Math.max(b[3], item.geometry.bounds[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  if (!units.length) return <p className="campus-empty">No floor plan is available for this floor.</p>;
  const width = (bounds[2] - bounds[0] + 16) / view.zoom;
  const height = (bounds[3] - bounds[1] + 16) / view.zoom;
  const cx = (bounds[0] + bounds[2]) / 2 + view.x, cy = -(bounds[1] + bounds[3]) / 2 + view.y;
  const path = (parts: Point[][], closed: boolean) => parts.map(part => part.map(([x, y], index) => `${index ? 'L' : 'M'}${x},${-y}`).join(' ') + (closed ? 'Z' : '')).join(' ');
  const zoom = (factor: number) => setCamera({ ...view, zoom: Math.max(0.7, Math.min(10, view.zoom * factor)) });
  const segments = route?.segments.filter(segment => segment.level === level) ?? [];
  return <div className="campus-map-viewport"><svg ref={svg} viewBox={`${cx - width / 2} ${cy - height / 2} ${width} ${height}`} role="img" aria-label={`Floor ${floorName(level)} map. Use room fields for keyboard directions.`}
    onPointerDown={event => { drag.current = { x: event.clientX, y: event.clientY, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event => {
      if (!drag.current || !svg.current) return;
      const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) < 3 && !drag.current.moved) return;
      const scale = svg.current.getScreenCTM()?.a || 1;
      setCamera({ ...view, x: view.x - dx / scale, y: view.y - dy / scale });
      drag.current = { x: event.clientX, y: event.clientY, moved: true };
    }}
    onPointerUp={event => {
      if (!drag.current?.moved && svg.current) {
        const matrix = svg.current.getScreenCTM();
        if (matrix) {
          const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
          const room = router.rooms.find(item => item.attributes.LEVEL_ID === level && window.HGRouting && inside([p.x, -p.y], item.geometry.parts));
          if (room) select(room);
        }
      }
      drag.current = null;
    }} onPointerCancel={() => { drag.current = null; }}>
    <g className="campus-floor-rooms">{units.map(item => <path key={item.id} d={path(item.geometry.parts, true)} fillRule="evenodd" className={`campus-shape ${shapeKind(item)} ${selected === item ? 'selected' : ''}`}><title>{router.label(item)} · {item.attributes.USE_TYPE}</title></path>)}</g>
    <g className="campus-floor-walls">{shapes.filter(item => item.geometry.type !== 3 && /^WAND/.test(item.attributes.USE_TYPE)).map(item => <path key={item.id} d={path(item.geometry.parts, false)} className="campus-shape wall" />)}</g>
    <g className={`campus-floor-doors ${view.zoom >= 1.6 ? 'visible' : ''}`}>{shapes.filter(item => item.attributes.USE_TYPE === 'TUER').map(item => <path key={item.id} d={path(item.geometry.parts, false)} className="campus-shape door" />)}</g>
    {units.filter(item => !['Hallway', 'Entrance and Exit', 'Common Room', 'Ramp', 'Exhibition', 'Service Room', 'Storage Room'].includes(item.attributes.USE_TYPE) && (item.geometry.bounds[2] - item.geometry.bounds[0]) > width / 28 && (item.geometry.bounds[3] - item.geometry.bounds[1]) > height / 90).map(item => <text key={item.id} x={(item.geometry.bounds[0] + item.geometry.bounds[2]) / 2} y={-(item.geometry.bounds[1] + item.geometry.bounds[3]) / 2} fontSize={Math.min(2.4, width / 85)} textAnchor="middle" dominantBaseline="middle" className={`campus-room-label ${shapeKind(item)}`}>{/Toilet/.test(item.attributes.USE_TYPE) ? 'WC' : item.attributes.USE_TYPE === 'Stairs' ? '↗' : item.attributes.USE_TYPE === 'Elevator' ? '↕' : item.attributes.Suchfeld1 || ''}</text>)}
    {segments.map((segment, index) => <g key={index}><path d={path([segment.points], false)} className="campus-route-line halo" /><path d={path([segment.points], false)} className="campus-route-line" /></g>)}
    {segments.flatMap((segment, index) => [segment.points[0], segment.points.at(-1)!].map((p, endpoint) => <circle key={`${index}-${endpoint}`} cx={p[0]} cy={-p[1]} r={width / 95} className="campus-route-end" />))}
    {position && <g transform={`translate(${position[0]} ${-position[1]})`}><circle r={Math.min(accuracy ?? 0, 100) * Math.cosh(position[1] / 6378137)} className="campus-accuracy" />{heading !== undefined && <path d={`M0,${-width / 22} l${width / 70},${width / 35} h${-width / 35} Z`} transform={`rotate(${heading})`} fill="#007bff" />}<circle r={width / 85} className="campus-position" /></g>}
  </svg><div className="campus-zoom"><button aria-label="Zoom in" onClick={() => zoom(1.3)}><Plus /></button><button aria-label="Zoom out" onClick={() => zoom(1 / 1.3)}><Dash /></button><button aria-label="Reset map view" onClick={() => setCamera({ level, zoom: 1, x: 0, y: 0 })}><Crosshair /></button></div></div>;
}
function shapeKind(item: Feature) {
  const kind = item.attributes.USE_TYPE;
  if (/Toilet/.test(kind)) return 'toilet';
  if (kind === 'Stairs') return 'stairs';
  if (kind === 'Elevator') return 'elevator';
  if (['Hallway', 'Entrance and Exit', 'Common Room', 'Ramp', 'Exhibition'].includes(kind)) return 'hallway';
  return 'room';
}
function inside(point: Point, parts: Point[][]) {
  let hit = false;
  for (const ring of parts) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
