'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/app/context/AppContext'
import {
  apiAdminSummary, apiAdminPatchConfig, apiAdminPatchBookingStatus,
  apiAdminPatchUserChips, apiAdminBlockSlot, apiAdminDeleteBlockedSlot,
  apiAdminCreateAddon, apiAdminPatchAddon, apiAdminDeleteAddon,
} from '@/lib/client-api'
import type { Booking, AppConfig, Addon } from '@/lib/types'

type Tab = 'bookings' | 'users' | 'access' | 'commerce' | 'audit'

interface SummaryData {
  bookings: Booking[]
  users: any[]
  addons: Addon[]
  addonOrders: any[]
  blockedSlots: any[]
  auditLog: any[]
  config: AppConfig
  stats: { revenue: number; bookingsCount: number; usersCount: number; pendingCount: number; revenueRoom: number; revenueAddon: number }
}

export default function AdminPage() {
  const { user, setConfig, showToast } = useApp()
  const [tab, setTab] = useState<Tab>('bookings')
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

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
    const cfg: Partial<AppConfig> = {
      hourlyPrice: parseInt(priceHour) || 12,
      dayPrice: parseInt(priceDay) || 60,
      guestPassPrice: parseInt(priceGuest) || 2,
      maxPeople: parseInt(maxPeople) || 8,
      lockboxCode: lockboxCode.trim(),
    }
    const { error } = await apiAdminPatchConfig(cfg)
    if (error) { showToast({ title: error, type: 'warn' }); return }
    setConfig(cfg as AppConfig)
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
    await apiAdminPatchUserChips(id, delta)
    showToast({ title: `${delta > 0 ? '+' : ''}${delta} chips` })
    load()
  }

  const stats = data?.stats

  if (!user || user.role !== 'admin') return (
    <div className="page active" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)' }}>
      Accesso negato.
    </div>
  )

  return (
    <div className="page active" id="page-admin">
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--orange)', marginBottom: '4px' }}>ADMIN PANEL</div>
            <h2 style={{ fontFamily: '\'Bebas Neue\',sans-serif', fontSize: '2.5rem', color: '#fff', lineHeight: '1' }}>ROOM VIA TERNI</h2>
          </div>
          <div className="flex gap-8 flex-wrap">
            <div className="admin-user-pill"><span><i className="fas fa-user-shield"></i></span><strong>{user.name}</strong></div>
            {stats && <>
              <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 16px', fontSize: '.8rem' }}>
                <span style={{ color: 'var(--muted)' }}>Revenue mese</span><br />
                <span style={{ fontFamily: '\'Bebas Neue\',sans-serif', fontSize: '1.5rem', color: 'var(--neon)' }}>{stats.revenue} chips</span>
              </div>
              <div style={{ background: 'var(--dark2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 16px', fontSize: '.8rem' }}>
                <span style={{ color: 'var(--muted)' }}>Sessioni</span><br />
                <span style={{ fontFamily: '\'Bebas Neue\',sans-serif', fontSize: '1.5rem', color: '#fff' }}>{stats.bookingsCount}</span>
              </div>
            </>}
          </div>
        </div>

        {/* Stats grid */}
        {stats && (
          <div className="admin-grid">
            <div className="admin-card"><div className="admin-card-label">Revenue</div><div className="admin-card-value neon">{stats.revenue} chips</div></div>
            <div className="admin-card"><div className="admin-card-label">Prenotazioni</div><div className="admin-card-value">{stats.bookingsCount}</div></div>
            <div className="admin-card"><div className="admin-card-label">Utenti</div><div className="admin-card-value">{stats.usersCount}</div></div>
            <div className="admin-card"><div className="admin-card-label">In attesa</div><div className="admin-card-value" style={{ color: 'var(--orange)' }}>{stats.pendingCount}</div></div>
          </div>
        )}

        {/* Tabs */}
        <div className="admin-tabs">
          {(['bookings', 'users', 'access', 'commerce', 'audit'] as Tab[]).map(t => (
            <button key={t} className={`admin-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              <i className={`fas ${t === 'bookings' ? 'fa-calendar-check' : t === 'users' ? 'fa-users' : t === 'access' ? 'fa-key' : t === 'commerce' ? 'fa-shopping-bag' : 'fa-shield-alt'}`}></i>
              {' '}{t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {loading && <div style={{ color: 'var(--muted)', padding: '24px', textAlign: 'center' }}>Caricamento...</div>}

        {/* Bookings panel */}
        {tab === 'bookings' && !loading && (
          <div className="admin-panel active">
            <div className="admin-toolbar">
              <div style={{ fontWeight: 900, color: '#fff', fontSize: '.9rem' }}>PRENOTAZIONI</div>
            </div>
            <div>
              {(data?.bookings || []).map(b => (
                <div key={b.id} className="admin-mini-item" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ color: '#fff' }}>{b.date} {b.start}→{b.end}</strong>
                    <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>{b.totalChips} chips · {b.people} pers.</span>
                    <span className="status-badge" style={{ marginLeft: '8px', fontSize: '.7rem' }}>{b.status}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {b.status === 'pending' && (
                      <button className="admin-page-btn" style={{ background: 'rgba(200,255,0,.15)', borderColor: 'var(--neon)', color: 'var(--neon)' }} onClick={() => patchBookingStatus(b.id, 'confirmed')}>CONFERMA</button>
                    )}
                    {['pending', 'confirmed'].includes(b.status) && (
                      <button className="admin-page-btn" style={{ background: 'rgba(255,50,50,.1)', borderColor: 'rgba(255,50,50,.4)', color: '#ff5555' }} onClick={() => patchBookingStatus(b.id, 'cancelled')}>ANNULLA</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Config */}
            <div className="admin-card" style={{ marginTop: '20px' }}>
              <div style={{ fontWeight: 900, color: '#fff', marginBottom: '12px' }}>CONFIG PREZZI</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div><label className="form-label">ORA</label><input type="number" className="form-input" value={priceHour} onChange={e => setPriceHour(e.target.value)} style={{ width: '110px' }} /></div>
                <div><label className="form-label">GIORNATA</label><input type="number" className="form-input" value={priceDay} onChange={e => setPriceDay(e.target.value)} style={{ width: '110px' }} /></div>
                <div><label className="form-label">GUEST PASS</label><input type="number" className="form-input" value={priceGuest} onChange={e => setPriceGuest(e.target.value)} style={{ width: '110px' }} /></div>
                <div><label className="form-label">MAX PERSONE</label><input type="number" className="form-input" value={maxPeople} onChange={e => setMaxPeople(e.target.value)} style={{ width: '110px' }} /></div>
                <div><label className="form-label">CODICE CASSAFORTE</label><input className="form-input" value={lockboxCode} onChange={e => setLockboxCode(e.target.value)} style={{ width: '140px' }} /></div>
                <button className="btn-neon" onClick={saveConfig}>SALVA</button>
              </div>
            </div>

            {/* Block slot */}
            <div className="admin-card" style={{ marginTop: '20px' }}>
              <div style={{ fontWeight: 900, color: '#fff', marginBottom: '12px' }}>BLOCCA SLOT</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div><label className="form-label">DATA</label><input type="date" className="form-input" value={blockDate} onChange={e => setBlockDate(e.target.value)} style={{ width: '160px' }} /></div>
                <div><label className="form-label">DALLE</label><input type="time" className="form-input" value={blockStart} onChange={e => setBlockStart(e.target.value)} style={{ width: '110px' }} /></div>
                <div><label className="form-label">ALLE</label><input type="time" className="form-input" value={blockEnd} onChange={e => setBlockEnd(e.target.value)} style={{ width: '110px' }} /></div>
                <div style={{ flex: 1, minWidth: '140px' }}><label className="form-label">MOTIVO</label><input type="text" className="form-input" value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="Es. Manutenzione" /></div>
                <button style={{ background: 'rgba(255,90,31,.15)', border: '1px solid rgba(255,90,31,.5)', color: 'var(--orange)', borderRadius: '8px', padding: '10px 16px', fontWeight: 900, fontSize: '.85rem' }} onClick={blockSlot}>BLOCCA</button>
              </div>
              {(data?.blockedSlots || []).length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  {(data?.blockedSlots || []).map((s: any) => (
                    <div key={s.id} className="admin-mini-item">
                      <span>{s.date} {s.start}→{s.end} · {s.reason}</span>
                      <button className="admin-page-btn" onClick={() => deleteBlockedSlot(s.id)}>RIMUOVI</button>
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
            <div className="admin-toolbar"><div style={{ fontWeight: 900, color: '#fff' }}>CLIENTI E WALLET</div></div>
            <div className="admin-mini-list">
              {(data?.users || []).map((u: any) => (
                <div key={u.id} className="admin-mini-item" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ color: '#fff' }}>{u.name}</strong>
                    <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>@{u.username} · {u.chips} chips</span>
                    {u.role === 'admin' && <span style={{ color: 'var(--orange)', marginLeft: '8px', fontSize: '.72rem', fontWeight: 900 }}>ADMIN</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="admin-page-btn" onClick={() => patchUserChips(u.id, 12)}>+12 chips</button>
                    <button className="admin-page-btn" onClick={() => patchUserChips(u.id, -12)}>-12 chips</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Access panel */}
        {tab === 'access' && !loading && (
          <div className="admin-panel active">
            <div className="admin-toolbar"><div style={{ fontWeight: 900, color: '#fff' }}>ACCESSO FISICO</div></div>
            <div className="admin-mini-list">
              <div className="admin-mini-item">
                <span>Codice cassaforte</span>
                <strong style={{ color: 'var(--neon)', fontFamily: '\'Barlow Condensed\',sans-serif', fontSize: '1.4rem' }}>{data?.config?.lockboxCode || '—'}</strong>
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
            <div className="admin-toolbar"><div style={{ fontWeight: 900, color: '#fff' }}>ADDON & SHOP</div></div>
            <div className="admin-card" style={{ marginBottom: '14px' }}>
              <div style={{ fontWeight: 900, color: '#fff', marginBottom: '12px' }}>NUOVO ADDON</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: '10px' }}>
                <input className="form-input" value={addonName} onChange={e => setAddonName(e.target.value)} placeholder="Nome addon" />
                <input className="form-input" value={addonBrand} onChange={e => setAddonBrand(e.target.value)} placeholder="Brand" />
                <input className="form-input" type="number" value={addonPrice} onChange={e => setAddonPrice(e.target.value)} placeholder="Chips" />
                <select className="form-input" value={addonCategory} onChange={e => setAddonCategory(e.target.value as any)}>
                  <option value="featured">Top</option>
                  <option value="modes">Mood</option>
                  <option value="snacks">Snack</option>
                </select>
                <input className="form-input" value={addonDesc} onChange={e => setAddonDesc(e.target.value)} placeholder="Descrizione" style={{ gridColumn: 'span 2' }} />
                <button className="btn-neon" style={{ justifyContent: 'center' }} onClick={createAddon}>CREA</button>
              </div>
            </div>
            <div className="admin-mini-list">
              {(data?.addons || []).map((a: Addon) => (
                <div key={a.id} className="admin-mini-item" style={{ flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ color: '#fff' }}>{a.name}</strong>
                    <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>{a.price} chips · {a.category}</span>
                    <span style={{ marginLeft: '8px', color: a.status === 'active' ? 'var(--neon)' : 'var(--muted)', fontSize: '.72rem', fontWeight: 900 }}>
                      {a.status?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="admin-page-btn" onClick={() => toggleAddon(a)}>
                      {a.status === 'active' ? 'DISATTIVA' : 'ATTIVA'}
                    </button>
                    <button className="admin-page-btn" style={{ background: 'rgba(255,50,50,.1)', borderColor: 'rgba(255,50,50,.4)', color: '#ff5555' }} onClick={() => deleteAddon(a.id)}>
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
            <div className="admin-toolbar"><div style={{ fontWeight: 900, color: '#fff' }}>AUDIT LOG</div></div>
            <div className="admin-mini-list">
              {(data?.auditLog || []).slice(0, 50).map((entry: any, i: number) => (
                <div key={i} className="admin-mini-item" style={{ fontSize: '.78rem' }}>
                  <span style={{ color: 'var(--muted)' }}>{new Date(entry.at).toLocaleString('it-IT')}</span>
                  <span style={{ color: 'var(--text)' }}>{entry.event}</span>
                  <span style={{ color: 'var(--muted)' }}>uid:{entry.userId?.slice(0, 8)}</span>
                </div>
              ))}
              {(data?.auditLog || []).length === 0 && (
                <div style={{ color: 'var(--muted)', padding: '16px' }}>Nessun evento registrato.</div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
