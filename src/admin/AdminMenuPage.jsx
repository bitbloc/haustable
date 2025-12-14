import { useState } from 'react'
import { LayoutGrid, List, Layers } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

import OptionGroupList from './components/OptionGroupList'
import MenuCategoryList from './components/MenuCategoryList'
import MenuItemList from './components/MenuItemList'

export default function AdminMenuPage() {
    const [activeTab, setActiveTab] = useState('menu_items')

    const tabs = [
        { id: 'menu_items', label: 'Menu Items', icon: LayoutGrid },
        { id: 'categories', label: 'Categories', icon: List },
        { id: 'option_groups', label: 'Option Groups', icon: Layers },
    ]

    return (
        <div className="min-h-screen bg-black pb-20">
            {/* Header */}
            <header className="bg-[#111] border-b border-white/10 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link to="/admin" className="text-gray-400 hover:text-white transition-colors">
                            ← Dashboard
                        </Link>
                        <h1 className="text-xl font-bold text-white">Menu Management</h1>
                    </div>
                </div>

                {/* Tabs */}
                <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto no-scrollbar">
                    {tabs.map(tab => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${isActive ? 'border-[#DFFF00] text-[#DFFF00]' : 'border-transparent text-gray-500 hover:text-white'}`}
                            >
                                <Icon size={18} />
                                <span className="font-bold text-sm">{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
            </header>

            {/* Content Area */}
            <main className="max-w-5xl mx-auto px-4 py-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {activeTab === 'menu_items' && <MenuItemList />}
                        {activeTab === 'categories' && <MenuCategoryList />}
                        {activeTab === 'option_groups' && <OptionGroupList />}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    )
}
