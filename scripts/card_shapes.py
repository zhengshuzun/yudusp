# -*- coding: utf-8 -*-
"""生成"四国卡片"用的国家轮廓：每个国家各自裁剪、归一化到 0..1 的方形内。

卡片镜的用法：几张国名卡片快切（英国 / 苏联 / 美国 / 自由法国…），
每张卡片画该国轮廓的剪影 + 国旗元素 + 国名，比放地图更容易一眼认出。

这里用矩形裁剪（cards 都是单个国家，矩形 clip 够用，不会出现跨 180° 的问题）。

用法:
    python card_shapes.py --euro src/europe-borders.json --world src/world-borders.json \
        --out src/card-shapes.json --targets card_targets.json

targets.json 格式（box = lon0 lat0 lon1 lat1，用来去掉海外领地之类的碎块）:
    [{"name": "United Kingdom", "src": "euro", "box": [-9.5, 49.5, 2.2, 59.0]},
     {"name": "United States of America", "src": "world", "box": [-125.5, 24.0, -66.0, 49.5]}]

省略 --targets 时使用内置的二战四国 + 轴心对照表。
"""
import argparse
import json
import os

DEFAULT_TARGETS = [
    {"name": "United Kingdom", "src": "euro", "box": [-9.5, 49.5, 2.2, 59.0]},
    {"name": "Russia", "src": "euro", "box": [19.0, 43.0, 50.0, 62.0]},
    {"name": "United States of America", "src": "world", "box": [-125.5, 24.0, -66.0, 49.5]},
    {"name": "France", "src": "euro", "box": [-5.5, 42.0, 8.5, 51.5]},
    {"name": "Germany", "src": "euro", "box": [5.5, 47.0, 15.5, 55.2]},
    {"name": "Italy", "src": "euro", "box": [6.5, 36.5, 19.0, 47.5]},
]


def clip_rect(ring, box):
    pts = [(p[0], p[1]) for p in ring]
    if len(pts) > 1 and abs(pts[0][0] - pts[-1][0]) < 1e-9 and abs(pts[0][1] - pts[-1][1]) < 1e-9:
        pts = pts[:-1]
    if len(pts) < 3:
        return []

    def ce(pts, axis, val, greater):
        out = []
        n = len(pts)
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            ai, bi = a[axis], b[axis]
            ain = ai >= val if greater else ai <= val
            bin_ = bi >= val if greater else bi <= val
            if ain:
                out.append(a)
                if not bin_:
                    t = (val - ai) / (bi - ai) if bi != ai else 0
                    out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
            elif bin_:
                t = (val - ai) / (bi - ai) if bi != ai else 0
                out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
        return out

    pts = ce(pts, 0, box[0], True)
    pts = ce(pts, 0, box[2], False)
    pts = ce(pts, 1, box[1], True)
    pts = ce(pts, 1, box[3], False)
    if len(pts) < 3:
        return []
    area = 0.0
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]
    if abs(area) < 0.08:
        return []
    return pts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--euro", default="src/europe-borders.json")
    ap.add_argument("--world", default="src/world-borders.json")
    ap.add_argument("--out", default="src/card-shapes.json")
    ap.add_argument("--targets", default=None)
    args = ap.parse_args()

    targets = DEFAULT_TARGETS
    if args.targets:
        targets = json.load(open(args.targets, encoding="utf-8"))

    sources = {}
    for key, path in (("euro", args.euro), ("world", args.world)):
        if path and os.path.exists(path):
            sources[key] = json.load(open(path, encoding="utf-8"))["countries"]

    out = {}
    for t in targets:
        name, src_key, box = t["name"], t.get("src", "euro"), t["box"]
        src = sources.get(src_key)
        if src is None:
            print("!! 缺少数据源 %s，跳过 %s" % (src_key, name))
            continue
        rings = []
        for r in src.get(name, []):
            c = clip_rect(r, box)
            if c:
                rings.append(c)
        if not rings:
            print("!! 空: %s（检查国名与 box）" % name)
            continue

        xs = [p[0] for r in rings for p in r]
        ys = [p[1] for r in rings for p in r]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        w, h = max(x1 - x0, 1e-6), max(y1 - y0, 1e-6)
        s = max(w, h)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        # 归一化到 0..1 方形，y 轴翻转（屏幕坐标向下）
        out[name] = [[[round(0.5 + (p[0] - cx) / s, 4), round(0.5 - (p[1] - cy) / s, 4)]
                      for p in r] for r in rings]
        print("%-32s rings=%d pts=%d" % (name, len(rings), sum(len(r) for r in rings)))

    json.dump(out, open(args.out, "w", encoding="utf-8"), separators=(",", ":"))
    print("saved %d -> %s" % (len(out), args.out))


if __name__ == "__main__":
    main()
