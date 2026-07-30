import { useState, useEffect } from 'react'
import { X, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

export default function OptionSelectionModal({ item, onClose, onConfirm }) {
    const [quantity, setQuantity] = useState(1)
    const [selectedOptions, setSelectedOptions] = useState({})
    const [itemNote, setItemNote] = useState('')

    // Preselect single-choice options on load
    useEffect(() => {
        if (!item || !item.menu_item_options) return;
        const defaults = {};
        item.menu_item_options.forEach(rel => {
            const group = rel?.option_groups;
            if (group && group.is_required && group.selection_type === 'single' && group.option_choices && group.option_choices.length > 0) {
                const sortedChoices = [...group.option_choices].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
                defaults[group.id] = [sortedChoices[0].id];
            }
        });
        setSelectedOptions(defaults);
    }, [item]);

    // Calculate Total Price
    const calculateTotal = () => {
        let optionsTotal = 0
        if (item.menu_item_options) {
            item.menu_item_options.forEach(optGroupRel => {
                const group = optGroupRel?.option_groups
                if (!group) return
                const selections = selectedOptions[group.id] || []

                if (group.option_choices) {
                    group.option_choices.forEach(choice => {
                        if (selections.includes(choice.id)) {
                            optionsTotal += Number(choice.price_modifier || 0)
                        }
                    })
                }
            })
        }
        return ((item.price || 0) + optionsTotal) * quantity
    }

    const currentTotal = calculateTotal()

    const handleOptionToggle = (group, choiceId) => {
        const currentSelections = selectedOptions[group.id] || []

        if (group.selection_type === 'single') {
            // Check if already selected - if so, deselect it unless it is required
            if (currentSelections.includes(choiceId)) {
                if (!group.is_required) {
                    setSelectedOptions({
                        ...selectedOptions,
                        [group.id]: []
                    })
                }
            } else {
                setSelectedOptions({
                    ...selectedOptions,
                    [group.id]: [choiceId]
                })
            }
        } else {
            // Multiple
            if (currentSelections.includes(choiceId)) {
                setSelectedOptions({
                    ...selectedOptions,
                    [group.id]: currentSelections.filter(id => id !== choiceId)
                })
            } else {
                // Check max selection
                if (group.max_selection > 0 && currentSelections.length >= group.max_selection) {
                    toast.error(`เลือกได้สูงสุด ${group.max_selection} รายการ`)
                    return
                }
                setSelectedOptions({
                    ...selectedOptions,
                    [group.id]: [...currentSelections, choiceId]
                })
            }
        }
    }

    const validateSelections = () => {
        if (!item.menu_item_options) return true

        for (const rel of item.menu_item_options) {
            const group = rel?.option_groups
            if (!group) continue
            if (group.is_required) {
                const selections = selectedOptions[group.id] || []
                if (selections.length < (group.min_selection || 1)) {
                    toast.error(`กรุณาเลือกตัวเลือกสำหรับ "${group.name}"`)
                    return false
                }
            }
        }
        return true
    }

    const handleConfirm = () => {
        if (validateSelections()) {
            // Prepare options summary for cart and slips
            const optionsSummary = []
            if (item.menu_item_options) {
                item.menu_item_options.forEach(rel => {
                    const group = rel?.option_groups
                    if (!group) return
                    const selections = selectedOptions[group.id] || []
                    group.option_choices?.forEach(choice => {
                        if (selections.includes(choice.id)) {
                            optionsSummary.push({
                                group_id: group.id,
                                group_name: group.name,
                                choice_id: choice.id,
                                name: choice.name,
                                price: Number(choice.price_modifier || 0)
                            })
                        }
                    })
                })
            }

            if (itemNote.trim()) {
                optionsSummary.push({
                    group_name: 'หมายเหตุ',
                    name: itemNote.trim(),
                    price: 0
                })
            }

            const unitPrice = calculateTotal() / quantity;

            onConfirm({
                ...item,
                quantity: quantity,
                qty: quantity,
                price: unitPrice,
                selected_options: optionsSummary,
                selectedOptions: selectedOptions, // Raw IDs for logic
                optionsSummary: optionsSummary, // readable text for UI
                item_note: itemNote.trim(),
                itemNote: itemNote.trim(),
                totalPricePerUnit: unitPrice
            })
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                onClick={onClose}
            />

            {/* Modal Card */}
            <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-0 shadow-2xl z-10 pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header Image */}
                <div className="relative h-48 bg-gray-100 shrink-0">
                    {item.image_url ? (
                        <img src={item.image_url} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">No Image</div>
                    )}
                    <button onClick={onClose} className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white w-10 h-10 flex items-center justify-center rounded-full backdrop-blur-md shadow-lg z-20">
                        <X size={24} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        <h3 className="text-xl font-bold text-white pr-12">{item.name}</h3>
                        <p className="text-gray-300 text-sm">{item.description}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {item.menu_item_options?.sort((a, b) => a.display_order - b.display_order).map(rel => {
                        const group = rel.option_groups
                        const currentSelections = selectedOptions[group.id] || []
                        const isSatisfied = (!group.is_required) || (currentSelections.length >= group.min_selection)

                        return (
                            <div key={group.id} className="space-y-3">
                                <div className="flex justify-between items-baseline border-b border-gray-100 pb-1">
                                    <h4 className="font-bold text-lg text-zinc-900">{group.name}</h4>
                                    <div className="text-xs text-zinc-500">
                                        {group.is_required && <span className="text-red-500 font-bold mr-1">*Required</span>}
                                        {group.selection_type === 'single' ? 'Select 1' : `Select up to ${group.max_selection}`}
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    {group.option_choices?.sort((a, b) => a.display_order - b.display_order).map(choice => {
                                        const isSelected = currentSelections.includes(choice.id)
                                        return (
                                            <div
                                                key={choice.id}
                                                onClick={() => handleOptionToggle(group, choice.id)}
                                                className={`flex justify-between items-center p-3.5 rounded-xl border cursor-pointer active:scale-[0.98] transition-all select-none touch-manipulation min-h-[48px] ${isSelected ? 'border-[oklch(52%_0.16_28)] bg-[oklch(52%_0.16_28)] text-white shadow-md' : 'border-gray-200 bg-white hover:bg-gray-50 text-zinc-900'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-white' : 'border-gray-300'}`}>
                                                        {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                                                    </div>
                                                    <span className={`font-bold text-base ${isSelected ? 'text-white' : 'text-zinc-900'}`}>{choice.name}</span>
                                                </div>
                                                {Number(choice.price_modifier) > 0 && (
                                                    <span className={`font-mono text-sm font-bold ${isSelected ? 'text-white/90' : 'text-gray-600'}`}>+{Number(choice.price_modifier)}</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}

                    {/* Special Note / Kitchen Instructions */}
                    <div className="space-y-2 pt-3 border-t border-gray-100">
                        <label className="block font-bold text-base text-zinc-900 flex items-center justify-between">
                            <span>📝 หมายเหตุเพิ่มเติมถึงครัว (Special Note)</span>
                            <span className="text-xs text-zinc-400 font-normal">ไม่บังคับ</span>
                        </label>
                        <input
                            type="text"
                            placeholder="เช่น เผ็ดน้อย, แยกน้ำซุป, ไม่ใส่ผักชี"
                            value={itemNote}
                            onChange={(e) => setItemNote(e.target.value)}
                            className="w-full bg-zinc-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[oklch(52%_0.16_28)] focus:bg-white transition-all font-medium touch-manipulation"
                        />
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-gray-100 bg-white safe-area-bottom text-zinc-950 touch-manipulation select-none">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <span className="font-bold text-zinc-500 text-xs font-mono uppercase">Quantity</span>
                        <div className="flex items-center gap-4 bg-zinc-100 rounded-full px-3 py-1.5">
                            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-xs disabled:opacity-50 text-zinc-800 hover:bg-zinc-50 cursor-pointer touch-manipulation active:scale-95 transition-transform" disabled={quantity <= 1}><Minus size={18} /></button>
                            <span className="font-mono font-bold w-6 text-center text-lg text-zinc-900">{quantity}</span>
                            <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-xs text-zinc-800 hover:bg-zinc-50 cursor-pointer touch-manipulation active:scale-95 transition-transform"><Plus size={18} /></button>
                        </div>
                    </div>

                    <button
                        onClick={handleConfirm}
                        className="w-full bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white py-4 rounded-xl font-bold shadow-lg active:scale-98 transition-transform flex justify-between px-6 text-base cursor-pointer touch-manipulation"
                    >
                        <span>Add to Order</span>
                        <span className="font-mono">{currentTotal}.-</span>
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
