import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { CheckIcon, DcaIcon } from '../icons'
import { ASSET_META } from '../../lib/calc'
import type { DcaPlan } from '../../lib/types'
import { thb } from '../../lib/format'

interface Props {
  open: boolean
  plan: DcaPlan | null
  onClose: () => void
}

export function DcaSuccessModal({ open, plan, onClose }: Props) {
  if (!plan) return null

  const meta = ASSET_META[plan.assetClass]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="บันทึก DCA สำเร็จแล้ว"
      description="รายการ DCA ของคุณได้รับการยืนยันเรียบร้อยแล้ว"
    >
      <div className="space-y-6 pt-2 pb-1 text-center sm:text-left">
        {/* Animated Checkmark Badge */}
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gain-soft text-gain shadow-sm">
            <span className="absolute inset-0 rounded-2xl bg-gain/20 animate-ping opacity-25" />
            <CheckIcon className="h-9 w-9" strokeWidth={3} />
          </div>
          <div className="text-center">
            <h3 className="font-display text-[18px] font-extrabold text-ink">
              DCA สำเร็จเรียบร้อย!
            </h3>
            <p className="mt-1 text-[13px] text-ink-muted">
              ระบบได้บันทึกการทำรายการและอัปเดตข้อมูลพอร์ตการลงทุนเรียบร้อยแล้ว
            </p>
          </div>
        </div>

        {/* Transaction Summary Card */}
        <div
          className="rounded-2xl border px-4 py-3.5 text-left transition-colors"
          style={{
            borderColor: `color-mix(in srgb, ${meta.color} 30%, transparent)`,
            background: `color-mix(in srgb, ${meta.color} 8%, transparent)`,
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
              style={{
                color: meta.color,
                background: `color-mix(in srgb, ${meta.color} 15%, transparent)`,
              }}
            >
              <DcaIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[15px] font-bold text-ink">{plan.name}</p>
                <p className="font-display text-[16px] font-extrabold tnum text-gain">
                  +{thb(plan.monthlyAmount)}
                </p>
              </div>
              <p className="mt-0.5 text-[12px] text-ink-muted">
                {meta.label} · สถานะ: Confirmed
              </p>
            </div>
          </div>
        </div>

        {/* OK Button */}
        <div className="pt-2">
          <Button onClick={onClose} className="w-full">
            ตกลง
          </Button>
        </div>
      </div>
    </Modal>
  )
}
