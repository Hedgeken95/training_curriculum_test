// 201 (1LDK) empty-unit walkthrough scene.
// Plan coordinates in metres: +X = east (right on the plan), +Z = south (down on the plan), +Y = up.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { N8AOPass } from 'n8ao';

const W = 1920, H = 1080;
const CH = 2.45;          // ceiling height (assumed)
const RAIL = 0.86;        // wainscot rail height seen in the photos
const params = new URLSearchParams(location.search);
// seeded RNG so every render worker builds the identical scene
let seed = 20261018;
const rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
document.getElementById('stage').prepend(renderer.domElement);
RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, W / H, 0.05, 400);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

// ---------- textures ----------
const loader = new THREE.TextureLoader();
const pending = [];
function tex(url, srgb = true) {
  let done; pending.push(new Promise(r => { done = r; }));
  const t = loader.load(url, done, undefined, e => { console.error('tex fail', url); done(); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const T = {
  floor: tex('tex/floor.jpg'),
  floorBump: tex('tex/floor_bump.png', false),
  wood: tex('tex/wood_dark.jpg'),
  concrete: tex('tex/concrete.jpg'),
  wallBump: tex('tex/wall_bump.png', false),
};
T.wood.wrapS = THREE.MirroredRepeatWrapping;

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 300mm grey porcelain tiles for the entrance / balcony
const tileTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#6f6c69'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const v = 120 + rand() * 14;
    g.fillStyle = `rgb(${v},${v - 3},${v - 7})`; g.fillRect(i * 256 + 3, j * 256 + 3, 250, 250);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${rand() < .5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(i * 256 + rand() * 250, j * 256 + rand() * 250, 2, 2); }
  }
});

// ---------- materials ----------
const M = {
  wallUp: new THREE.MeshStandardMaterial({ color: 0xf0eee9, roughness: 0.93, bumpMap: T.wallBump, bumpScale: 0.6 }),
  wallLow: new THREE.MeshStandardMaterial({ color: 0xf3f2ee, roughness: 0.88, bumpMap: T.wallBump, bumpScale: 0.4 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 0.55 }),
  cap: new THREE.MeshStandardMaterial({ color: 0x3d3c3a, roughness: 0.9 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 0.97 }),
  floor: new THREE.MeshStandardMaterial({ map: T.floor, color: 0xd8d2cc, roughness: 0.42, bumpMap: T.floorBump, bumpScale: 0.8, envMapIntensity: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ map: T.wood, color: 0x8a7a6e, roughness: 0.55 }),
  woodKitchen: new THREE.MeshStandardMaterial({ map: T.wood, color: 0xa89584, roughness: 0.5 }),
  concrete: new THREE.MeshStandardMaterial({ map: T.concrete, roughness: 0.85, color: 0xc8c6c2 }),
  whiteGloss: new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.28 }),
  whiteMatte: new THREE.MeshStandardMaterial({ color: 0xf2f1ee, roughness: 0.6 }),
  doorWhite: new THREE.MeshStandardMaterial({ color: 0xeeece7, roughness: 0.45 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xc8cacc, metalness: 0.8, roughness: 0.32 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x8e9194, metalness: 0.8, roughness: 0.38 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.12 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.35 }),
  blackGlass: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.08, metalness: 0.2 }),
  alu: new THREE.MeshStandardMaterial({ color: 0x9a9894, metalness: 0.7, roughness: 0.38 }),
  aluDark: new THREE.MeshStandardMaterial({ color: 0x4a4a4b, metalness: 0.6, roughness: 0.42 }),
  entryDoor: new THREE.MeshStandardMaterial({ color: 0x55534f, roughness: 0.5, metalness: 0.2 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xdfeef3, roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false }),
  tile: new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.6 }),
  wetFloor: new THREE.MeshStandardMaterial({ color: 0xd6d4cf, roughness: 0.7 }),
  porcelain: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.02 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.4 }),
  slab: new THREE.MeshStandardMaterial({ color: 0xbdbab5, roughness: 0.9 }),
  emissive: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 2.5 }),
};

// ---------- geometry helpers ----------
const G = {
  ceiling: new THREE.Group(), walk: new THREE.Group(), over: new THREE.Group(), doors: new THREE.Group(),
};
Object.values(G).forEach(g => scene.add(g));

// Axis-aligned box from extents, with world-space planar UVs (uScale/vScale in repeats per metre).
function box(x0, x1, y0, y1, z0, z1, mat, o = {}) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const su = o.su ?? 1, sv = o.sv ?? 1;
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    let u, v;
    if (nx > 0.5) { u = p.getZ(i); v = p.getY(i); }
    else if (ny > 0.5) { if (o.floor) { u = p.getZ(i); v = p.getX(i); } else { u = p.getX(i); v = p.getZ(i); } }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u * su + (o.ou ?? 0), v * sv + (o.ov ?? 0));
  }
  const m = new THREE.Mesh(g, mat);
  m.castShadow = o.cast ?? true; m.receiveShadow = true;
  (o.parent ?? G.walk).add(m);
  return m;
}
const WALL_BOTTOM = -0.12;
const wallUV = { su: 2, sv: 2 };

