import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, Star } from 'lucide-react';

export function SortableMenuItem({ item, isMobile, onEdit, onDelete, isOverlay }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: item.id,
    data: { 
        category_id: item.category,
        is_recommended: item.is_recommended
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none'
  };

  if (isMobile) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className={`flex items-center gap-3 p-3 bg-white/5 border rounded-xl ${isOverlay ? 'border-[#DFFF00] shadow-xl bg-[#1a1a1a]' : 'border-white/10'}`}
      >
        {/* DRAG HANDLE */}
        <div {...attributes} {...listeners} className="text-gray-500 cursor-grab active:cursor-grabbing p-2">
            <GripVertical size={20} />
        </div>

        {/* CONTENT */}
        <img src={item.image_url || '/placeholder.png'} className="w-12 h-12 rounded-lg object-cover bg-gray-800" />
        <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate">{item.name}</h3>
            <div className="flex justify-between items-center">
                <p className="text-[#DFFF00] text-sm">{item.price}.-</p>
                {item.is_recommended && <Star size={14} fill="#DFFF00" className="text-[#DFFF00]" />}
            </div>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2">
           <button onClick={() => onEdit(item)} className="p-2 text-gray-400 hover:text-white"><Pencil size={16}/></button>
           <button onClick={() => onDelete(item.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>
        </div>
      </div>
    );
  }

  // Desktop Card View
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes} 
      {...listeners}
      className={`relative group bg-[#18181b] border rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing transition-all hover:border-white/20 ${isOverlay ? 'border-[#DFFF00] shadow-[0_0_30px_rgba(223,255,0,0.3)] z-50 scale-105' : 'border-white/10'}`}
    >
      <div className="aspect-[4/3] bg-gray-800 relative">
         <img src={item.image_url || '/placeholder.png'} className="w-full h-full object-cover" />
         {item.is_recommended && (
             <div className="absolute top-2 right-2 bg-[#DFFF00] text-black text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                <Star size={12} fill="black" /> Recommended
             </div>
         )}
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-lg text-white line-clamp-1">{item.name}</h3>
            <p className="text-[#DFFF00] font-mono text-lg">{item.price}</p>
        </div>
        <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">{item.category}</span>
             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onEdit(item)} className="p-2 hover:bg-white/10 rounded-lg text-gray-300 transition-colors"><Pencil size={18} /></button>
                <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onDelete(item.id)} className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"><Trash2 size={18} /></button>
             </div>
        </div>
      </div>
    </div>
  );
}
