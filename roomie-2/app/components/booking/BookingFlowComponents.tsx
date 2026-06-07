'use client'

import type { ReactNode } from 'react'
import { ShineBorder } from '@/app/components/magicui/shine-border'
import { DiaTextReveal } from '@/app/components/magicui/dia-text-reveal'

export interface BookingStepItem {
  label: string
}

export interface RoomExperience {
  label: string
  className: string
}

export interface RoomSummaryStat {
  label: string
  value: string
}

export interface SessionOption {
  id: string
  label: string
  icon: string
  sub: string
  duration: number
  chips: number
  defaultStart: string
  isDay?: boolean
  badge?: string
}

interface BookingFlowLayoutProps {
  roomSummary: ReactNode
  children: ReactNode
}

export function BookingFlowLayout({ roomSummary, children }: BookingFlowLayoutProps) {
  return (
    <div className="booking-flow-layout">
      {roomSummary}
      {children}
    </div>
  )
}

interface BookingStepperProps {
  steps: BookingStepItem[]
  activeStep: number
  onStepClick?: (step: number) => void
}

export function BookingStepper({ steps, activeStep, onStepClick }: BookingStepperProps) {
  return (
    <nav className="booking-stepper" aria-label="Step prenotazione">
      {steps.map((item, index) => (
        <button
          key={item.label}
          className={`booking-stepper-item${activeStep === index ? ' active' : ''}${activeStep > index ? ' complete' : ''}`}
          type="button"
          onClick={() => onStepClick?.(index)}
          aria-current={activeStep === index ? 'step' : undefined}
        >
          <span className="booking-stepper-index">{index + 1}</span>
          <span className="booking-stepper-label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

interface BookingStickyBarProps {
  currentStep: number
  totalSteps: number
  price: ReactNode
  selectedItem: string
  ctaLabel: string
  onBack: () => void
  onCta: () => void
  disabled?: boolean
}

export function BookingStickyBar({
  currentStep,
  totalSteps,
  price,
  selectedItem,
  ctaLabel,
  onBack,
  onCta,
  disabled = false,
}: BookingStickyBarProps) {
  return (
    <div className="booking-sticky" aria-label="Riepilogo prenotazione">
      <ShineBorder size={110} duration={5.8} initialOffset={18} colorFrom="#C8FF00" colorTo="#00B7FF" borderWidth={1.45} />
      <button className="sticky-back" type="button" onClick={onBack} aria-label="Indietro">
        <i className="fas fa-chevron-left"></i>
      </button>
      <div className="sticky-summary">
        <div className="sticky-total-label">Step {currentStep} di {totalSteps}</div>
        <div className="sticky-total-val">{price}</div>
        <div className="sticky-selected-item">{selectedItem}</div>
      </div>
      <button className="sticky-next" type="button" onClick={onCta} disabled={disabled}>
        {ctaLabel}
      </button>
    </div>
  )
}

interface CompactRoomSummaryProps {
  title: string
  location: string
  image: string
  status: string
  stats: RoomSummaryStat[]
  experiences: RoomExperience[]
}

export function CompactRoomSummary({
  title,
  location,
  image,
  status,
  stats,
  experiences,
}: CompactRoomSummaryProps) {
  return (
    <section className="compact-room-summary" aria-label="Room selezionata">
      <div className="compact-room-media" style={{ backgroundImage: `url('${image}')` }} aria-hidden="true" />
      <div className="compact-room-main">
        <div className="compact-room-kicker">Room selezionata</div>
        <DiaTextReveal className="compact-room-title" duration={620}>{title}</DiaTextReveal>
        <div className="compact-room-location">{location}</div>
        <div className="compact-room-meta">
          {stats.map(stat => (
            <span key={stat.label}>{stat.value}</span>
          ))}
          <span className="compact-room-status">{status}</span>
        </div>
      </div>
      <div className="compact-room-experiences" aria-label="Esperienze incluse">
        <span className="compact-room-experiences-label">Esperienze incluse</span>
        <div className="compact-room-pills">
          {experiences.map(experience => (
            <span key={experience.label} className={experience.className}>{experience.label}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

interface SessionOptionCardProps {
  option: SessionOption
  selected: boolean
  onSelect: (option: SessionOption) => void
}

export function SessionOptionCard({ option, selected, onSelect }: SessionOptionCardProps) {
  const durationLabel = option.isDay ? '09:00-23:00' : `${option.duration}h`

  return (
    <button
      className={`session-option-card${selected ? ' active' : ''}${option.badge ? ' recommended' : ''}`}
      type="button"
      onClick={() => onSelect(option)}
      aria-pressed={selected}
    >
      <span className="session-option-check" aria-hidden="true">
        <i className={`fas ${selected ? 'fa-check' : option.icon}`}></i>
      </span>
      <span className="session-option-copy">
        <span className="session-option-top">
          <span className="session-option-title">{option.label}</span>
          {option.badge && <span className="session-option-badge">{option.badge}</span>}
        </span>
        <span className="session-option-sub">{option.sub}</span>
      </span>
      <span className="session-option-price">
        <span>{option.chips} chips</span>
        <small>{durationLabel} · equiv. €{option.chips}</small>
      </span>
    </button>
  )
}
