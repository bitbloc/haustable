import { useState, useEffect } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

export default function OptionSelectionModal({ item, onClose, onConfirm }) {
    const [quantity, setQuantity] = useState(1)
    const [selectedOptions, setSelectedOptions] = useState({})
    const [itemNote, setItemNote] = useState('')

    // Preselect single-choice options on load (only available choices)
    useEffect(() => {
        if (!item || !item.menu_item_options) return;
        const defaults = {};
        item.menu_item_options.forEach(rel => {
            const group = rel?.option_groups;
            if (group && group.is_required && group.selection_type === 'single' && group.option_choices && group.option_choices.length > 0) {
                const sortedChoices = [...group.option_choices]
                    .filter(c => c.is_available !== false)
                    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
                if (sortedChoices.length > 0) {
                    defaults[group.id] = [sortedChoices[0].id];
                }
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
                    setSelectedOptions(prev => ({
                        ...prev,
                        [group.id]: []
                    }))
                }
            } else {
                setSelectedOptions(prev => ({
                    ...prev,
                    [group.id]: [choiceId]
                }))
            }
        } else {
            // Multiple
            if (currentSelections.includes(choiceId)) {
                setSelectedOptions(prev => ({
                    ...prev,
                    [group.id]: currentSelections.filter(id => id !== choiceId)
                }))
            } else {
                // Check max selection
                if (group.max_selection > 0 && currentSelections.length >= group.max_selection) {
                    toast.error(`เลือกได้สูงสุด ${group.max_selection} รายการ`)
                    return
                }
                setSelectedOptions(prev => ({
                    ...prev,
                    [group.id]: [...currentSelections, choiceId]
                }))
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
            {/* Backdrop - Removed blur for performance */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 bg-[var(--color-ink)]/40 pointer-events-auto"
                onClick={onClose}
            />

            {/* Modal Card - Dieter Rams tabular layout */}
            <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-md bg-[var(--color-paper)] border-t sm:border border-[var(--color-rule)] sm:rounded-sm z-10 pointer-events-auto flex flex-col max-h-[90vh] shadow-xl will-change-transform"
            >
                {/* Header (Text only, no heavy image gradient) */}
                <div className="flex items-start justify-between p-4 border-b border-[var(--color-rule)] bg-[var(--color-paper)] shrink-0">
                    <div className="pr-4">
                        <h3 className="text-xl font-bold text-[var(--color-ink)] leading-tight">{item.name}</h3>
                        {item.description && <p className="text-[var(--color-neutral)] text-sm mt-1">{item.description}</p>}
                    </div>
                    <button onClick={onClose} className="shrink-0 p-2 text-[var(--color-neutral)] hover:text-[var(--color-ink)] active:bg-[var(--color-paper-2)] border border-[var(--color-rule)] touch-manipulation">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-[var(--color-paper-2)]">
                    {item.menu_item_options?.sort((a, b) => a.display_order - b.display_order).map(rel => {
                        const group = rel.option_groups
                        const currentSelections = selectedOptions[group.id] || []
                        
                        return (
                            <div key={group.id} className="mb-2 bg-[var(--color-paper)] border-b border-[var(--color-rule)]">
                                <div className="flex justify-between items-baseline p-4 border-b border-[var(--color-rule)] bg-[var(--color-paper)]">
                                    <h4 className="font-bold text-base text-[var(--color-ink)]">{group.name}</h4>
                                    <div className="text-xs text-[var(--color-neutral)] font-mono">
                                        {group.is_required && <span className="text-[var(--color-accent)] font-bold mr-1">*REQ</span>}
                                        {group.selection_type === 'single' ? 'SEL 1' : `MAX ${group.max_selection}`}
                                    </div>
                                </div>

                                <div className="flex flex-col">
                                    {group.option_choices?.sort((a, b) => a.display_order - b.display_order).map((choice, index) => {
                                        const isSoldOut = choice.is_available === false;
                                        const isSelected = currentSelections.includes(choice.id)
                                        const isLast = index === group.option_choices.length - 1;
                                        return (
                                            <div
                                                key={choice.id}
                                                onClick={() => {
                                                    if (!isSoldOut) handleOptionToggle(group, choice.id);
                                                }}
                                                className={`flex justify-between items-center p-4 select-none touch-manipulation ${
                                                    isSoldOut 
                                                        ? 'opacity-40 cursor-not-allowed bg-gray-50' 
                                                        : 'cursor-pointer active:bg-[var(--color-paper-2)]'
                                                } ${!isLast ? 'border-b border-[var(--color-rule)]' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${group.selection_type === 'single' ? 'rounded-full' : 'rounded-sm'} border ${isSelected ? 'border-[var(--color-ink)]' : 'border-[var(--color-rule)]'}`}>
                                                        {isSelected && <div className={`w-2.5 h-2.5 bg-[var(--color-ink)] ${group.selection_type === 'single' ? 'rounded-full' : 'rounded-sm'}`} />}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-base ${isSelected ? 'font-bold text-[var(--color-ink)]' : 'text-[var(--color-ink)]'}`}>{choice.name}</span>
                                                        {isSoldOut && (
                                                            <span className="text-[10px] font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-sm">
                                                                หมด
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {Number(choice.price_modifier) > 0 && (
                                                    <span className={`font-mono text-sm ${isSelected ? 'font-bold text-[var(--color-ink)]' : 'text-[var(--color-neutral)]'}`}>
                                                        +{Number(choice.price_modifier)}
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}

                    {/* Special Note */}
                    <div className="bg-[var(--color-paper)] border-b border-[var(--color-rule)] mb-8">
                        <label className="flex items-center justify-between p-4 border-b border-[var(--color-rule)]">
                            <span className="font-bold text-base text-[var(--color-ink)]">Special Note</span>
                            <span className="text-xs text-[var(--color-neutral)] font-mono">OPTIONAL</span>
                        </label>
                        <div className="p-4">
                            <input
                                type="text"
                                placeholder="E.g. Less spicy, no cilantro"
                                value={itemNote}
                                onChange={(e) => setItemNote(e.target.value)}
                                className="w-full bg-[var(--color-paper-2)] border border-[var(--color-rule)] px-4 py-3 text-base text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-ink)] touch-manipulation"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-[var(--color-rule)] bg-[var(--color-paper)] safe-area-bottom shrink-0 touch-manipulation select-none flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--color-neutral)] text-sm font-mono uppercase">Quantity</span>
                        <div className="flex items-center border border-[var(--color-rule)] bg-[var(--color-paper)]">
                            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-12 h-12 flex items-center justify-center text-[var(--color-ink)] disabled:opacity-30 active:bg-[var(--color-paper-2)] touch-manipulation" disabled={quantity <= 1}><Minus size={18} /></button>
                            <span className="font-mono font-bold w-10 text-center text-lg text-[var(--color-ink)]">{quantity}</span>
                            <button onClick={() => setQuantity(quantity + 1)} className="w-12 h-12 flex items-center justify-center text-[var(--color-ink)] active:bg-[var(--color-paper-2)] touch-manipulation border-l border-[var(--color-rule)]"><Plus size={18} /></button>
                        </div>
                    </div>

                    <button
                        onClick={handleConfirm}
                        className="w-full bg-[var(--color-ink)] hover:bg-[var(--color-ink)]/90 text-[var(--color-paper)] py-4 font-bold flex justify-between px-6 text-base cursor-pointer touch-manipulation active:scale-[0.99] transition-transform"
                    >
                        <span>ADD TO ORDER</span>
                        <span className="font-mono">{currentTotal}.-</span>
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
