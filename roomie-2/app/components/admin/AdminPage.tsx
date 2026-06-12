'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/app/context/AppContext'
import SafeDocViewer from '@/app/components/ui/SafeDocViewer'
import ChipAmount from '@/app/components/ui/ChipAmount'
import {
  apiAdminSummary, apiAdminPatchConfig, apiAdminPatchBookingStatus,
  apiAdminPatchUserChips, apiAdminBlockSlot, apiAdminDeleteBlockedSlot,
  apiAdminCreateAddon, apiAdminPatchAddon, apiAdminDeleteAddon,
} from '@/lib/client-api'
import type { Booking, AppConfig, Addon, PublicUser, AddonOrder, BlockedSlot, AuditEntry } from '@/lib/types'

type Tab = 'bookings' | 'users' | 'access' | 'commerce' | 'audit' | 'docs'

const TAB_LABELS: Record<Tab, string> = {
  bookings: 'Bookings',
  users: 'Users',
  access: 'Access',
  commerce: 'Commerce',
  audit: 'Audit',
  docs: 'Documentazione',
}

const TAB_ICONS: Record<Tab, string> = {
  bookings: 'fa-calendar-check',
  users: 'fa-users',
  access: 'fa-key',
  commerce: 'fa-shopping-bag',
  audit: 'fa-shield-alt',
  docs: 'fa-book',
}

interface SummaryData {
  bookings: Booking[]
  users: PublicUser[]
  addons: Addon[]
  addonOrders: AddonOrder[]
  blockedSlots: BlockedSlot[]
  auditLog: AuditEntry[]
  config: AppConfig
  stats: { revenue: number; bookingsCount: number; usersCount: number; pendingCount: number; revenueRoom: number; revenueAddon: number }
}

const ADMIN_DOC = {
  file: '/docs/ROOMIE-Documentazione.docx',
  fallback: '<p>Documentazione tecnica ROOMIE non disponibile in anteprima.</p>',
}

function formatAuditType(type: string) {
  const labels: Record<string, string> = {
    login: 'Login utente',
    logout: 'Logout',
    register: 'Registrazione',
    social_login: 'Login Google',
    social_register: 'Registrazione Google',
    booking_created: 'Prenotazione creata',
    booking_extended: 'Sessione estesa',
    booking_extended_admin: 'Estensione admin',
    addon_order_paid: 'Addon acquistato',
    stripe_wallet_topup: 'Ricarica Stripe',
    wallet_topup: 'Ricarica chips',
    admin_config_update: 'Config aggiornata',
    admin_addon_create: 'Addon creato',
    admin_addon_update: 'Addon modificato',
    admin_addon_delete: 'Addon eliminato',
    admin_block_slot: 'Slot bloccato',
    admin_unblock_slot: 'Slot sbloccato',
    admin_booking_update: 'Booking modificato',
    admin_booking_status: 'Stato booking',
    admin_user_update: 'Utente modificato',
    admin_wallet_adjust: 'Chips modificate',
  }
  return labels[type] || type || 'Evento'
}

function formatAuditDetails(details: Record<string, unknown> = {}) {
  const entries = Object.entries(details).filter(([, value]) => value !== undefined && value !== null && value !== '')
  if (!entries.length) return 'Nessun dettaglio extra'
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ')
}