// Wall from plan extents. openings: {a, b, y0, y1, trim} along the long axis.
function wall(x0, x1, z0, z1, openings = []) {
  const alongX = (x1 - x0) >= (z1 - z0);
  const L0 = alongX ? x0 : z0, L1 = alongX ? x1 : z1;
  const seg = (a, b, ya, yb) => {
    if (b - a < 1e-4 || yb - ya < 1e-4) return;
    const mk = (y0, y1, mat, grow = 0) => alongX
      ? box(a, b, y0, y1, z0 - grow, z1 + grow, mat, wallUV)
      : box(x0 - grow, x1 + grow, y0, y1, a, b, mat, wallUV);
    if (ya < RAIL) mk(ya, Math.min(yb, RAIL), M.wallLow);
    if (yb > RAIL) mk(Math.max(ya, RAIL), yb, M.wallUp);
    if (ya <= 0.001) mk(0, 0.06, M.trim, 0.012);
    if (ya < RAIL && yb > RAIL + 0.02) mk(RAIL - 0.008, RAIL + 0.008, M.trim, 0.007);
    if (yb >= CH - 1e-3) {
      const c = alongX ? box(a, b, CH, CH + 0.01, z0, z1, M.cap, { parent: G.over, cast: false })
                       : box(x0, x1, CH, CH + 0.01, a, b, M.cap, { parent: G.over, cast: false });
    }
  };
  let cur = L0;
  for (const o of [...openings].sort((p, q) => p.a - q.a)) {
    seg(cur, o.a, WALL_BOTTOM, CH);
    if (o.y0 > WALL_BOTTOM + 1e-3) seg(o.a, o.b, WALL_BOTTOM, o.y0);
    seg(o.a, o.b, o.y1, CH);
    if (o.trim) { // white door casing lining the opening
      const t = 0.02, g = 0.012;
      if (alongX) {
        box(o.a, o.a + t, Math.max(o.y0, 0), o.y1, z0 - g, z1 + g, M.trim);
        box(o.b - t, o.b, Math.max(o.y0, 0), o.y1, z0 - g, z1 + g, M.trim);
        box(o.a, o.b, o.y1 - t, o.y1, z0 - g, z1 + g, M.trim);
      } else {
        box(x0 - g, x1 + g, Math.max(o.y0, 0), o.y1, o.a, o.a + t, M.trim);
        box(x0 - g, x1 + g, Math.max(o.y0, 0), o.y1, o.b - t, o.b, M.trim);
        box(x0 - g, x1 + g, o.y1 - t, o.y1, o.a, o.b, M.trim);
      }
    }
    cur = o.b;
  }
  seg(cur, L1, WALL_BOTTOM, CH);
}

// ---------- shell ----------
// exterior north wall: bedroom window, small LDK window
wall(0.02, 11.38, -0.18, 0.00, [
  { a: 2.65, b: 3.65, y0: 0.90, y1: 2.05 },
  { a: 8.35, b: 8.85, y0: 1.55, y1: 2.20 },
]);
wall(0.02, 0.20, 0.00, 2.18);                                             // west (WIC / toilet)
wall(0.32, 0.50, 2.18, 3.88, [{ a: 2.75, b: 3.65, y0: -0.10, y1: 2.10 }]); // west (entrance door)
wall(0.20, 0.50, 2.18, 2.30);
wall(0.20, 2.18, 1.23, 1.35);                                             // WIC | toilet
wall(0.20, 2.30, 2.18, 2.30, [{ a: 1.45, b: 2.05, y0: 0, y1: 2.0, trim: true }]); // toilet | hall
wall(2.18, 2.30, 0.00, 2.86, [{ a: 0.12, b: 0.92, y0: 0, y1: 2.25, trim: true }]); // bedroom | WIC
wall(2.18, 5.20, 2.74, 2.86);                                             // bedroom | corridor
wall(5.08, 5.20, 0.00, 2.86, [{ a: 0.65, b: 2.45, y0: 0, y1: 2.30 }]);     // bedroom | LDK (sliding pair)
wall(0.50, 5.50, 3.76, 3.88, [{ a: 2.45, b: 3.25, y0: 0, y1: 2.0, trim: true }]); // corridor | washroom
wall(4.30, 4.42, 2.86, 3.76, [{ a: 2.93, b: 3.70, y0: 0, y1: 2.05, trim: true }]); // corridor | LDK door
wall(6.25, 8.20, 2.40, 2.52);                                             // kitchen wall
wall(8.20, 8.32, 2.40, 4.52);                                             // kitchen east
wall(8.20, 11.20, 2.40, 2.60);                                            // LDK | unit 202
wall(11.00, 11.20, -0.18, 2.60, [{ a: 0.55, b: 2.25, y0: 0, y1: 2.05 }]);  // east, balcony door
wall(5.38, 5.50, 3.88, 5.58);                                             // bath | kitchen back
wall(5.38, 8.32, 4.40, 4.52);                                             // kitchen back south
wall(0.32, 5.50, 5.40, 5.58);                                             // south exterior
wall(0.32, 0.50, 3.88, 5.58);
wall(1.58, 1.70, 3.88, 5.40);                                             // PS | washroom
wall(3.55, 3.67, 3.88, 5.40);                                             // washroom | bath

