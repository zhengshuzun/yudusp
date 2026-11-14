# -*- coding: utf-8 -*-
"""配乐工程：音乐处理（刹车 / 淡出）+ 卡点音效合成 + 软限幅，输出混音 wav。

纯标准库实现（不依赖 numpy / scipy）。音效全部用代码合成，不需要素材包。

用法:
    python build_audio.py --project cues.json --out out/score.wav

cues.json 格式（模板见 references/storyboard-and-beats.md）:
{
  "music": "F:/音乐库/沙盘.mp3",
  "duration": 150.41,
  "brakes": [{"t0":63.70,"t1":64.80,"fc0":18000,"fc1":240,"g0":1.0,"g1":0.13}],
  "fade": {"t0":147.10,"t1":150.41,"pow":1.7},
  "limit": 31000,
  "cues": [{"t":27.76,"fx":"impact","args":{"dur":1.6,"f0":165,"f1":30},"gain":1.0}]
}

音效类型: impact / sub / tick / whoosh / riser / boom
  impact  下扫正弦 + 起音噪声，大标题弹出用，最有"重量"的一击
  sub     极低频补充，只给全曲最强 drop 加，制造胸腔压迫感
  tick    短促点击，用于四连快切子镜
  whoosh  噪声扫频，用于转场 / 登陆 / 推进
  riser   持续爬升，用于高潮爆炸前蓄势
  boom    长尾爆破，用于爆炸 / 终局
"""
import argparse
import array
import json
import math
import os
import random
import subprocess

SR = 44100

random.seed(20251111)


# ── 音效合成 ───────────────────────────────────────────────

def impact(dur=1.4, f0=150.0, f1=32.0, gain=1.0, noise=0.5):
    n = int(SR * dur)
    out = [0.0] * n
    ph = lp = 0.0
    for i in range(n):
        t = i / SR
        f = f1 + (f0 - f1) * math.exp(-t * 8.5)
        ph += 2.0 * math.pi * f / SR
        env = math.exp(-t * 3.4)
        atk = min(1.0, t / 0.003)
        body = math.sin(ph) + 0.34 * math.sin(ph * 2.0) + 0.12 * math.sin(ph * 3.0)
        nz = random.random() * 2 - 1
        lp += 0.06 * (nz - lp)
        burst = nz * math.exp(-t * 70.0) * noise * 0.9
        out[i] = (body * env * atk + burst + lp * env * 0.18) * gain
    return out


def sub(dur=1.0, f=41.0, gain=1.0):
    n = int(SR * dur)
    out = [0.0] * n
    ph = 0.0
    for i in range(n):
        t = i / SR
        ff = f * (1.0 + 0.6 * math.exp(-t * 12))
        ph += 2.0 * math.pi * ff / SR
        out[i] = math.sin(ph) * math.exp(-t * 3.0) * min(1.0, t / 0.004) * gain
    return out


def tick(dur=0.09, gain=0.85, f=2400.0):
    n = int(SR * dur)
    out = [0.0] * n
    ph = 0.0
    for i in range(n):
        t = i / SR
        ph += 2.0 * math.pi * f * (1 + 0.4 * math.exp(-t * 60)) / SR
        env = math.exp(-t * 55.0)
        nz = (random.random() * 2 - 1) * math.exp(-t * 120.0)
        out[i] = (math.sin(ph) * env * 0.55 + nz * 0.55) * gain
    return out


def whoosh(dur=0.9, gain=0.7, up=True):
    n = int(SR * dur)
    out = [0.0] * n
    y = 0.0
    for i in range(n):
        t = i / SR
        p = t / dur
        fc = 300 + (5200 if up else -4000) * (p if up else (1 - p))
        fc = max(120.0, fc)
        a = 1.0 - math.exp(-2.0 * math.pi * fc / SR)
        nz = random.random() * 2 - 1
        y += a * (nz - y)
        env = math.sin(math.pi * min(1.0, p)) ** 1.4
        out[i] = y * env * gain
    return out


def riser(dur=4.5, gain=0.75):
    n = int(SR * dur)
    out = [0.0] * n
    y = 0.0
    ph = 0.0
    for i in range(n):
        t = i / SR
        p = t / dur
        fc = 200 + 9000 * (p ** 2.2)
        a = 1.0 - math.exp(-2.0 * math.pi * fc / SR)
        nz = random.random() * 2 - 1
        y += a * (nz - y)
        f = 90 + 620 * (p ** 2)
        ph += 2.0 * math.pi * f / SR
        env = p ** 2.0
        out[i] = (y * 0.75 + math.sin(ph) * 0.3) * env * gain
    return out


def boom(dur=2.6, gain=1.0):
    n = int(SR * dur)
    out = [0.0] * n
    ph = lp = 0.0
    for i in range(n):
        t = i / SR
        f = 36 + 120 * math.exp(-t * 9)
        ph += 2.0 * math.pi * f / SR
        env = math.exp(-t * 2.0)
        nz = random.random() * 2 - 1
        lp += 0.03 * (nz - lp)
        crack = nz * math.exp(-t * 26.0) * 0.6
        out[i] = (math.sin(ph) * 0.85 + lp * 1.5 * env + crack) * env * gain
    return out


