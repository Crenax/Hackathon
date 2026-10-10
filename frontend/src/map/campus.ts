// These browser assets are shared with map/viewer. See public/campus/README.md.
export type Point = [number, number];
export interface Feature {
  id: string;
  attributes: Record<string, string>;
  geometry: { type: number; parts: Point[][]; bounds: [number, number, number, number] };
}
export interface Dataset { layers: { name: string; features: Feature[] }[] }
export interface RouteResult {
  start: Feature; end: Feature; seconds: number; distance: number;
  segments: { level: string; points: Point[] }[];
  changes: { type: string; from: Feature; to: Feature }[];
}
export interface Router {
  rooms: Feature[]; levels: string[];
  label: (room: Feature) => string;
  findRoom: (name: string | Feature) => Feature | undefined;
  locationStart: (point: Point, level: string) => Feature;
  route: (from: string | Feature, to: string, mode: string) => RouteResult;
  nearestRoom: (from: string | Feature, rooms: Feature[], mode: string, progress: (done: number, total: number) => boolean) => Promise<RouteResult | null>;
}
export interface Availability {
  checkedAt: string; windowEndsAt: string;
  rooms: { name: string; status: string; freeUntil: string | null; freeForRestOfDay: boolean }[];
}
interface Tracker { start: () => Promise<boolean>; stop: () => void; readonly active: boolean }
declare global {
  interface Window {
    ArcGISData: { normalize: (data: unknown) => Dataset };
    HGRouting: { create: (data: Dataset) => Router };
    MapLocation: {
      project: (longitude: number, latitude: number) => Point;
      tracker: (callbacks: { onPosition: (position: GeolocationPosition) => void; onHeading: (heading: number) => void; onStatus: (message: string) => void }) => Tracker;
    };
  }
}
let loading: Promise<{ data: Dataset; router: Router }> | undefined;
function script(name: string) {
  return new Promise<void>((resolve, reject) => {
    const element = document.createElement('script');
    element.src = `/campus/${name}.js`;
    element.onload = () => resolve();
    element.onerror = () => { element.remove(); reject(new Error('The map could not load. Please try again.')); };
    document.head.append(element);
  });
}
export function loadCampus() {
  return loading ??= (async () => {
    await Promise.all(['data', 'routing', 'location'].map(script));
    const response = await fetch('/campus/map.json');
    if (!response.ok) throw new Error('The map could not load. Please try again.');
    const data = window.ArcGISData.normalize(await response.json());
    return { data, router: window.HGRouting.create(data) };
  })().catch(error => { loading = undefined; throw error; });
}
export const buildingOf = (feature: Feature) => feature.attributes.LEVEL_ID.split('.').slice(0, -1).join('.');
export const floorName = (level: string) => level.split('.').at(-1);
export const roomName = (feature: Feature) => feature.attributes.NAME_LONG || feature.attributes.NAME;