// columns
box(10.72, 11.00, 0, CH, 0.00, 0.55, M.wallUp, wallUV);
box(10.72, 11.00, 0, 0.06, 0.00, 0.562, M.trim);

// floors (planks run east-west everywhere, as in the photos)
const fl = (x0, x1, z0, z1, y = 0, mat = M.floor) =>
  box(x0, x1, y - 0.03, y, z0, z1, mat, mat === M.floor ? { su: 1 / 3, sv: 1 / 3, floor: true, cast: false } : { su: 1 / 0.6, sv: 1 / 0.6, cast: false });
fl(0.20, 2.18, 0.00, 1.23);   // WIC
fl(0.20, 2.18, 1.35, 2.18);   // toilet
fl(1.35, 4.42, 2.30, 3.76);   // hall + corridor
fl(2.18, 5.08, 0.00, 2.74);   // bedroom
fl(5.08, 11.00, 0.00, 2.40);  // LDK
fl(4.42, 8.20, 2.40, 3.76);   // kitchen
fl(5.50, 8.20, 3.76, 4.40);   // kitchen back
fl(0.50, 1.35, 2.30, 3.76, -0.10, M.tile); // genkan
fl(1.70, 3.55, 3.88, 5.40, 0, M.wetFloor);
fl(3.67, 5.38, 3.88, 5.40, 0, M.wetFloor);
fl(0.50, 1.58, 3.88, 5.40, 0, M.wetFloor);
box(1.31, 1.37, -0.10, 0.005, 2.30, 3.76, M.wood, { su: 1 / 0.86, sv: 1 / 2.3 }); // step edge (agari-kamachi)

// ceiling + soffit along the LDK south wall
box(-0.2, 11.4, CH, CH + 0.06, -0.2, 5.6, M.ceiling, { parent: G.ceiling });
box(6.25, 11.0, CH - 0.20, CH, 2.02, 2.40, M.ceiling, { parent: G.ceiling });
const downlights = [
  [6.0, 1.0], [7.6, 1.2], [9.3, 1.2], [6.9, 2.21], [8.6, 2.21], [10.2, 2.21],
  [5.6, 3.3], [7.2, 3.6], [1.0, 3.0], [1.9, 3.3], [3.0, 3.31], [3.9, 3.31], [1.2, 0.6], [3.7, 1.4],
];
for (const [x, z] of downlights) {
  const y = (z > 2.0 && z < 2.4 && x > 6.25) ? CH - 0.20 : CH;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.006, 24), M.emissive);
  m.position.set(x, y - 0.003, z); G.ceiling.add(m);
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.006, 6, 24), M.trim);
  r.rotation.x = Math.PI / 2; r.position.set(x, y - 0.004, z); G.ceiling.add(r);
}
// 24h ventilation grilles
for (const [x, z] of [[7.1, 1.6], [4.0, 0.9], [3.6, 3.3]]) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 32), M.plate);
  m.position.set(x, CH - 0.006, z); G.ceiling.add(m);
}

// ---------- windows ----------
function windowZ(x0, x1, zFace, y0, y1, mullion = false) { // window in a wall running along X
  const t = 0.035, d0 = zFace - 0.07, d1 = zFace - 0.03;
  box(x0, x1, y0, y0 + t, d0, d1, M.alu); box(x0, x1, y1 - t, y1, d0, d1, M.alu);
  box(x0, x0 + t, y0, y1, d0, d1, M.alu); box(x1 - t, x1, y0, y1, d0, d1, M.alu);
  if (mullion) box((x0 + x1) / 2 - 0.02, (x0 + x1) / 2 + 0.02, y0, y1, d0 - 0.02, d1, M.alu);
  box(x0, x1, y0, y1, d0 + 0.015, d0 + 0.02, M.glass, { cast: false });
  box(x0 - 0.01, x1 + 0.01, y0 - 0.02, y0, zFace - 0.18, zFace + 0.02, M.trim); // sill
}
windowZ(2.65, 3.65, 0.0, 0.90, 2.05, true);
windowZ(8.35, 8.85, 0.0, 1.55, 2.20);
{ // balcony sliding door on the east wall
  const x0 = 11.03, x1 = 11.09, z0 = 0.55, z1 = 2.25, y0 = 0, y1 = 2.05, t = 0.04;
  box(x0, x1, y0, y0 + 0.03, z0, z1, M.alu); box(x0, x1, y1 - t, y1, z0, z1, M.alu);
  box(x0, x1, y0, y1, z0, z0 + t, M.alu); box(x0, x1, y0, y1, z1 - t, z1, M.alu);
  const zm = (z0 + z1) / 2;
  box(x0 - 0.01, x1, y0, y1, zm - 0.03, zm + 0.03, M.alu);
  box(x0 + 0.02, x0 + 0.025, y0, y1, z0, z1, M.glass, { cast: false });
}