export default function AdminPage() {
  const { user, setConfig, showToast } = useApp()
  const [tab, setTab] = useState<Tab>('bookings')
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  const [docPreviewOpen, setDocPreviewOpen] = useState(false)

  // Config form
  const [priceHour, setPriceHour] = useState('')
  const [priceDay, setPriceDay] = useState('')
  const [priceGuest, setPriceGuest] = useState('')
  const [maxPeople, setMaxPeople] = useState('')
  const [lockboxCode, setLockboxCode] = useState('')

  // Block slot form
  const [blockDate, setBlockDate] = useState('')
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockReason, setBlockReason] = useState('')

  // New addon form
  const [addonName, setAddonName] = useState('')
  const [addonBrand, setAddonBrand] = useState('')
  const [addonPrice, setAddonPrice] = useState('')
  const [addonCategory, setAddonCategory] = useState<'featured' | 'modes' | 'snacks'>('featured')
  const [addonDesc, setAddonDesc] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await apiAdminSummary()
    if (d) {
      const sd = d as SummaryData
      setData(sd)
      if (sd.config) {
        setPriceHour(String(sd.config.hourlyPrice))
        setPriceDay(String(sd.config.dayPrice))
        setPriceGuest(String(sd.config.guestPassPrice))
        setMaxPeople(String(sd.config.maxPeople))
        setLockboxCode(sd.config.lockboxCode || '')
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveConfig = async () => {
    const values = {
      hourlyPrice: Number(priceHour),
      dayPrice: Number(priceDay),
      guestPassPrice: Number(priceGuest),
      maxPeople: Number(maxPeople),
      lockboxCode: lockboxCode.trim(),
    }
    const invalid =
      !Number.isFinite(values.hourlyPrice) ||
      !Number.isFinite(values.dayPrice) ||
      !Number.isFinite(values.guestPassPrice) ||
      !Number.isFinite(values.maxPeople) ||
      !/^\d{4,6}$/.test(values.lockboxCode)
    if (invalid) {
      showToast({ title: 'Config non valida', copy: 'Controlla prezzi, capienza e codice cassaforte.', type: 'warn' })
      return
    }
    const cfg: Partial<AppConfig> = {
      hourlyPrice: values.hourlyPrice,
      dayPrice: values.dayPrice,
      guestPassPrice: values.guestPassPrice,
      maxPeople: values.maxPeople,
      lockboxCode: values.lockboxCode,
    }
    const { data: saved, error } = await apiAdminPatchConfig(cfg)
    if (error) { showToast({ title: error, type: 'warn' }); return }
    if (saved?.config) setConfig(saved.config)
    showToast({ title: 'Config salvata' })
  }

  const blockSlot = async () => {
    if (!blockDate || !blockStart || !blockEnd) { showToast({ title: 'Compila tutti i campi', type: 'warn' }); return }
    const { error } = await apiAdminBlockSlot(blockDate, blockStart, blockEnd, blockReason || 'Blocco admin')
    if (error) { showToast({ title: error, type: 'warn' }); return }
    showToast({ title: 'Slot bloccato' })
    load()
  }

  const deleteBlockedSlot = async (id: string) => {
    const { error } = await apiAdminDeleteBlockedSlot(id)
    if (error) { showToast({ title: error, type: 'warn' }); return }
    showToast({ title: 'Slot sbloccato' })
    load()
  }

  const createAddon = async () => {
    if (!addonName || !addonPrice) { showToast({ title: 'Nome e prezzo obbligatori', type: 'warn' }); return }
    const { error } = await apiAdminCreateAddon({
      name: addonName, brand: addonBrand, price: parseInt(addonPrice),
      category: addonCategory, description: addonDesc, status: 'active',
    })
    if (error) { showToast({ title: error, type: 'warn' }); return }
    setAddonName(''); setAddonBrand(''); setAddonPrice(''); setAddonDesc('')
    showToast({ title: 'Addon creato' })
    load()
  }

  const toggleAddon = async (a: Addon) => {
    const newStatus = a.status === 'active' ? 'hidden' : 'active'
    await apiAdminPatchAddon(a.id, { status: newStatus })
    load()
  }

  const deleteAddon = async (id: string) => {
    await apiAdminDeleteAddon(id)
    load()
  }

  const patchBookingStatus = async (id: string, status: string) => {
    await apiAdminPatchBookingStatus(id, status)
    load()
  }

  const patchUserChips = async (id: string, delta: number) => {
    const { error } = await apiAdminPatchUserChips(id, delta, `${delta > 0 ? 'Bonus' : 'Rettifica'} admin`)
    if (error) { showToast({ title: error, type: 'warn' }); return }
    showToast({ title: `${delta > 0 ? '+' : ''}${delta} chips` })
    load()
  }

  const stats = data?.stats

  if (!user || user.role !== 'admin') return (
    <div className="page active admin-denied">
      Accesso negato.
    </div>
  )

  return (
    <div className="page active" id="page-admin">
      <div className="admin-shell">

        {/* Header */}
        <div className="admin-header">
          <div>
            <div className="admin-kicker">ADMIN PANEL</div>
            <h2 className="admin-title">ROOM VIA TERNI</h2>
          </div>
          <div className="flex gap-8 flex-wrap">
            <div className="admin-user-pill"><span><i className="fas fa-user-shield"></i></span><strong>{user.name}</strong></div>
            {stats && <>
              <div className="admin-stat-pill">
                <span className="admin-stat-label">Revenue mese</span><br />
                <span className="admin-stat-value neon"><ChipAmount amount={stats.revenue} size="sm" tone="primary" /></span>
              </div>
              <div className="admin-stat-pill">
                <span className="admin-stat-label">Sessioni</span><br />
                <span className="admin-stat-value">{stats.bookingsCount}</span>
              </div>
            </>}
          </div>
        </div>

        {/* Stats grid */}
        {stats && (
          <div className="admin-grid">
            <div className="admin-card card"><div className="admin-card-label">Revenue</div><div className="admin-card-value neon"><ChipAmount amount={stats.revenue} size="sm" tone="primary" /></div></div>
            <div className="admin-card card"><div className="admin-card-label">Prenotazioni</div><div className="admin-card-value">{stats.bookingsCount}</div></div>
            <div className="admin-card card"><div className="admin-card-label">Utenti</div><div className="admin-card-value">{stats.usersCount}</div></div>
            <div className="admin-card card"><div className="admin-card-label">In attesa</div><div className="admin-card-value warn">{stats.pendingCount}</div></div>
          </div>
        )}

        {/* Tabs */}
        <div className="admin-tabs">
          {(['bookings', 'users', 'access', 'commerce', 'audit', 'docs'] as Tab[]).map(t => (
            <button key={t} className={`admin-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              <i className={`fas ${TAB_ICONS[t]}`}></i>
              {' '}{TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {loading && (
          <div className="page-skeleton admin-skeleton" aria-hidden="true">
            <div className="page-skeleton-header">
              <div className="roomie-skeleton roomie-skeleton-bar lg shimmer skeleton-w-38"></div>
              <div className="roomie-skeleton roomie-skeleton-bar shimmer skeleton-w-54"></div>
            </div>
            <div className="page-skeleton-grid">
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
              <div className="roomie-skeleton page-skeleton-card shimmer"></div>
            </div>
            <div className="roomie-skeleton page-skeleton-card shimmer skeleton-card-tall"></div>
          </div>
        )}

        {/* Bookings panel */}
        {tab === 'bookings' && !loading && (
          <div className="admin-panel active">
            <div className="admin-toolbar">
              <div className="admin-toolbar-title">PRENOTAZIONI</div>
            </div>
            <div>
              {(data?.bookings || []).map(b => (
                <div key={b.id} className="admin-mini-item wrap">
                  <div>
                    <strong className="admin-item-title">{b.date} {b.start}→{b.end}</strong>
                    <span className="admin-meta ms-2"><ChipAmount amount={b.totalChips} size="xs" /> · {b.people} pers.</span>
                    <span className="status-badge ms-2">{b.status}</span>
                  </div>
                  <div className="admin-item-actions">
                    {b.status === 'pending' && (
                      <button className="admin-page-btn btn btn-sm btn-outline-light confirm" onClick={() => patchBookingStatus(b.id, 'confirmed')}>CONFERMA</button>
                    )}
                    {['pending', 'confirmed'].includes(b.status) && (
                      <button className="admin-page-btn btn btn-sm btn-outline-light danger" onClick={() => patchBookingStatus(b.id, 'cancelled')}>ANNULLA</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Config */}
            <div className="admin-card card admin-card-spaced">
              <div className="admin-section-title">CONFIG PREZZI</div>
              <div className="admin-form-row">
                <div><label className="form-label">ORA</label><input type="number" className="form-input form-control admin-field-xs" value={priceHour} onChange={e => setPriceHour(e.target.value)} /></div>
                <div><label className="form-label">GIORNATA</label><input type="number" className="form-input form-control admin-field-xs" value={priceDay} onChange={e => setPriceDay(e.target.value)} /></div>
                <div><label className="form-label">GUEST PASS</label><input type="number" className="form-input form-control admin-field-xs" value={priceGuest} onChange={e => setPriceGuest(e.target.value)} /></div>
                <div><label className="form-label">MAX PERSONE</label><input type="number" className="form-input form-control admin-field-xs" value={maxPeople} onChange={e => setMaxPeople(e.target.value)} /></div>
                <div><label className="form-label">CODICE CASSAFORTE</label><input className="form-input form-control admin-field-sm" value={lockboxCode} onChange={e => setLockboxCode(e.target.value)} /></div>
                <button className="btn-neon btn btn-primary" onClick={saveConfig}>SALVA</button>
              </div>
            </div>

            {/* Block slot */}
            <div className="admin-card card admin-card-spaced">
              <div className="admin-section-title">BLOCCA SLOT</div>
              <div className="admin-form-row">
                <div><label className="form-label">DATA</label><input type="date" className="form-input form-control admin-field-md" value={blockDate} onChange={e => setBlockDate(e.target.value)} /></div>
                <div><label className="form-label">DALLE</label><input type="time" className="form-input form-control admin-field-xs" value={blockStart} onChange={e => setBlockStart(e.target.value)} /></div>
                <div><label className="form-label">ALLE</label><input type="time" className="form-input form-control admin-field-xs" value={blockEnd} onChange={e => setBlockEnd(e.target.value)} /></div>
                <div className="admin-field-fluid"><label className="form-label">MOTIVO</label><input type="text" className="form-input form-control" value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Es. Manutenzione" /></div>
                <button className="admin-page-btn btn btn-sm btn-outline-light danger" onClick={blockSlot}>BLOCCA</button>
              </div>
              {(data?.blockedSlots || []).length > 0 && (
                <div className="admin-blocked-list">
                  {(data?.blockedSlots || []).map(s => (
                    <div key={s.id} className="admin-mini-item">
                      <span>{s.date} {s.start}→{s.end} · {s.reason}</span>
                      <button className="admin-page-btn btn btn-sm btn-outline-light" onClick={() => deleteBlockedSlot(s.id)}>RIMUOVI</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users panel */}
        {tab === 'users' && !loading && (
          <div className="admin-panel active">
            <div className="admin-toolbar"><div className="admin-toolbar-title">CLIENTI E WALLET</div></div>
            <div className="admin-mini-list">
              {(data?.users || []).map(u => (
                <div key={u.id} className="admin-mini-item wrap">
                  <div>
                    <strong className="admin-item-title">{u.name}</strong>
                    <span className="admin-meta ms-2">@{u.username} · <ChipAmount amount={u.chips} size="xs" /></span>
                    {u.role === 'admin' && <span className="admin-role-badge">ADMIN</span>}
                  </div>
                  <div className="admin-item-actions">
                    <button className="admin-page-btn btn btn-sm btn-outline-light" onClick={() => patchUserChips(u.id, 12)}>+<ChipAmount amount={12} size="xs" /></button>
                    <button className="admin-page-btn btn btn-sm btn-outline-light" onClick={() => patchUserChips(u.id, -12)}>-<ChipAmount amount={12} size="xs" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Access panel */}
        {tab === 'access' && !loading && (
          <div className="admin-panel active">
            <div className="admin-toolbar"><div className="admin-toolbar-title">ACCESSO FISICO</div></div>
            <div className="admin-mini-list">
              <div className="admin-mini-item">
                <span>Codice cassaforte</span>
                <strong className="admin-lockbox-code">{data?.config?.lockboxCode || '—'}</strong>
              </div>
              <div className="admin-mini-item">
                <span>Slot bloccati</span>
                <strong>{(data?.blockedSlots || []).length}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Commerce panel */}
        {tab === 'commerce' && !loading && (
          <div className="admin-panel active">
            <div className="admin-toolbar"><div className="admin-toolbar-title">ADDON & SHOP</div></div>
            <div className="admin-card card admin-card-compact">
              <div className="admin-section-title">NUOVO ADDON</div>
              <div className="admin-addon-grid">
                <input className="form-input form-control" value={addonName} onChange={e => setAddonName(e.target.value)} placeholder="Nome addon" />
                <input className="form-input form-control" value={addonBrand} onChange={e => setAddonBrand(e.target.value)} placeholder="Brand" />
                <input className="form-input form-control" type="number" value={addonPrice} onChange={e => setAddonPrice(e.target.value)} placeholder="Chips" />
                <select className="form-input form-control" value={addonCategory} onChange={e => setAddonCategory(e.target.value as Addon['category'])}>
                  <option value="featured">Top</option>
                  <option value="modes">Mood</option>
                  <option value="snacks">Snack</option>
                </select>
                <input className="form-input form-control admin-addon-desc" value={addonDesc} onChange={e => setAddonDesc(e.target.value)} placeholder="Descrizione" />
                <button className="btn-neon btn btn-primary justify-content-center" onClick={createAddon}>CREA</button>
              </div>
            </div>
            <div className="admin-mini-list">
              {(data?.addons || []).map((a: Addon) => (
                <div key={a.id} className="admin-mini-item wrap">
                  <div>
                    <strong className="admin-item-title">{a.name}</strong>
                    <span className="admin-meta ms-2"><ChipAmount amount={a.price} size="xs" /> · {a.category}</span>
                    <span className={`admin-addon-status ${a.status === 'active' ? 'admin-status-active' : 'admin-meta'}`}>
                      {a.status?.toUpperCase()}
                    </span>
                  </div>
                  <div className="admin-item-actions">
                    <button className="admin-page-btn btn btn-sm btn-outline-light" onClick={() => toggleAddon(a)}>
                      {a.status === 'active' ? 'DISATTIVA' : 'ATTIVA'}
                    </button>
                    <button className="admin-page-btn btn btn-sm btn-outline-light danger" onClick={() => deleteAddon(a.id)}>
                      ELIMINA
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit panel */}
        {tab === 'audit' && !loading && (
          <div className="admin-panel active">
            <div className="admin-toolbar">
              <div>
                <div className="admin-toolbar-title">AUDIT LOG</div>
                <div className="admin-meta">
                  Eventi operativi reali: auth, booking, wallet, addon e modifiche admin.
                </div>
              </div>
            </div>
            <div className="admin-mini-list">
              {(data?.auditLog || []).slice(0, 50).map((entry, i: number) => (
                <div key={entry.id || i} className="admin-mini-item admin-audit-item">
                  <div>
                    <strong className="admin-item-title admin-audit-type">{formatAuditType(entry.type)}</strong>
                    <span className="admin-meta">{formatAuditDetails(entry.details)}</span>
                  </div>
                  <div className="admin-audit-time admin-meta">
                    <span>{new Date(entry.createdAt).toLocaleString('it-IT')}</span>
                    <span>uid:{entry.userId?.slice(0, 8) || 'system'}</span>
                  </div>
                </div>
              ))}
              {(data?.auditLog || []).length === 0 && (
                <div className="admin-empty">Nessun evento registrato.</div>
              )}
            </div>
          </div>
        )}

        {/* Documentazione panel */}
        {tab === 'docs' && (
          <div className="admin-panel active">
            <div className="admin-toolbar">
              <div>
                <div className="admin-toolbar-title">DOCUMENTAZIONE</div>
                <div className="admin-meta">
                  Documentazione tecnica e operativa completa (architettura, DB, API, deploy).
                </div>
              </div>
              <div className="admin-doc-actions">
              <button
                className="admin-page-btn btn btn-sm btn-outline-light doc-action"
                onClick={() => setDocPreviewOpen(true)}
              >
                <i className="fas fa-eye"></i> Apri anteprima
              </button>
              <a
                href="/docs/ROOMIE-Documentazione.docx"
                className="admin-page-btn btn btn-sm btn-outline-light doc-action"
              >
                <i className="fas fa-file-word"></i> Scarica .docx
              </a>
            </div>
            </div>
            {docPreviewOpen && (
              <SafeDocViewer
                active={tab === 'docs'}
                file={ADMIN_DOC.file}
                fallback={ADMIN_DOC.fallback}
                className="admin-doc-view"
                loadingLabel="Caricamento documento…"
                errorLabel="Impossibile renderizzare il documento in anteprima."
              />
            )}
          </div>
        )}

      </div>
    </div>
  )
}
