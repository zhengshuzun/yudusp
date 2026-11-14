import React from "react";
import { Composition } from "remotion";
import { Main } from "./Scene";
import { Cover } from "./Cover";

const DUR = 4512;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="WW2Timeline" component={Main} durationInFrames={DUR} fps={30} width={1920} height={1080} />
    <Composition
      id="CoverWide"
      component={Cover}
      defaultProps={{ variant: "wide" as const }}
      durationInFrames={1}
      fps={30}
      width={1440}
      height={1080}
    />
    <Composition
      id="CoverTall"
      component={Cover}
      defaultProps={{ variant: "tall" as const }}
      durationInFrames={1}
      fps={30}
      width={1080}
      height={1440}
    />
  </>
);