// ---------- doors ----------
// bedroom <-> LDK bypass sliding pair (dark woodgrain, as photographed)
const doorUV = { su: 1 / 0.86, sv: 1 / 2.3 };
function slidingPanel(x0, x1, z0, z1, y1, handleSide) {
  const g = new THREE.Group();
  const m = box(x0, x1, 0.01, y1, z0, z1, M.wood, { ...doorUV, parent: g });
  for (const xf of [x0 - 0.002, x1 + 0.002]) { // recessed pulls on both faces
    const hz = handleSide < 0 ? z0 + 0.07 : z1 - 0.07;
    box(Math.min(xf, xf) - 0.001, xf + 0.001, 0.92, 1.08, hz - 0.016, hz + 0.016, M.alu, { parent: g });
  }
  G.doors.add(g);
  return g;
}
const bedA = slidingPanel(5.105, 5.14, 0.65, 1.60, 2.29, -1);
const bedB = slidingPanel(5.145, 5.18, 1.50, 2.45, 2.29, +1);
box(5.08, 5.20, 2.29, 2.30, 0.65, 2.45, M.alu);
const BED_B_SLIDE = -0.80;

// WIC: outset sliding door on the bedroom side with a pet door, rail above
{
  const g = new THREE.Group();
  box(2.305, 2.34, 0.01, 2.26, 0.80, 1.75, M.wood, { ...doorUV, parent: g });
  box(2.300, 2.345, 0.05, 0.32, 0.86, 1.08, M.black, { parent: g });         // pet flap
  box(2.299, 2.346, 0.04, 0.33, 0.85, 1.09, M.aluDark, { parent: g });
  box(2.299, 2.346, 0.06, 0.31, 0.87, 1.07, M.blackGlass, { parent: g });
  box(2.341, 2.345, 0.95, 1.10, 0.83, 0.86, M.alu, { parent: g });            // pull
  box(2.341, 2.345, 1.62, 1.66, 1.08, 1.13, M.chrome, { parent: g });         // lock indicator
  G.doors.add(g);
  box(2.30, 2.35, 2.26, 2.31, 0.08, 1.80, M.alu);
}
// toilet door (closed), washroom sliding door (closed), entrance door, LDK door (open)
box(1.47, 2.03, 0.01, 1.98, 2.225, 2.255, M.doorWhite);
box(1.95, 1.97, 0.95, 1.10, 2.20, 2.28, M.alu);
box(2.47, 3.23, 0.01, 1.98, 3.80, 3.84, M.doorWhite);
box(3.15, 3.18, 0.90, 1.10, 3.795, 3.845, M.aluDark);
box(0.33, 0.37, -0.10, 2.08, 2.77, 3.63, M.entryDoor);
box(0.37, 0.40, 0.95, 0.98, 3.42, 3.57, M.chrome); box(0.37, 0.40, 0.90, 1.0, 3.53, 3.56, M.chrome);
box(0.37, 0.375, 1.48, 1.50, 3.19, 3.21, M.black);
box(4.42, 5.19, 0.01, 2.03, 3.655, 3.69, M.doorWhite);   // LDK door, swung fully open
box(5.12, 5.16, 0.98, 1.0, 3.62, 3.655, M.chrome); box(5.15, 5.17, 0.94, 1.0, 3.62, 3.65, M.chrome);
box(4.97, 5.10, 1.0, 1.4, 3.72, 3.725, M.glass, { cast: false });

