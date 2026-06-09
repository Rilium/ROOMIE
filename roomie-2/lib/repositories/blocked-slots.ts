import { sqlClient } from '@/lib/db/client'
import { rowToBlockedSlot } from '@/lib/db/mappers'
import type { BlockedSlot } from '@/lib/types'

export async function listBlockedSlots(): Promise<BlockedSlot[]> {
  const sql = sqlClient()
  const rows = await sql`SELECT * FROM blocked_slots ORDER BY date, start_time`
  return rows.map(rowToBlockedSlot)
}

export async function createBlockedSlot(data: {
  id: string
  date: string
  start: string
  end: string
  reason: string
  createdBy?: string
}): Promise<BlockedSlot> {
  const sql = sqlClient()
  const rows = await sql`
    WITH
      slot_locks AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(
          hashtextextended(CONCAT('Via Terni', ':', lock_date::date::text), 0)
        )
        FROM generate_series(
          ${data.date}::date - INTERVAL '1 day',
          ${data.date}::date + INTERVAL '1 day',
          INTERVAL '1 day'
        ) AS dates(lock_date)
        ORDER BY lock_date
      ),
      candidate AS (
        SELECT
          (${data.date}::date + ${data.start}::time) AS start_ts,
          CASE
            WHEN ${data.end}::time <= ${data.start}::time
              THEN (${data.date}::date + ${data.end}::time + INTERVAL '1 day')
            ELSE (${data.date}::date + ${data.end}::time)
          END AS end_ts
      ),
      booking_conflict AS (
        SELECT b.id
        FROM bookings b
        CROSS JOIN candidate c
        WHERE b.date BETWEEN (${data.date}::date - INTERVAL '1 day') AND (${data.date}::date + INTERVAL '1 day')
          AND b.status NOT IN ('cancelled')
          AND c.start_ts < CASE
            WHEN b.end_time <= b.start_time
              THEN (b.date + b.end_time + INTERVAL '1 day')
            ELSE (b.date + b.end_time)
          END
          AND c.end_ts > (b.date + b.start_time)
        LIMIT 1
      ),
      blocked_conflict AS (
        SELECT s.id
        FROM blocked_slots s
        CROSS JOIN candidate c
        WHERE s.date BETWEEN (${data.date}::date - INTERVAL '1 day') AND (${data.date}::date + INTERVAL '1 day')
          AND c.start_ts < CASE
            WHEN s.end_time <= s.start_time
              THEN (s.date + s.end_time + INTERVAL '1 day')
            ELSE (s.date + s.end_time)
          END
          AND c.end_ts > (s.date + s.start_time)
        LIMIT 1
      ),
      availability AS (
        SELECT
          NOT EXISTS (SELECT 1 FROM booking_conflict)
          AND NOT EXISTS (SELECT 1 FROM blocked_conflict) AS slot_ok
        FROM slot_locks
        LIMIT 1
      )
    INSERT INTO blocked_slots (id, date, start_time, end_time, reason, created_by)
    SELECT
      ${data.id},
      ${data.date}::date,
      ${data.start}::time,
      ${data.end}::time,
      ${data.reason},
      ${data.createdBy ?? null}
    WHERE (SELECT slot_ok FROM availability)
    RETURNING *
  `
  if (!rows[0]) throw new Error('SLOT_BLOCKED')
  return rowToBlockedSlot(rows[0])
}

export async function deleteBlockedSlot(id: string): Promise<void> {
  const sql = sqlClient()
  await sql`DELETE FROM blocked_slots WHERE id = ${id}`
}
