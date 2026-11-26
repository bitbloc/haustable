import { describe, it, expect, vi } from 'vitest'
vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))
import { summarizeAiUsage, compareToGemini, monthBounds } from '../aiCost'

const row = (day, source, model, calls, thb, usd) => ({ day, source, model, feature: 'x', calls, cost_thb: thb, cost_usd: usd })

describe('summarizeAiUsage', () => {
    it('returns calls 0 when nothing was logged', () => {
        expect(summarizeAiUsage([], '2026-11', '2026-11-26')).toEqual({ calls: 0 })
    })
    it('waits for 3 days before projecting', () => {
        const s = summarizeAiUsage([row('2026-11-26', 'haustable', 'claude-opus-5-5', 4, 10, 0.3)], '2026-11', '2026-11-27')
        expect(s.daysTracked).toBe(2)
        expect(s.projection).toBeNull()
        expect(s.daysUntilProjection).toBe(1)
    })
    it('projects the current month from the per-day average, quiet days included', () => {
        const rows = [
            row('2026-12-01', 'haustable', 'claude-opus-5-5', 2, 6, 0.18),
            row('2026-12-03', 'yuzu', 'claude-haiku-5-5', 10, 3, 0.09),
        ]
        const s = summarizeAiUsage(rows, '2026-12', '2026-12-03')
        expect(s.daysTracked).toBe(3)
        expect(s.perDay).toBeCloseTo(3)
        expect(s.projection).toBeCloseTo(93)
        expect(s.bySource.map((r) => r.label)).toEqual(['Haustable', 'Yuzu (HR)'])
        expect(s.byModel[0].label).toMatch(/^Opus/)
        expect(s.calls).toBe(12)
    })
    it('scales a past month to its full length', () => {
        const s = summarizeAiUsage([row('2026-11-26', 'haustable', 'claude-opus-5-5', 1, 5, 0.15)], '2026-11', '2026-12-10')
        expect(s.daysTracked).toBe(5)
        expect(s.projection).toBeCloseTo(30)
    })
})

describe('compareToGemini / monthBounds', () => {
    it('gives the share of the Gemini figure', () => {
        expect(compareToGemini(50, 200)).toBe(25)
        expect(compareToGemini(null, 200)).toBeNull()
        expect(compareToGemini(50, null)).toBeNull()
    })
    it('knows month lengths', () => {
        expect(monthBounds('2026-02').daysInMonth).toBe(28)
        expect(monthBounds('2026-11').to).toBe('2026-11-30')
    })
})
