
import { LayoutGrid, List as ListIcon } from 'lucide-react'

const ViewToggle = ({ mode, setMode }) => (
    <div className="flex bg-gray-200 rounded-lg p-1 gap-1">
        <button onClick={() => setMode('grid')} className={`p-2 rounded-md transition-all ${mode === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}>
            <LayoutGrid size={18} />
        </button>
        <button onClick={() => setMode('list')} className={`p-2 rounded-md transition-all ${mode === 'list' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'}`}>
            <ListIcon size={18} />
        </button>
    </div>
)

export default ViewToggle
