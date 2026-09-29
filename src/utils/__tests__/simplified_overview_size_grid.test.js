import { describe, it, expect } from 'vitest'
import { SIZE_CONFIGS } from '../../components/admin/overview/SimplifiedLiveOverview'

describe('Simplified Overview Size & Grid Scaling (เล็ก - กลาง - ใหญ่ - Extra)', () => {
    it('defines exactly the 4 required size presets', () => {
        expect(SIZE_CONFIGS).toBeDefined()
        const keys = Object.keys(SIZE_CONFIGS)
        expect(keys).toEqual(['sm', 'md', 'lg', 'xl'])
    })

    it('matches exact Thai labels requested by user: เล็ก - กลาง - ใหญ่ - Extra', () => {
        expect(SIZE_CONFIGS.sm.label).toBe('เล็ก')
        expect(SIZE_CONFIGS.md.label).toBe('กลาง')
        expect(SIZE_CONFIGS.lg.label).toBe('ใหญ่')
        expect(SIZE_CONFIGS.xl.label).toBe('Extra')
    })

    it('provides ascending font sizes for table names and bill amounts', () => {
        // Table Name typography
        expect(SIZE_CONFIGS.sm.tableName).toContain('text-lg')
        expect(SIZE_CONFIGS.md.tableName).toContain('text-xl')
        expect(SIZE_CONFIGS.lg.tableName).toContain('text-2xl')
        expect(SIZE_CONFIGS.xl.tableName).toContain('text-3xl')

        // Amount typography in card top
        expect(SIZE_CONFIGS.sm.headerAmount).toContain('text-sm')
        expect(SIZE_CONFIGS.md.headerAmount).toContain('text-base')
        expect(SIZE_CONFIGS.lg.headerAmount).toContain('text-xl')
        expect(SIZE_CONFIGS.xl.headerAmount).toContain('text-2xl')

        // Footer Total amount typography
        expect(SIZE_CONFIGS.sm.footerAmount).toContain('text-sm')
        expect(SIZE_CONFIGS.md.footerAmount).toContain('text-base')
        expect(SIZE_CONFIGS.lg.footerAmount).toContain('text-xl')
        expect(SIZE_CONFIGS.xl.footerAmount).toContain('text-2xl')
    })

    it('adjusts grid columns density appropriately for each size preset', () => {
        // sm: High density (2 on mobile, up to 6 on xl)
        expect(SIZE_CONFIGS.sm.gridCols).toContain('grid-cols-2')
        expect(SIZE_CONFIGS.sm.gridCols).toContain('xl:grid-cols-6')

        // md: Standard balanced (1 on mobile, 4 on xl)
        expect(SIZE_CONFIGS.md.gridCols).toContain('grid-cols-1')
        expect(SIZE_CONFIGS.md.gridCols).toContain('xl:grid-cols-4')

        // lg: Large & comfortable (1 on mobile, 3 on xl)
        expect(SIZE_CONFIGS.lg.gridCols).toContain('grid-cols-1')
        expect(SIZE_CONFIGS.lg.gridCols).toContain('xl:grid-cols-3')

        // xl (Extra): Wall TV / big monitor (1 on mobile, 2 on xl)
        expect(SIZE_CONFIGS.xl.gridCols).toContain('grid-cols-1')
        expect(SIZE_CONFIGS.xl.gridCols).toContain('xl:grid-cols-2')
    })

    it('scales list view table rows and action button padding consistently', () => {
        expect(SIZE_CONFIGS.sm.tableRowPadding).toBe('py-2 px-2.5')
        expect(SIZE_CONFIGS.md.tableRowPadding).toBe('py-3 px-3')
        expect(SIZE_CONFIGS.lg.tableRowPadding).toBe('py-3.5 px-3.5')
        expect(SIZE_CONFIGS.xl.tableRowPadding).toBe('py-4 px-4')

        expect(SIZE_CONFIGS.sm.tableActionBtn).toContain('text-[10px]')
        expect(SIZE_CONFIGS.md.tableActionBtn).toContain('text-[11px]')
        expect(SIZE_CONFIGS.lg.tableActionBtn).toContain('text-xs')
        expect(SIZE_CONFIGS.xl.tableActionBtn).toContain('text-sm')
    })
})