// ---------- LDK north wall fittings (photo 1) ----------
box(5.20, 5.75, 0, 2.30, 0.00, 0.55, M.whiteGloss);                 // tall white cupboard
box(5.473, 5.477, 0.08, 2.28, 0.549, 0.553, M.steelDark);
box(5.20, 5.75, 2.30, CH, 0.00, 0.50, M.wallUp);
box(5.75, 7.90, 0.72, 0.75, 0.00, 0.50, M.wood, { su: 1 / 2.3, sv: 1 / 0.86 }); // desk top
box(5.75, 6.30, 0.00, 0.72, 0.00, 0.47, M.whiteGloss);
box(5.75, 7.30, 1.55, 2.35, 0.00, 0.35, M.wood, doorUV);            // upper cupboard
box(6.520, 6.525, 1.57, 2.33, 0.35, 0.352, M.black);
box(7.30, 7.90, 1.38, 1.41, 0.00, 0.28, M.woodKitchen, doorUV);       // open shelf
box(7.90, 8.20, 0, CH, 0.00, 0.62, M.concrete, { su: 1 / 1.2, sv: 1 / 1.2 }); // concrete-look column
box(8.20, 9.10, 0, 1.00, 0.00, 0.28, M.wallLow, wallUV);            // low ledge
box(8.19, 9.11, 1.00, 1.025, 0.00, 0.30, M.whiteMatte);
box(8.20, 9.10, 0, 0.06, 0.28, 0.292, M.trim);
box(9.70, 9.96, 2.02, 2.24, 0.00, 0.07, M.plate);                   // ventilation unit
// switch plates / outlets
const plateZ = (x, y, z, s = 1) => box(x - 0.035 * s, x + 0.035 * s, y - 0.06 * s, y + 0.06 * s, z, z + 0.008, M.plate);
const plateX = (x, y, z, s = 1) => box(x, x + 0.008, y - 0.06 * s, y + 0.06 * s, z - 0.035 * s, z + 0.035 * s, M.plate);
plateX(5.20, 1.2, 0.58); plateX(5.20, 0.25, 0.60, 0.7); plateZ(10.3, 0.25, 0.0, 0.7);
plateX(5.072, 1.25, 2.58); plateX(5.072, 1.05, 2.58);   // bedroom remote + switch beside the doors (photo 3)
plateX(4.29, 1.2, 2.95 - 0.12); plateZ(2.6, 0.25, 0.0, 0.7);

// ---------- kitchen (photo 4) ----------
box(6.25, 8.20, 0.08, 0.85, 2.52, 3.17, M.woodKitchen, doorUV);
box(6.27, 8.20, 0.00, 0.08, 2.52, 3.12, M.black);
box(6.25, 8.20, 0.85, 0.88, 2.52, 3.20, M.steel);
box(6.55, 7.25, 0.86, 0.882, 2.66, 3.06, M.steelDark);
box(6.60, 7.20, 0.861, 0.884, 2.70, 3.02, new THREE.MeshStandardMaterial({ color: 0x6c6f72, metalness: 0.9, roughness: 0.3 }));
{
  const f = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.32, 16), M.chrome);
  f.position.set(6.9, 1.04, 2.60); f.castShadow = true; G.walk.add(f);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 16), M.chrome);
  s.rotation.x = Math.PI / 2; s.position.set(6.9, 1.19, 2.70); G.walk.add(s);
}
box(7.45, 8.05, 0.88, 0.886, 2.62, 3.10, M.blackGlass);
box(6.25, 8.20, 0.88, CH, 2.52, 2.535, M.whiteGloss);            // kitchen panel
box(7.40, 8.15, 1.83, 2.05, 2.535, 3.07, M.black);                 // range hood
box(7.55, 8.00, 2.05, CH, 2.535, 2.86, M.black);
box(6.25, 7.45, 0.00, 0.85, 3.95, 4.40, M.whiteGloss);             // back counter
box(6.24, 7.46, 0.85, 0.88, 3.93, 4.40, M.steel);
plateZ(7.8, 1.1, 4.392, 0.8);

// ---------- entrance / WIC / wet areas (simple fittings) ----------
box(0.52, 1.30, -0.10, 0.84, 2.30, 2.68, M.whiteGloss);           // shoe cabinet
box(0.52, 1.30, 0.84, 0.87, 2.30, 2.70, M.wood, { su: 1 / 2.3, sv: 1 / 0.86 });
box(0.20, 0.215, 1.72, 1.76, 0.35, 0.95, M.trim);                 // WIC hook rail (photo 5)
for (const z of [0.45, 0.65, 0.85]) box(0.215, 0.26, 1.68, 1.74, z - 0.012, z + 0.012, M.trim);
box(0.20, 2.18, 1.86, 1.885, 0.00, 0.36, M.whiteMatte);           // WIC shelf
{
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.60, 12), M.chrome);
  p.rotation.z = Math.PI / 2; p.position.set(1.25, 1.76, 0.30); p.castShadow = true; G.walk.add(p);
}
// toilet
box(0.25, 0.47, 0.42, 0.95, 1.55, 2.00, M.porcelain);
box(0.47, 0.95, 0.00, 0.42, 1.60, 1.95, M.porcelain);
// washroom: vanity + mirror + laundry pan
box(1.72, 2.30, 0.00, 0.85, 3.95, 4.70, M.whiteGloss);
box(1.70, 1.71, 1.05, 1.90, 4.00, 4.65, M.mirror);
box(1.72, 2.40, 0.00, 0.10, 4.78, 5.38, M.porcelain);
// bathtub + bath glass door
box(3.70, 5.36, 0.00, 0.55, 4.62, 5.38, M.porcelain);
box(3.67, 5.38, 0, 2.10, 3.88, 3.885, M.wallUp);

