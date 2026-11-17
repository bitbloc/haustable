import { describe, it, expect, vi } from 'vitest'
vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn(), channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })) } }))
import { formatSeatedDuration } from '../../pos/POSTableGrid'

const norm = (s) => s.replace(/ /g, ' ')
const start = new Date('2026-11-17T11:00:00+07:00')
const at = (mins) => start.getTime() + mins * 60000

describe('formatSeatedDuration (table tile "นั่งมา")', () => {
    it('shows minutes under an hour', () => {
        expect(norm(formatSeatedDuration(start.toISOString(), at(12)))).toBe('12 นาที')
    })
    it('shows hours and minutes', () => {
        expect(formatSeatedDuration(start.toISOString(), at(72))).toBe('1ชม.12น.')
        expect(norm(formatSeatedDuration(start.toISOString(), at(120)))).toBe('2 ชม.')
    })
    it('never goes negative or breaks on bad input', () => {
        expect(norm(formatSeatedDuration(start.toISOString(), at(-5)))).toBe('0 นาที')
        expect(formatSeatedDuration('not a date')).toBe('-')
    })
})