FX = {"impact": impact, "sub": sub, "tick": tick,
      "whoosh": whoosh, "riser": riser, "boom": boom}


# ── 混音 ───────────────────────────────────────────────────

def add(buf, t, samples, gain=1.0):
    s0 = int(t * SR) * 2
    n = len(samples)
    end = min(len(buf), s0 + n * 2)
    j = 0
    for i in range(s0, end, 2):
        if j >= n:
            break
        v = samples[j] * gain
        for ch in (0, 1):
            k = i + ch
            if k < len(buf):
                x = buf[k] + int(v * 32767)
                buf[k] = 32767 if x > 32767 else (-32768 if x < -32768 else x)
        j += 1


def lowpass_segment(buf, t0, t1, fc0, fc1, gain0, gain1):
    """对 [t0,t1] 做时变低通 + 音量渐变——音乐刹车，让标题砸下来时音乐先"吸住"。"""
    i0 = int(t0 * SR) * 2
    i1 = min(len(buf), int(t1 * SR) * 2)
    yl = yr = 0.0
    n = (i1 - i0) // 2
    for k in range(n):
        p = k / max(1, n - 1)
        fc = fc0 + (fc1 - fc0) * p
        a = 1.0 - math.exp(-2.0 * math.pi * fc / SR)
        g = gain0 + (gain1 - gain0) * p
        i = i0 + k * 2
        xl = buf[i] / 32768.0
        xr = buf[i + 1] / 32768.0
        yl += a * (xl - yl)
        yr += a * (xr - yr)
        buf[i] = max(-32768, min(32767, int(yl * g * 32768)))
        buf[i + 1] = max(-32768, min(32767, int(yr * g * 32768)))


def fade_out(buf, t0, t1, power=1.7):
    i0 = int(t0 * SR) * 2
    i1 = min(len(buf), int(t1 * SR) * 2)
    n = i1 - i0
    for k in range(n):
        p = k / max(1, n - 1)
        buf[i0 + k] = int(buf[i0 + k] * ((1.0 - p) ** power))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", required=True, help="cues.json 工程文件")
    ap.add_argument("--out", required=True, help="输出 wav 路径")
    ap.add_argument("--music-raw", default=None, help="解码缓存（默认与 out 同目录）")
    args = ap.parse_args()

    cfg = json.load(open(args.project, encoding="utf-8"))
    dur = float(cfg["duration"])
    music = cfg["music"]
    raw = args.music_raw or os.path.join(os.path.dirname(args.out) or ".", "music.raw")

    if not os.path.exists(raw):
        os.makedirs(os.path.dirname(raw) or ".", exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", music, "-t", str(dur),
                        "-ar", str(SR), "-ac", "2", "-f", "s16le", raw], check=True)

    buf = array.array("h")
    with open(raw, "rb") as f:
        buf.frombytes(f.read())
    need = (int(dur * SR) + 8) * 2
    if len(buf) < need:
        buf.extend([0] * (need - len(buf)))
    print("音乐长度 %.2fs（目标 %.2fs）" % (len(buf) / 2 / SR, dur))

    for b in cfg.get("brakes", []):
        lowpass_segment(buf, b["t0"], b["t1"], b["fc0"], b["fc1"], b["g0"], b["g1"])
    print("刹车 %d 段" % len(cfg.get("brakes", [])))

    if "fade" in cfg:
        fd = cfg["fade"]
        fade_out(buf, fd["t0"], fd["t1"], fd.get("pow", 1.7))
        print("淡出 %.2f -> %.2f" % (fd["t0"], fd["t1"]))

    cues = cfg.get("cues", [])
    for c in cues:
        fx = FX[c["fx"]]
        samples = fx(**c.get("args", {}))
        add(buf, c["t"], samples, c.get("gain", 1.0))
    print("音效 %d 处" % len(cues))

    peak = 0
    for i in range(0, len(buf), 7):
        peak = max(peak, abs(buf[i]))
    print("峰值 %d (%.1f dBFS)" % (peak, 20 * math.log10(max(1, peak) / 32768)))
    limit = cfg.get("limit", 31000)
    if peak > limit:
        k = limit / peak
        for i in range(len(buf)):
            buf[i] = int(buf[i] * k)
        print("软限幅 x%.3f" % k)

    tmp = args.out + ".raw"
    with open(tmp, "wb") as f:
        buf.tofile(f)
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(SR),
                    "-ac", "2", "-i", tmp, "-t", str(dur), "-c:a", "pcm_s16le", args.out],
                   check=True)
    os.remove(tmp)
    print("输出 %s" % args.out)


if __name__ == "__main__":
    main()