// ---------- balcony + outdoor ----------
box(11.20, 12.90, -0.25, -0.02, -0.18, 4.60, M.slab, { cast: false });
box(11.20, 12.90, -0.02, 0.0, -0.18, 4.60, M.tile, { su: 1 / 0.6, sv: 1 / 0.6, cast: false });
box(12.84, 12.87, 0.12, 1.08, -0.18, 4.60, new THREE.MeshStandardMaterial({ color: 0xdfe5e8, roughness: 0.35, transparent: true, opacity: 0.55 }), { cast: false }); // frosted railing
box(12.80, 12.92, 1.08, 1.12, -0.18, 4.60, M.alu);
box(12.82, 12.90, 0.0, 0.12, -0.18, 4.60, M.slab);
for (const z of [-0.1, 1.1, 2.3, 3.5, 4.5]) box(12.83, 12.89, 0.0, 1.10, z - 0.03, z + 0.03, M.alu);
box(11.20, 12.90, 0, 2.0, 2.56, 2.60, M.whiteMatte);               // privacy partition to 202
const outdoor = new THREE.Group(); G.walk.add(outdoor);
box(11.20, 12.90, 2.75, 2.95, -0.18, 4.60, M.slab, { cast: false, parent: outdoor }); // balcony above (3F)
{
  const skyGeo = new THREE.SphereGeometry(300, 32, 16);
  const cols = []; const p = skyGeo.attributes.position;
  const top = new THREE.Color(0x8fb4d8), hor = new THREE.Color(0xeaf0f2);
  for (let i = 0; i < p.count; i++) { const k = Math.max(0, p.getY(i) / 300); cols.push(...hor.clone().lerp(top, Math.pow(k, 0.6)).multiplyScalar(1.6).toArray()); }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  outdoor.add(sky);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x9c9a95, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -3.2; ground.receiveShadow = true; outdoor.add(ground);
  const bm = new THREE.MeshStandardMaterial({ color: 0xd9d5cf, roughness: 0.9 });
  const rnd = (a, b) => a + rand() * (b - a);
  for (let i = 0; i < 14; i++) {
    const w = rnd(6, 14), d = rnd(6, 12), h = rnd(5, 16);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bm.clone());
    m.material.color.offsetHSL(0, 0, rnd(-0.12, 0.05));
    m.position.set(rnd(26, 70), -3.2 + h / 2, rnd(-40, 40) + (i % 2 ? 0 : 6)); outdoor.add(m);
  }
  for (let i = 0; i < 8; i++) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(rnd(1.8, 3), 12, 10), new THREE.MeshStandardMaterial({ color: 0x6f8a5c, roughness: 1 }));
    t.scale.setScalar(0.7); t.position.set(rnd(24, 32), rnd(-2.0, -0.5), rnd(-20, 22)); outdoor.add(t);
  }
}

