import { useState, useEffect } from 'react'
import { X, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function OptionSelectionModal({ item, onClose, onConfirm }) {
    const [quantity, setQuantity] = useState(1)
    const [selectedOptions, setSelectedOptions] = useState({})
    // Structure: { [groupId]: [choiceId1, choiceId2] }

    // Calculate Total Price
    const calculateTotal = () => {
        let optionsTotal = 0
        if (item.menu_item_options) {
            item.menu_item_options.forEach(optGroupRel => {
                const group = optGroupRel.option_groups
                const selections = selectedOptions[group.id] || []

                if (group.option_choices) {
                    group.option_choices.forEach(choice => {
                        if (selections.includes(choice.id)) {
                            optionsTotal += Number(choice.price_modifier)
                        }
                    })
                }
            })
        }
        return (item.price + optionsTotal) * quantity
    }

    const currentTotal = calculateTotal()

    const handleOptionToggle = (group, choiceId) => {
        const currentSelections = selectedOptions[group.id] || []

        if (group.selection_type === 'single') {
            setSelectedOptions({
                ...selectedOptions,
                [group.id]: [choiceId]
            })
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
                    return // Max reached
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
            const group = rel.option_groups
            if (group.is_required) {
                const selections = selectedOptions[group.id] || []
                if (selections.length < group.min_selection) {
                    alert(`Run: Please select at least ${group.min_selection} option(s) for ${group.name}`)
                    return false
                }
            }
        }
        return true
    }

    const handleConfirm = () => {
        if (validateSelections()) {
            // Prepare options summary for cart
            const optionsSummary = []
            if (item.menu_item_options) {
                item.menu_item_options.forEach(rel => {
                    const group = rel.option_groups
                    const selections = selectedOptions[group.id] || []
                    group.option_choices?.forEach(choice => {
                        if (selections.includes(choice.id)) {
                            optionsSummary.push({
                                group_name: group.name,
                                name: choice.name,
                                price: Number(choice.price_modifier)
                            })
                        }
                    })
                })
            }

            onConfirm({
                ...item,
                qty: quantity,
                selectedOptions: selectedOptions, // Raw IDs for logic
                optionsSummary: optionsSummary, // readable text for UI
                totalPricePerUnit: calculateTotal() / quantity // calculated unit price
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
                    <button onClick={onClose} className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-md">
                        <X size={20} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                        <h3 className="text-xl font-bold text-white">{item.name}</h3>
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
                                    <h4 className="font-bold text-lg">{group.name}</h4>
                                    <div className="text-xs text-gray-500">
                                        {group.is_required && <span className="text-red-500 font-bold mr-1">*Required</span>}
                                        {group.selection_type === 'single' ? 'Select 1' : `Select up to ${group.max_selection}`}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {group.option_choices?.sort((a, b) => a.display_order - b.display_order).map(choice => {
                                        const isSelected = currentSelections.includes(choice.id)
                                        return (
                                            <div
                                                key={choice.id}
                                                onClick={() => handleOptionToggle(group, choice.id)}
                                                className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer active:scale-[0.98] transition-all ${isSelected ? 'border-black bg-black text-white shadow-md' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-white' : 'border-gray-300'}`}>
                                                        {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                                                    </div>
                                                    <span className="font-medium text-sm">{choice.name}</span>
                                                </div>
                                                {Number(choice.price_modifier) > 0 && (
                                                    <span className={`text-xs ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>+{Number(choice.price_modifier)}</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-gray-100 bg-white safe-area-bottom">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <span className="font-bold text-gray-400 text-xs uppercase">Quantity</span>
                        <div className="flex items-center gap-4 bg-gray-100 rounded-full px-2 py-1">
                            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm disabled:opacity-50" disabled={quantity <= 1}><Minus size={16} /></button>
                            <span className="font-bold w-4 text-center">{quantity}</span>
                            <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm"><Plus size={16} /></button>
                        </div>
                    </div>

                    <button
                        onClick={handleConfirm}
                        className="w-full bg-black text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-transform flex justify-between px-6"
                    >
                        <span>Add to Order</span>
                        <span>{currentTotal}.-</span>
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
