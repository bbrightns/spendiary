import { Composition } from 'remotion'
import { SpendPromo, PROMO_FRAMES } from './SpendPromo'
import { SpendiaryIntro, calculateIntroMetadata, type IntroProps } from './Intro'

export function Root() {
  return (
    <>
      <Composition id="SpendPromo" component={SpendPromo} durationInFrames={PROMO_FRAMES} fps={30} width={1080} height={1920} />
      {/* Length comes from the recorded clips (npm run record) */}
      <Composition
        id="Intro"
        component={SpendiaryIntro}
        defaultProps={{ manifest: null, withAudio: false } satisfies IntroProps}
        calculateMetadata={calculateIntroMetadata}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
      />
      {/* Same cut with music and sound effects (npm run sfx first) */}
      <Composition
        id="IntroMusic"
        component={SpendiaryIntro}
        defaultProps={{ manifest: null, withAudio: true } satisfies IntroProps}
        calculateMetadata={calculateIntroMetadata}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  )
}
