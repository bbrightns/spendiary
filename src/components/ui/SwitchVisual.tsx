/** The look of an on/off switch; the button around it handles the click and the aria state. */
export function SwitchVisual({ on }: { on: boolean }) {
  return (
    <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-line-strong'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-xs transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </span>
  )
}
