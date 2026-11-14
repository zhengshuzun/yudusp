import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Audio, staticFile } from "remotion";
import { renderFrame } from "./render";
import { W, H } from "./geo";

export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    renderFrame(ctx, frame / fps, frame);
  }, [frame, fps]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#03050a" }}>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
      <Audio src={staticFile("audio/score.wav")} />
    </AbsoluteFill>
  );
};
