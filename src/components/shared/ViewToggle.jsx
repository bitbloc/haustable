import { LayoutGrid, List as ListIcon } from 'lucide-react'

// Two 48px cells in one 1px frame, same height as the search box beside it.
// Brand tokens instead of grey / white (no pure white in product UI).
const ViewToggle = ({ mode, setMode }) => (
    <div className="flex shrink-0 border border-[var(--color-rule)] rounded-rams overflow-hidden bg-paper" role="group" aria-label="รูปแบบการแสดงเมนู">
        <button
            type="button"
            aria-label="แบบตาราง"
            aria-pressed={mode === 'grid'}
            onClick={() => setMode('grid')}
            className={`w-12 h-12 flex items-center justify-center transition-colors ${mode === 'grid' ? 'bg-ink text-paper' : 'text-subInk hover:text-ink'}`}
        >
            <LayoutGrid size={18} />
        </button>
        <button
            type="button"
            aria-label="แบบรายการ"
            aria-pressed={mode === 'list'}
            onClick={() => setMode('list')}
            className={`w-12 h-12 flex items-center justify-center border-l border-[var(--color-rule)] transition-colors ${mode === 'list' ? 'bg-ink text-paper' : 'text-subInk hover:text-ink'}`}
        >
            <ListIcon size={18} />
        </button>
    </div>
)

export default ViewToggle
