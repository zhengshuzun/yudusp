// 从 world-atlas（TopoJSON）抽取国界 / 陆块，剪到指定经纬窗口并做 Douglas-Peucker 简化。
//
// 用法（在 Remotion 工程目录下跑，需要 topojson-client 与 world-atlas 两个依赖）:
//   node ../scripts/extract_geo.js --mode countries --win -28 18 60 76 --out src/europe-borders.json
//   node ../scripts/extract_geo.js --mode land      --win -28 18 60 76 --out src/europe-land.json
//   node ../scripts/extract_geo.js --mode countries --win -132 12 148 72 --tol 0.055 --out src/world-borders.json
//
// --win 顺序为 lon0 lat0 lon1 lat1（注意是 lat0 lat1，不是 lon/lat 混排）
// --tol 是简化容差（度）。欧洲这种要看清国界的用 0.018~0.03，全图用 0.05~0.06。

const fs = require("fs");
const path = require("path");
const topojson = require("topojson-client");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf("--" + k);
  return i >= 0 ? argv[i + 1] : d;
};
// 多值参数：--win -14 33 36 64 会被拆成 5 个 argv 项，必须连续收集
const multi = (k, n) => {
  const i = argv.indexOf("--" + k);
  if (i < 0) return null;
  const out = [];
  for (let j = i + 1; j < argv.length && out.length < n; j++) {
    if (argv[j].startsWith("--")) break;
    out.push(argv[j]);
  }
  return out;
};

const mode = arg("mode", "countries");
const out = arg("out", `src/${mode}.json`);
const tol = parseFloat(arg("tol", mode === "land" ? "0.035" : "0.022"));
const dataDir = arg("data", "node_modules/world-atlas");
const winRaw = multi("win", 4);
if (!winRaw || winRaw.length !== 4 || winRaw.some((v) => isNaN(parseFloat(v)))) {
  console.error("错误: --win 需要 4 个数字，顺序为 lon0 lat0 lon1 lat1");
  console.error('例: --win -28 18 60 76');
  process.exit(1);
}
const [LON0, LAT0, LON1, LAT1] = winRaw.map(Number);
const PAD = parseFloat(arg("pad", "6")); // 窗口外多留几度，避免边界处突然断开

const file = path.join(dataDir, mode === "land" ? "land-50m.json" : "countries-50m.json");
const topo = JSON.parse(fs.readFileSync(file, "utf8"));
const fc = topojson.feature(topo, topo.objects[mode === "land" ? "land" : "countries"]);

const nearBox = (lon, lat) =>
  lon >= LON0 - PAD && lon <= LON1 + PAD && lat >= LAT0 - PAD && lat <= LAT1 + PAD;

// Douglas-Peucker（平方距离，避免开方）
function simplify(pts, tolerance) {
  if (pts.length < 4) return pts;
  const sqTol = tolerance * tolerance;
  const sqSegDist = (p, a, b) => {
    let x = a[0], y = a[1];
    let dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; }
      else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p[0] - x; dy = p[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [f, l] = stack.pop();
    let maxD = 0, idx = -1;
    for (let i = f + 1; i < l; i++) {
      const d = sqSegDist(pts[i], pts[f], pts[l]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > sqTol) { keep[idx] = 1; stack.push([f, idx], [idx, l]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function cleanRing(ring) {
  let r = ring.map(([lon, lat]) => [+lon.toFixed(3), +lat.toFixed(3)]);
  r = simplify(r, tol);
  if (r.length < 4) return null;
  // 闭合环：首尾必须同点
  if (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) r.push(r[0]);
  return r;
}

let rawPts = 0, keptPts = 0;

if (mode === "land") {
  const rings = [];
  const walk = (geom) => {
    const polys = geom.type === "Polygon" ? [geom.coordinates]
      : geom.type === "MultiPolygon" ? geom.coordinates : [];
    for (const poly of polys) {
      for (const ring of poly) {
        if (!ring.some(([lon, lat]) => nearBox(lon, lat))) continue;
        rawPts += ring.length;
        const r = cleanRing(ring);
        if (!r) continue;
        rings.push(r);
        keptPts += r.length;
      }
    }
  };
  fc.features.forEach((f) => walk(f.geometry));
  fs.writeFileSync(out, JSON.stringify({ lon0: LON0, lon1: LON1, lat0: LAT0, lat1: LAT1, rings }));
  console.log(`rings=${rings.length} pts raw=${rawPts} kept=${keptPts} -> ${out}`);
} else {
  const countries = {};
  for (const f of fc.features) {
    const name = f.properties && f.properties.name;
    if (!name) continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates]
      : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
    const rings = [];
    for (const poly of polys) {
      const outer = poly[0];
      if (!outer.some(([lon, lat]) => nearBox(lon, lat))) continue;
      rawPts += outer.length;
      const r = cleanRing(outer);
      if (!r) continue;
      rings.push(r);
      keptPts += r.length;
    }
    if (rings.length) countries[name] = rings;
  }
  fs.writeFileSync(out, JSON.stringify({ lon0: LON0, lon1: LON1, lat0: LAT0, lat1: LAT1, countries }));
  const names = Object.keys(countries).sort();
  console.log(`countries=${names.length} pts raw=${rawPts} kept=${keptPts} -> ${out}`);
  console.log(names.join(" | "));
}

// 提醒：这里的窗口只决定"哪些环被收进来"，环本身没有被裁剪。
// 跨越 180° 经线的大国（Russia）必须在下一步用 clip_geo.py 剪，否则投影后会包住整屏。
console.log("\n下一步: python clip_geo.py --src " + out + " --win " + winRaw.join(" "));
