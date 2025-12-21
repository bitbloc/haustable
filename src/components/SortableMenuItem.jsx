import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, Star, Lock } from 'lucide-react';

export function SortableMenuItem({ item, isMobile, onEdit, onDelete, isOverlay }) {
  const isRecommended = item.is_recommended;

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef, // แยกตัวจับลากออกจากกล่องหลัก
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: item.id,
    disabled: isRecommended, // Disable Drag for Recommend items (Fixed position)
    data: { 
        category_id: item.category,
        is_recommended: isRecommended
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none'
  };

  // 🎨 Style Config
  const baseCardStyle = "relative bg-[#18181b] border rounded-2xl overflow-hidden transition-all";
  const recommendCardStyle = "relative bg-neutral-900 border-neutral-800 rounded-2xl overflow-hidden opacity-90"; // ตัวเทา
  
  const currentStyle = isRecommended ? recommendCardStyle : baseCardStyle;
  const currentBorder = isOverlay ? 'border-[#DFFF00] shadow-[0_0_30px_rgba(223,255,0,0.3)] scale-105 z-50' : (isRecommended ? 'border-neutral-800' : 'border-white/10 hover:border-white/20');

  // --- Mobile Rendering ---
  if (isMobile) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className={`flex items-center gap-3 p-3 rounded-xl border ${currentBorder} ${isRecommended ? 'bg-neutral-900' : 'bg-white/5'}`}
      >
        {/* DRAG HANDLE (Only for Regular Items) */}
        {!isRecommended ? (
            <div 
                ref={setActivatorNodeRef} 
                {...attributes} 
                {...listeners} 
                className="text-gray-500 cursor-grab active:cursor-grabbing p-2 hover:text-white"
            >
                <GripVertical size={20} />
            </div>
        ) : (
            <div className="p-2 text-gray-700">
                <Lock size={16} />
            </div>
        )}

        {/* CONTENT */}
        <img src={item.image_url || '/placeholder.png'} className={`w-12 h-12 rounded-lg object-cover ${isRecommended ? 'grayscale-[0.5]' : ''}`} />
        <div className="flex-1 min-w-0">
            <h3 className={`font-bold truncate ${isRecommended ? 'text-gray-400' : 'text-white'}`}>{item.name}</h3>
            <div className="flex justify-between items-center">
                <p className={`text-sm ${isRecommended ? 'text-gray-500' : 'text-[#DFFF00]'}`}>{item.price}.-</p>
                {isRecommended && <div className="text-[10px] bg-neutral-800 text-gray-500 px-2 py-0.5 rounded border border-neutral-700">FIXED</div>}
            </div>
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2">
           <button onClick={() => onEdit(item)} className="p-2 text-gray-500 hover:text-white transition-colors"><Pencil size={16}/></button>
           {!isRecommended && <button onClick={() => onDelete(item.id)} className="p-2 text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>}
        </div>
      </div>
    );
  }

  // --- Desktop Rendering ---
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group ${currentStyle} ${currentBorder}`}
    >
        {/* Drag Handle (Desktop) - 6 Dots at Top Right Corner */}
        {!isRecommended && (
             <div 
                ref={setActivatorNodeRef}
                {...attributes} 
                {...listeners}
                className="absolute top-2 right-2 z-20 cursor-grab active:cursor-grabbing p-2 bg-black/50 backdrop-blur-md rounded-lg text-white/50 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100"
             >
                <GripVertical size={16} />
             </div>
        )}

      <div className={`aspect-[4/3] relative ${isRecommended ? 'bg-neutral-800' : 'bg-gray-800'}`}>
         <img src={item.image_url || '/placeholder.png'} className={`w-full h-full object-cover transition-all ${isRecommended ? 'grayscale-[0.5] opacity-70' : ''}`} />
         
         {isRecommended && (
             <div className="absolute top-2 right-2 bg-neutral-800/90 backdrop-blur border border-white/5 text-gray-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                <Star size={12} className="text-gray-500" fill="currentColor" /> Recommend
             </div>
         )}
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
            <h3 className={`font-bold text-lg line-clamp-1 ${isRecommended ? 'text-gray-400' : 'text-white'}`}>{item.name}</h3>
            <p className={`font-mono text-lg ${isRecommended ? 'text-gray-500' : 'text-[#DFFF00]'}`}>{item.price}</p>
        </div>
        
        <div className="flex justify-between items-center mt-4 border-t border-white/5 pt-3">
            <span className="text-xs text-gray-600 uppercase tracking-wider font-medium">{item.category}</span>
             <div className="flex gap-1">
                <button onClick={() => onEdit(item)} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"><Pencil size={16} /></button>
                {!isRecommended && <button onClick={() => onDelete(item.id)} className="p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={16} /></button>}
             </div>
        </div>
      </div>
    </div>
  );
}
