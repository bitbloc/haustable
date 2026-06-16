import React, { useState } from 'react';
import { X, Plus, GripVertical, Trash2, Check, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

const EMOJI_OPTIONS = ['☕', '🧊', '🍵', '🥤', '🍸', '🍹', '🥃', '🧃', '🍺', '🫖', '🥛', '🍶', '🧋', '🍻', '🫗', '📋'];

/**
 * SOPCategoryManager — Modal to CRUD SOP categories
 */
export default function SOPCategoryManager({ 
    categories = [], 
    onSave, 
    onDelete, 
    onClose 
}) {
    const [items, setItems] = useState(
        categories.map((c, i) => ({ ...c, sort_order: c.sort_order ?? i }))
    );
    const [editingId, setEditingId] = useState(null);
    const [editLabel, setEditLabel] = useState('');
    const [editIcon, setEditIcon] = useState('📋');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // New item
    const [isAdding, setIsAdding] = useState(false);
    const [newId, setNewId] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newIcon, setNewIcon] = useState('📋');

    const handleAdd = async () => {
        const id = newId.trim().toLowerCase().replace(/\s+/g, '_');
        if (!id || !newLabel.trim()) {
            toast.error('กรุณากรอกข้อมูลให้ครบ');
            return;
        }

        if (items.find(c => c.id === id)) {
            toast.error('ID ซ้ำ');
            return;
        }

        const category = {
            id,
            label: newLabel.trim(),
            icon: newIcon,
            department: 'bar',
            sort_order: items.length,
            is_active: true
        };

        const result = await onSave?.(category);
        if (result) {
            setItems(prev => [...prev, result]);
            setNewId('');
            setNewLabel('');
            setNewIcon('📋');
            setIsAdding(false);
        }
    };

    const handleEdit = async (item) => {
        const updated = { ...item, label: editLabel, icon: editIcon };
        const result = await onSave?.(updated);
        if (result) {
            setItems(prev => prev.map(c => c.id === item.id ? { ...c, ...result } : c));
            setEditingId(null);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('ลบหมวดหมู่นี้? SOP ที่อยู่ในหมวดนี้จะถูกย้ายเป็น uncategorized')) return;
        const ok = await onDelete?.(id);
        if (ok) {
            setItems(prev => prev.filter(c => c.id !== id));
        }
    };

    const moveItem = (index, direction) => {
        const newItems = [...items];
        const swapIndex = index + direction;
        if (swapIndex < 0 || swapIndex >= newItems.length) return;
        
        [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];
        
        // Update sort orders
        const reordered = newItems.map((item, i) => ({ ...item, sort_order: i }));
        setItems(reordered);

        // Save sort order
        reordered.forEach(item => {
            onSave?.({ ...item });
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg">🏷️ จัดการหมวดหมู่ SOP</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {items.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl group">
                            {/* Reorder */}
                            <div className="flex items-center gap-1 mr-1">
                                <button 
                                    onClick={() => moveItem(index, -1)}
                                    className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-purple-600 disabled:opacity-20 flex items-center justify-center text-xs font-bold transition-colors"
                                    disabled={index === 0}
                                    title="ย้ายขึ้น"
                                >▲</button>
                                <button 
                                    onClick={() => moveItem(index, 1)}
                                    className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-purple-600 disabled:opacity-20 flex items-center justify-center text-xs font-bold transition-colors"
                                    disabled={index === items.length - 1}
                                    title="ย้ายลง"
                                >▼</button>
                            </div>

                            {/* Icon */}
                            <div className="text-2xl select-none flex-shrink-0 flex items-center justify-center min-w-[2.5rem]">
                                {item.icon}
                            </div>

                            {/* Label */}
                            {editingId === item.id ? (
                                <div className="flex-1 flex gap-2">
                                    {/* Emoji selector */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="w-10 h-10 bg-white border rounded-lg text-xl flex items-center justify-center"
                                        >
                                            {editIcon}
                                        </button>
                                        {showEmojiPicker && (
                                            <div className="absolute z-10 top-12 left-0 bg-white shadow-xl rounded-xl p-2 grid grid-cols-4 gap-1 border">
                                                {EMOJI_OPTIONS.map(em => (
                                                    <button
                                                        key={em}
                                                        onClick={() => { setEditIcon(em); setShowEmojiPicker(false); }}
                                                        className="w-10 h-10 rounded-lg hover:bg-gray-100 text-xl flex items-center justify-center"
                                                    >
                                                        {em}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        value={editLabel}
                                        onChange={e => setEditLabel(e.target.value)}
                                        className="flex-1 p-2 border rounded-lg text-sm font-bold"
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => handleEdit(item)}
                                        className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center hover:bg-green-200"
                                    >
                                        <Check size={16} />
                                    </button>
                                    <button
                                        onClick={() => setEditingId(null)}
                                        className="w-10 h-10 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-gray-200"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-bold text-sm text-gray-800 block truncate">{item.label}</span>
                                        <span className="text-[10px] text-gray-400 block truncate">{item.id}</span>
                                    </div>
                                    <button
                                        onClick={() => { setEditingId(item.id); setEditLabel(item.label); setEditIcon(item.icon); }}
                                        className="p-2 text-gray-400 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                    >
                                        <Edit2 size={15} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}

                    {items.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                            ยังไม่มีหมวดหมู่ กดปุ่ม "เพิ่ม" ด้านล่าง
                        </div>
                    )}
                </div>

                {/* Add New */}
                <div className="p-4 border-t bg-gray-50">
                    {isAdding ? (
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const idx = EMOJI_OPTIONS.indexOf(newIcon);
                                        setNewIcon(EMOJI_OPTIONS[(idx + 1) % EMOJI_OPTIONS.length]);
                                    }}
                                    className="w-12 h-12 flex-shrink-0 bg-white border rounded-xl text-2xl flex items-center justify-center hover:bg-gray-50"
                                >
                                    {newIcon}
                                </button>
                                <div className="flex-1 space-y-2">
                                    <input
                                        value={newLabel}
                                        onChange={e => {
                                            setNewLabel(e.target.value);
                                            if (!newId || newId === newLabel.trim().toLowerCase().replace(/\s+/g, '_')) {
                                                setNewId(e.target.value.trim().toLowerCase().replace(/\s+/g, '_'));
                                            }
                                        }}
                                        className="w-full p-2 border rounded-lg text-sm font-bold"
                                        placeholder="ชื่อหมวด เช่น Smoothie"
                                        autoFocus
                                    />
                                    <input
                                        value={newId}
                                        onChange={e => setNewId(e.target.value)}
                                        className="w-full p-2 border rounded-lg text-xs text-gray-500"
                                        placeholder="ID เช่น smoothie"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsAdding(false)}
                                    className="flex-1 py-2 bg-gray-200 rounded-xl font-bold text-gray-600 text-sm"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleAdd}
                                    className="flex-1 py-2 bg-[#1A1A1A] text-white rounded-xl font-bold text-sm"
                                >
                                    เพิ่มหมวด
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-3 bg-[#1A1A1A] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors"
                        >
                            <Plus size={18} /> เพิ่มหมวดหมู่
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
