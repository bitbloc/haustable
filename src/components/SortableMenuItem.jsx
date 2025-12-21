import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Edit2, Trash2, GripVertical, Image as ImageIcon } from 'lucide-react';

export function SortableMenuItem({ item, isMobile, onEdit, onDelete }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    if (isMobile) {
        // Mobile List View with Drag Handle
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="flex items-center gap-3 bg-[#1a1a1a] p-3 rounded-xl border border-white/5 mb-3"
            >
                {/* Drag Handle */}
                <div {...attributes} {...listeners} className="text-gray-500 p-2 touch-none">
                    <GripVertical size={20} />
                </div>

                {/* Image */}
                <div className="w-12 h-12 rounded-lg bg-gray-800 overflow-hidden shrink-0">
                    {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600"><ImageIcon size={16}/></div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-white truncate">{item.name}</h4>
                        {!item.is_available && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 rounded-full">หมด</span>}
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400">
                        <span>{item.price}.-</span>
                        <span className="text-[#DFFF00] uppercase tracking-wider">{item.category}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                    <button onClick={() => onEdit(item)} className="p-2 text-gray-400 hover:text-white"><Edit2 size={16} /></button>
                    {/* Delete is risky in list view, maybe hide or confirm? Keeping it for now. */}
                    <button onClick={() => onDelete(item.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
            </div>
        );
    }

    // Desktop Grid View (Entire Card is Draggable)
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="group bg-[#111] border border-white/5 rounded-2xl p-4 hover:border-white/20 transition-all flex gap-4 items-center relative overflow-hidden cursor-grab active:cursor-grabbing"
        >
             {/* VIP Badge */}
             {item.is_recommended && (
                <div className="absolute top-0 right-0 bg-[#DFFF00] text-black text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                    VIP
                </div>
            )}

            {/* Image */}
            <div className="w-20 h-20 rounded-xl bg-gray-800 overflow-hidden shrink-0">
                {item.image_url ? (
                    <img src={item.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600"><ImageIcon /></div>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#DFFF00] mb-1 block">{item.category}</span>
                    {!item.is_available && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">หมด</span>}
                </div>
                <h3 className="font-bold text-white truncate">{item.name}</h3>
                <p className="text-gray-400">{item.price}.-</p>
            </div>

            {/* Actions (Hover to show - MUST stop propagation to prevent drag start) */}
            <div 
                className="absolute right-4 bottom-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0"
                onPointerDown={(e) => e.stopPropagation()} // Important!
            >
                <button onClick={() => onEdit(item)} className="p-2 bg-gray-800 hover:bg-white hover:text-black text-white rounded-full transition-colors"><Edit2 size={14} /></button>
                <button onClick={() => onDelete(item.id)} className="p-2 bg-gray-800 hover:bg-red-500 text-white rounded-full transition-colors"><Trash2 size={14} /></button>
            </div>
        </div>
    );
}
