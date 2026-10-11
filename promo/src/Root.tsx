import { Composition } from 'remotion'
import { SpendPromo, PROMO_FRAMES } from './SpendPromo'

export function Root() {
  return <Composition id="SpendPromo" component={SpendPromo} durationInFrames={PROMO_FRAMES} fps={30} width={1080} height={1920} />
}
