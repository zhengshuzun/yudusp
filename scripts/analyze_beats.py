# -*- coding: utf-8 -*-
"""节奏分析：解码音乐 -> BPM / 拍长 / 相位 / 强低音点，输出 beatmap.json。

纯标准库实现（不依赖 numpy / librosa）。22.05kHz 单声道，HOP=256（7.25ms）。

用法:
    python analyze_beats.py --music "F:/音乐库/沙盘.mp3" --out work/audio/beatmap.json
    python analyze_beats.py --music bgm.mp3 --dur 150.41        # 只分析前 150.41s

输出字段:
    duration  音乐长度（秒）
    bpm       自相关测得的 BPM
    beat      一拍秒数 = 60/bpm
    phase     第一拍的时间偏移（秒），t = phase + k*beat
    beats     全部拍点时间
    strong    局部强低音拍（强度排前 25% 且不低于相邻拍）
    top       最强 40 个低音点（按时间排序）

关键约定: 所有镜头切点都必须落在 phase + k*beat 的网格上。
"""
import argparse
import array
import json
import math
import os
import subprocess
import sys

SR = 22050
HOP = 256


def decode(music, dur, dst):
    """用 ffmpeg 解码成 f32le 单声道。可用 --dur 截断到视频长度。"""
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        return
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", music]
    if dur:
        cmd += ["-t", str(dur)]
    cmd += ["-ar", str(SR), "-ac", "1", "-f", "f32le", dst]
    subprocess.run(cmd, check=True)


def load(path):
    a = array.array("f")
    with open(path, "rb") as f:
        a.frombytes(f.read())
    return a


def biquad_lp(x, fc, q):
    """二阶低通（RBJ cookbook），用于拼出四阶。"""
    w0 = 2.0 * math.pi * fc / SR
    cosw, sinw = math.cos(w0), math.sin(w0)
    alpha = sinw / (2.0 * q)
    b0 = (1 - cosw) / 2
    b1 = 1 - cosw
    b2 = (1 - cosw) / 2
    a0 = 1 + alpha
    a1 = -2 * cosw
    a2 = 1 - alpha
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0
    y = [0.0] * len(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1 = x1, v
        y2, y1 = y1, o
        y[i] = o
    return y


def low_band(sig, fc=110.0):
    """四阶低通（两级二阶串联，Butterworth Q 值）。"""
    return biquad_lp(biquad_lp(list(sig), fc, 0.5412), fc, 1.3066)


def envelope(sig):
    n = len(sig) // HOP
    env = [0.0] * n
    for i in range(n):
        s = i * HOP
        acc = 0.0
        for j in range(s, s + HOP):
            v = sig[j]
            acc += v * v
        env[i] = math.sqrt(acc / HOP)
    return env


def onset(env):
    """对数域正向差分，抑制动态范围差异。"""
    db = [20.0 * math.log10(e + 1e-6) for e in env]
    out = [0.0] * len(db)
    for i in range(1, len(db)):
        d = db[i] - db[i - 1]
        out[i] = d if d > 0 else 0.0
    return out


def autocorr_bpm(od):
    """在 60..190 BPM 上做浮点 lag 的三点插值自相关。"""
    fr = SR / HOP
    scores = {}
    for bpm in [x * 0.25 for x in range(240, 760)]:
        lag = 60.0 / bpm * fr
        total = 0.0
        cnt = 0
        for i in range(len(od) - int(lag) - 2):
            j = i + lag
            j0 = int(j)
            w = j - j0
            v = od[j0] * (1 - w) + od[j0 + 1] * w
            total += od[i] * v
            cnt += 1
        if cnt:
            scores[bpm] = total / cnt
    return scores


def find_phase(oL, beat, steps=200):
    """相位扫描：让低频冲击尽量落在网格上。"""
    fr = SR / HOP
    beatF = beat * fr
    best_off, best_val = 0.0, -1e18
    for k in range(steps):
        off = beatF * k / steps
        v = 0.0
        x = off
        while x < len(oL) - 1:
            i = int(x)
            w = x - i
            v += oL[i] * (1 - w) + oL[i + 1] * w
            x += beatF
        if v > best_val:
            best_val, best_off = v, off
    return best_off / fr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--music", required=True, help="音乐文件（mp3/wav/m4a…）")
    ap.add_argument("--out", default="work/audio/beatmap.json")
    ap.add_argument("--dur", type=float, default=0.0, help="只分析前 N 秒，0=整曲")
    ap.add_argument("--fc", type=float, default=110.0, help="低频带截止（Hz）")
    args = ap.parse_args()

    tmp = os.path.join(os.path.dirname(args.out) or ".", "music.raw")
    decode(args.music, args.dur, tmp)
    full = load(tmp)
    dur = len(full) / SR
    print("解码 %.2fs -> %s" % (dur, tmp))

    low = low_band(full, args.fc)
    eF = envelope(full)
    eL = envelope(low)
    oF = onset(eF)
    oL = onset(eL)

    scores = autocorr_bpm(oF)
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])[:12]
    print("BPM 候选:")
    for b, s in ranked[:6]:
        print("  %.2f  %.4f" % (b, s))

    bpm = ranked[0][0]
    beat = 60.0 / bpm
    phase = find_phase(oL, beat)
    print("\n时长 %.2fs  BPM %.2f  拍长 %.4fs  相位 %.5fs" % (dur, bpm, beat, phase))

    fr = SR / HOP
    beats = []
    t = phase
    while t < dur:
        beats.append(round(t, 3))
        t += beat

    strength = []
    for b in beats:
        i0 = max(0, int((b - 0.04) * fr))
        i1 = min(len(oL), int((b + 0.04) * fr))
        strength.append(max(oL[i0:i1]) if i1 > i0 else 0.0)

    thr = sorted(strength)[int(len(strength) * 0.75)] if strength else 0
    strong = []
    for i, b in enumerate(beats):
        if strength[i] < thr:
            continue
        prev = strength[i - 1] if i > 0 else 0
        nxt = strength[i + 1] if i + 1 < len(strength) else 0
        if strength[i] >= prev and strength[i] >= nxt:
            strong.append({"t": b, "s": round(strength[i], 2)})

    top = sorted(strong, key=lambda d: -d["s"])[:40]
    top.sort(key=lambda d: d["t"])

    out = {"duration": dur, "bpm": bpm, "beat": beat, "phase": phase,
           "beats": beats, "strong": strong, "top": top}
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print("总拍数 %d  强低音拍 %d" % (len(beats), len(strong)))
    print("\n最强 24 个低音点（用作大标题 / 高潮爆炸的落点）：")
    for d in sorted(strong, key=lambda d: -d["s"])[:24]:
        print("  %.3fs  %.1f" % (d["t"], d["s"]))
    print("\n已写出 %s" % args.out)


if __name__ == "__main__":
    main()
