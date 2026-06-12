import type { ReactNode } from 'react'

type ChipAmountSize = 'xs' | 'sm' | 'md' | 'lg'
type ChipAmountTone = 'default' | 'primary' | 'muted' | 'danger'

interface ChipAmountProps {
  amount: number | string
  prefix?: ReactNode
  suffix?: ReactNode
  size?: ChipAmountSize
  tone?: ChipAmountTone
  className?: string
  showEuro?: boolean
  ariaLabel?: string
}

export function ChipIcon({ size = 'sm', className = '', decorative = true }: {
  size?: ChipAmountSize
  className?: string
  decorative?: boolean
}) {
  return (
    <span
      className={`roomie-chip chip-amount-icon chip-amount-icon-${size} ${className}`.trim()}
      aria-hidden={decorative ? 'true' : undefined}
    />
  )
}

export default function ChipAmount({
  amount,
  prefix,
  suffix,
  size = 'sm',
  tone = 'default',
  className = '',
  showEuro = false,
  ariaLabel,
}: ChipAmountProps) {
  const label = `${prefix ? `${prefix} ` : ''}${amount} chips${suffix ? ` ${suffix}` : ''}`

  return (
    <span
      className={`chip-amount chip-amount-${size} chip-amount-${tone} ${className}`.trim()}
      aria-label={ariaLabel ?? label}
    >
      <ChipIcon size={size} />
      <span className="chip-amount-main">
        {prefix && <span className="chip-amount-prefix">{prefix}</span>}
        <span className="chip-amount-number">{amount}</span>
        <span className="chip-amount-unit">chips</span>
      </span>
      {showEuro && <span className="chip-amount-euro">= €{amount}</span>}
      {suffix && <span className="chip-amount-suffix">{suffix}</span>}
    </span>
  )
}