// overview plinth
{
  const bm = new THREE.MeshStandardMaterial({ color: 0xd2cec8, roughness: 0.9 });
  box(-0.06, 5.62, -0.62, -0.12, -0.26, 5.66, bm, { parent: G.over });
  box(5.62, 8.38, -0.62, -0.12, -0.26, 4.58, bm, { parent: G.over });
  box(8.38, 11.26, -0.62, -0.12, -0.26, 2.66, bm, { parent: G.over });
  box(11.20, 12.90, -0.62, -0.25, -0.18, 4.60, bm, { parent: G.over });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0xeceae6, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.62; ground.receiveShadow = true; G.over.add(ground);
  box(12.82, 12.90, 0.0, 1.10, -0.18, 4.60, M.aluDark, { parent: G.over }).visible = false;
}

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0xd8cdbf, 0.3); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0dc, 4.2);
sun.position.set(5.7 + 14, 8.0, 2.6 - 2.5); sun.target.position.set(5.7, 0, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
scene.add(sun, sun.target);

const interior = new THREE.Group(); scene.add(interior);
const winLight = (w, h, x, y, z, lookX, lookY, lookZ, I) => {
  const l = new THREE.RectAreaLight(0xeef4ff, I, w, h); l.position.set(x, y, z); l.lookAt(lookX, lookY, lookZ); interior.add(l);
};
winLight(1.7, 2.0, 10.95, 1.05, 1.40, 0, 1.05, 1.40, 5.5);
winLight(1.0, 1.15, 3.15, 1.48, 0.05, 3.15, 1.48, 5, 4.0);
winLight(0.5, 0.65, 8.6, 1.88, 0.05, 8.6, 1.88, 5, 3.0);
const pl = (x, y, z, I, d = 4.0) => { const l = new THREE.PointLight(0xfff1dd, I, d, 2); l.position.set(x, y, z); interior.add(l); };
pl(6.3, 2.2, 1.1, 1.6); pl(8.6, 2.2, 1.2, 1.6); pl(10.0, 2.1, 1.3, 1.4);
pl(7.0, 2.2, 3.4, 1.4, 3.0); pl(1.4, 2.2, 3.0, 1.2, 3.0); pl(3.3, 2.2, 3.31, 1.2, 2.6);
pl(3.6, 2.2, 1.35, 1.6, 3.4); pl(1.2, 2.2, 0.6, 0.8, 1.8);

// ---------- post-processing ----------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 0 }));
const aoPass = new N8AOPass(scene, camera, W, H);
Object.assign(aoPass.configuration, { aoRadius: 1.0, distanceFalloff: 1.0, intensity: 3.6, aoSamples: 16, denoiseSamples: 8, denoiseRadius: 12, halfRes: false });
composer.addPass(aoPass);
composer.addPass(new SMAAPass(W, H));
composer.addPass(new OutputPass());

// ---------- modes ----------
function setMode(mode) {
  const over = mode === 'over';
  G.ceiling.visible = !over;
  G.over.visible = over;
  outdoor.visible = !over;
  interior.visible = !over;
  scene.background = over ? new THREE.Color(0xeceae6) : null;
  hemi.intensity = over ? 0.7 : 0.3;
  scene.environmentIntensity = over ? 0.45 : 0.32;
  sun.intensity = over ? 2.4 : 6.5;
  if (over) { sun.position.set(5.7 + 6, 14, 2.6 + 8); camera.fov = 32; aoPass.configuration.aoRadius = 1.4; }
  else { sun.position.set(5.7 + 14, 8.0, 2.6 - 2.5); camera.fov = 64; aoPass.configuration.aoRadius = 0.9; }
  camera.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate = true;
}

// ---------- camera paths ----------
// keyframes: [t, x, y, z, yawDeg, pitchDeg]; yaw 0 = east, 90 = south, -90 = north, ±180 = west
const WALK = [
  [0.0, 0.78, 1.28, 3.28, 0, -5],
  [2.6, 1.55, 1.36, 3.31, 0, -4],
  [6.0, 3.30, 1.38, 3.31, 0, -4],
  [8.6, 4.65, 1.40, 3.28, -8, -5],
  [11.0, 5.25, 1.42, 3.36, -6, -8],
  [13.6, 5.78, 1.43, 2.85, -70, -4],
  [16.0, 6.45, 1.45, 1.70, -6, -3],
  [19.6, 8.55, 1.45, 1.40, 0, -4],
  [22.4, 9.75, 1.45, 1.45, -88, -3],
  [25.4, 9.70, 1.45, 1.60, -172, -4],
  [27.6, 8.40, 1.45, 1.75, -178, -4],
  [30.2, 6.30, 1.45, 2.00, -180, -4],
  [32.2, 5.10, 1.45, 2.02, -180, -4],
  [34.4, 4.25, 1.45, 1.80, -150, -4],
  [36.8, 3.85, 1.43, 1.55, -112, -3],
  [39.4, 4.30, 1.42, 1.25, -172, -6],
  [42.0, 3.95, 1.40, 1.05, -176, -7],
  [44.0, 3.85, 1.40, 1.00, -177, -7],
];
const WALK_LEN = 44.0;
const OVER_LEN = 12.0;
const CENTER = new THREE.Vector3(6.2, 0, 2.6);

function hermite(keys, t, idx) {
  if (t <= keys[0][0]) return keys[0][idx];
  const n = keys.length;
  if (t >= keys[n - 1][0]) return keys[n - 1][idx];
  let i = 0; while (keys[i + 1][0] < t) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const tan = j => (j <= 0 || j >= n - 1) ? 0 : (keys[j + 1][idx] - keys[j - 1][idx]) / (keys[j + 1][0] - keys[j - 1][0]);
  const h = k1[0] - k0[0], s = (t - k0[0]) / h;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * k0[idx] + (s3 - 2 * s2 + s) * h * tan(i) + (-2 * s3 + 3 * s2) * k1[idx] + (s3 - s2) * h * tan(i + 1);
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- overlay ----------
const $ = s => document.querySelector(s);
const TAGS = [
  ['LDK', '13.9帖', 8.3, 0.3, 1.2], ['洋室', '5.0帖', 3.65, 0.3, 1.35], ['WIC', '', 1.2, 0.3, 0.6],
  ['キッチン', '', 7.0, 0.95, 3.75], ['玄関', '', 0.9, 0.3, 3.05], ['洗面室', '', 2.6, 0.3, 4.65],
  ['浴室', '', 4.5, 0.6, 4.4], ['トイレ', '', 1.25, 0.6, 1.75], ['バルコニー', '', 12.05, 0.3, 1.2],
];
const tagEls = TAGS.map(([n, s]) => {
  const d = document.createElement('div'); d.className = 'tag'; d.innerHTML = n + (s ? `<small>${s}</small>` : '');
  $('#tags').appendChild(d); return d;
});
const CAPTIONS = [
  [0.4, 7.4, '玄関・廊下', '玄関から LDK へまっすぐ続く動線'],
  [8.4, 14.6, 'キッチン', 'LDK 入口すぐの壁付けキッチン'],
  [15.6, 29.6, 'LDK', '約13.9帖・バルコニーに面した東向き開口'],
  [32.0, 41.0, '洋室', '約5.0帖・ウォークインクローゼット付き'],
];

function overlay(shot, t) {
  const showTitle = shot === 'over';
  $('#title').style.opacity = showTitle ? smooth(0.3, 1.3, t) * (1 - smooth(OVER_LEN - 1.6, OVER_LEN - 0.8, t)) : 0;
  const tagA = shot === 'over' ? smooth(1.4, 2.4, t) * (1 - smooth(OVER_LEN - 1.8, OVER_LEN - 1.0, t)) : 0;
  const v = new THREE.Vector3();
  TAGS.forEach((tg, i) => {
    v.set(tg[2], tg[3], tg[4]).project(camera);
    const el = tagEls[i];
    el.style.left = ((v.x + 1) / 2 * W) + 'px'; el.style.top = ((1 - v.y) / 2 * H) + 'px';
    el.style.opacity = tagA * smooth(1.4 + i * 0.08, 2.0 + i * 0.08, t);
  });
  const cap = shot === 'walk' ? CAPTIONS.find(c => t >= c[0] - 0.2 && t <= c[1] + 0.6) : null;
  $('#caption').style.opacity = cap ? smooth(cap[0], cap[0] + 0.6, t) * (1 - smooth(cap[1], cap[1] + 0.6, t)) : 0;
  if (cap) { $('#caption .room').textContent = cap[2]; $('#caption .size').textContent = cap[3]; }
  $('#note').style.opacity = shot === 'walk' ? (1 - smooth(WALK_LEN - 2.4, WALK_LEN - 1.6, t)) : 0;
  const endA = shot === 'walk' ? smooth(WALK_LEN - 2.2, WALK_LEN - 0.9, t) : 0;
  $('#fade').style.opacity = endA * 0.94;
  $('#endcard').style.opacity = shot === 'walk' ? smooth(WALK_LEN - 1.6, WALK_LEN - 0.6, t) : 0;
}

// ---------- frame API ----------
let lastMode = null, lastSlide = null;
function poseWalk(t) {
  const x = hermite(WALK, t, 1), y = hermite(WALK, t, 2), z = hermite(WALK, t, 3);
  const yaw = THREE.MathUtils.degToRad(hermite(WALK, t, 4)), pitch = THREE.MathUtils.degToRad(hermite(WALK, t, 5));
  camera.position.set(x, y, z);
  camera.lookAt(x + Math.cos(yaw) * Math.cos(pitch), y + Math.sin(pitch), z + Math.sin(yaw) * Math.cos(pitch));
  const slide = BED_B_SLIDE * smooth(26.6, 29.4, t);
  if (slide !== lastSlide) { bedB.position.z = slide; renderer.shadowMap.needsUpdate = true; lastSlide = slide; }
}
function poseOver(t) {
  const k = t / OVER_LEN;
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const ang = THREE.MathUtils.degToRad(115 - 60 * e);
  const R = 12.0 - 1.4 * e, h = 20.0 - 2.0 * e;
  camera.position.set(CENTER.x + R * Math.cos(ang), h, CENTER.z + R * Math.sin(ang));
  camera.lookAt(CENTER.x, 0.9 + 0.3 * e, CENTER.z);
  if (lastSlide !== 0) { bedB.position.z = 0; renderer.shadowMap.needsUpdate = true; lastSlide = 0; }
}
window.renderAt = (shot, t) => {
  if (shot !== lastMode) { setMode(shot); lastMode = shot; }
  if (shot === 'over') poseOver(t); else poseWalk(t);
  camera.updateMatrixWorld();
  overlay(shot, t);
  composer.render();
  return true;
};
window.checkPath = () => {
  const boxes = [];
  G.walk.children.filter(o => o !== outdoor).forEach(o => o.traverse(m => { if (m.isMesh) { const b = new THREE.Box3().setFromObject(m); if (b.max.y > 0.3 && b.min.y < 2.0) boxes.push(b); } }));
  G.doors.traverse(o => { if (o.isMesh) { const b = new THREE.Box3().setFromObject(o); boxes.push(b); } });
  const hits = [];
  for (let t = 0; t <= WALK_LEN; t += 0.1) {
    poseWalk(t); const p = camera.position; let md = 9;
    for (const b of boxes) md = Math.min(md, b.distanceToPoint(p));
    if (md < 0.25) hits.push(t.toFixed(1) + ':' + md.toFixed(2) + '@' + p.x.toFixed(2) + ',' + p.z.toFixed(2));
  }
  return hits;
};
window.durations = { over: OVER_LEN, walk: WALK_LEN };
Promise.all(pending).then(() => document.fonts.ready).then(() => {
  window.renderAt(params.get('shot') || 'walk', parseFloat(params.get('t') || '0'));
  window.sceneReady = true;
});
