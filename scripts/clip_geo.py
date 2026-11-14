# -*- coding: utf-8 -*-
"""把国界裁剪到经纬窗口内，输出可直接给 paint.ts 用的 JSON。

★ 关键教训：绝对不能用 Sutherland-Hodgman。
  Sutherland-Hodgman 会把多边形沿窗口边界"闭合"，横向跨越 180° 经线的俄罗斯
  因此会沿窗口上下边补出长边，投影后变成一个覆盖整屏的大矩形，把整个欧洲盖住。
  这里改用「保留连续段」：只留下落在窗口内的连续点串，段内首尾直连，
  断口自然落在窗口外，不会凭空造边。

★ 第二个坑：即使裁好了，Russia 仍有 700+ 点。用 ctx.clip() 配合这么大的路径
  在 Chrome 里会静默失效（形状不生效但也不报错）。所以填色统一用
  ctx.fill(path, "nonzero")，不要用 clip。

用法:
    python clip_geo.py --src src/europe-borders.json --win -28 18 60 76 --out src/europe-clip.json
"""
import argparse
import json

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--win", nargs=4, type=float, required=True,
                metavar=("LON0", "LAT0", "LON1", "LAT1"))
ap.add_argument("--min-area", type=float, default=0.6, help="面积小于此值的碎块丢弃（平方度）")
args = ap.parse_args()

WIN = tuple(args.win)


def inside(p):
    return WIN[0] <= p[0] <= WIN[2] and WIN[1] <= p[1] <= WIN[3]


def segments(ring):
    pts = [(p[0], p[1]) for p in ring]
    if len(pts) > 1 and abs(pts[0][0] - pts[-1][0]) < 1e-9 and abs(pts[0][1] - pts[-1][1]) < 1e-9:
        pts = pts[:-1]
    if len(pts) < 3:
        return []
    out, cur = [], []
    # 从第一个"外点"开始线性化，让连续段不跨越首尾接缝
    start = 0
    if inside(pts[0]):
        for i, p in enumerate(pts):
            if not inside(p):
                start = i
                break
    seq = pts[start:] + pts[:start]
    for p in seq:
        if inside(p):
            cur.append(p)
        else:
            if len(cur) >= 3:
                out.append(cur)
            cur = []
    if len(cur) >= 3:
        out.append(cur)

    keep = []
    for s in out:
        a = 0.0
        for i in range(len(s)):
            j = (i + 1) % len(s)
            a += s[i][0] * s[j][1] - s[j][0] * s[i][1]
        if abs(a) > args.min_area:
            keep.append([[round(p[0], 4), round(p[1], 4)] for p in s])
    return keep


d = json.load(open(args.src, encoding="utf-8"))
out = {"lon0": d.get("lon0"), "lon1": d.get("lon1"),
       "lat0": d.get("lat0"), "lat1": d.get("lat1"), "countries": {}}
for name, rings in d["countries"].items():
    kept = []
    for r in rings:
        kept.extend(segments(r))
    if kept:
        out["countries"][name] = kept

json.dump(out, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("%s -> %s: %d 国" % (args.src, args.out, len(out["countries"])))
for name in ["Russia", "Germany", "France", "United Kingdom", "Ukraine", "Belarus", "Egypt", "Turkey"]:
    rings = out["countries"].get(name, [])
    if rings:
        lons = [p[0] for r in rings for p in r]
        lats = [p[1] for r in rings for p in r]
        print("   %-16s rings=%d pts=%d lon[%.1f,%.1f] lat[%.1f,%.1f]"
              % (name, len(rings), sum(len(r) for r in rings), min(lons), max(lons), min(lats), max(lats)))
    else:
        print("   %-16s 空（该窗口外的国家，或国名不匹配）" % name)
