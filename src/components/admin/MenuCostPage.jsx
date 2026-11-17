/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { fetchAndSortMenu } from '../../utils/menuHelper';
import { calculateRecipeCost } from '../../utils/costUtils';
import { buildLiveCostResolver } from '../../utils/recipeGraph';
import RecipeReadinessPanel from './RecipeReadinessPanel';
import RecipeUnitCheckPanel from './RecipeUnitCheckPanel';
import { useNavigate } from 'react-router-dom';
import RecipeBuilder from '../recipes/RecipeBuilder';
import './MenuCostPage.css';

export default function MenuCostPage({ isEmbedded = false, onOpenMethod = null }) {
    const navigate = useNavigate();
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [targetFoodCostPct, setTargetFoodCostPct] = useState(30);

    // Recipe Builder Modal State
    const [isRecipeOpen, setIsRecipeOpen] = useState(false);
    const [recipeTarget, setRecipeTarget] = useState(null);

    // Sorting & Filtering State
    const [sortConfig, setSortConfig] = useState({ key: 'category', direction: 'asc' });
    const [filterMode, setFilterMode] = useState('all'); // 'all', 'has_recipe', 'missing_recipe', 'high_cost', 'low_margin'
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewLayout, setViewLayout] = useState('auto'); // 'auto', 'table', 'cards'

    const loadData = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            // 1. Fetch Menu Items (force refresh cache to catch recent updates)
            const { menuItems: data } = await fetchAndSortMenu(true);

            // 2. Fetch Store Settings for target food cost %
            try {
                const { data: settings } = await supabase
                    .from('store_settings')
                    .select('target_food_cost_pct')
                    .single();
                if (settings?.target_food_cost_pct) {
                    setTargetFoodCostPct(Number(settings.target_food_cost_pct));
                }
            } catch (settingsErr) {
                console.warn('Could not load store_settings target_food_cost_pct:', settingsErr);
            }

            // 3. Fetch All Recipe Links (bulk calculation)
            const { data: recipeLinks, error: recipeErr } = await supabase
                .from('recipe_ingredients')
                .select(`
                    parent_menu_item_id,
                    ingredient_id,
                    quantity,
                    unit,
                    ingredient:stock_items!recipe_ingredients_ingredient_id_fkey (
                        id, name, cost_price, pack_size, pack_unit, usage_unit, conversion_factor, yield_percent
                    )
                `);

            if (recipeErr) {
                console.error('Error fetching recipe ingredients:', recipeErr);
            }

            // Made items (prep, per-glass recipes) are costed from their own ingredients at
            // today's prices instead of the cost saved when their recipe was last edited.
            const [{ data: allStock }, { data: nestedRows }] = await Promise.all([
                supabase.from('stock_items').select('*'),
                supabase.from('recipe_ingredients')
                    .select('parent_stock_item_id, ingredient_id, quantity')
                    .not('parent_stock_item_id', 'is', null)
            ]);
            const liveCost = buildLiveCostResolver(allStock || [], nestedRows || []);

            // 4. Map Recipe to Menu ID
            const recipesByMenu = {};
            if (recipeLinks) {
                recipeLinks.forEach(link => {
                    const mid = link.parent_menu_item_id;
                    if (mid) {
                        const midStr = String(mid);
                        if (!recipesByMenu[midStr]) {
                            recipesByMenu[midStr] = [];
                        }
                        recipesByMenu[midStr].push({
                            ingredient_id: link.ingredient_id,
                            ingredient: link.ingredient,
                            quantity: link.quantity,
                            unit: link.unit
                        });
                    }
                });
            }

            // 5. Calculate Costs and margins
            const enrichedItems = (data || []).map(item => {
                const ingredients = recipesByMenu[String(item.id)] || [];
                const breakdown = calculateRecipeCost(
                    ingredients,
                    (id) => liveCost.getItem(id) || ingredients.find(i => i.ingredient_id === id)?.ingredient,
                    { qFactorPercent: item.q_factor_percent || 0 }
                );

                const cost = breakdown.totalCost;
                const price = Number(item.price) || 0;
                const profit = price - cost;
                const margin = price > 0 ? (profit / price) * 100 : 0;
                const costPercent = price > 0 ? (cost / price) * 100 : 0;

                return {
                    ...item,
                    cost,
                    profit,
                    margin,
                    costPercent,
                    ingredientCount: ingredients.length,
                    hasRecipe: ingredients.length > 0
                };
            });

            setMenuItems(enrichedItems);
        } catch (err) {
            console.error('MenuCostPage loadData error:', err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        loadData(true);

        let debounceTimer = null;
        const debouncedReload = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (!isRecipeOpen) {
                    loadData(false);
                }
            }, 400);
        };

        const channel = supabase
            .channel('admin-menu-cost-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, debouncedReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'recipe_ingredients' }, debouncedReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, debouncedReload)
            .subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [isRecipeOpen]);

    // Strategic KPI Metrics calculation
    const metrics = useMemo(() => {
        const totalItems = menuItems.length;
        const itemsWithRecipe = menuItems.filter(i => i.hasRecipe);
        const recipeCount = itemsWithRecipe.length;
        const missingRecipeCount = totalItems - recipeCount;
        const coveragePct = totalItems > 0 ? (recipeCount / totalItems) * 100 : 0;

        let totalCostPct = 0;
        let totalMarginPct = 0;
        let totalProfit = 0;
        let highCostCount = 0;
        let lowMarginCount = 0;

        itemsWithRecipe.forEach(item => {
            totalCostPct += item.costPercent;
            totalMarginPct += item.margin;
            totalProfit += item.profit;

            if (item.costPercent > 35) {
                highCostCount++;
            }
            if (item.margin < 50) {
                lowMarginCount++;
            }
        });

        const avgFoodCost = recipeCount > 0 ? totalCostPct / recipeCount : 0;
        const avgMargin = recipeCount > 0 ? totalMarginPct / recipeCount : 0;
        const avgProfit = recipeCount > 0 ? totalProfit / recipeCount : 0;

        return {
            totalItems,
            recipeCount,
            missingRecipeCount,
            coveragePct,
            avgFoodCost,
            avgMargin,
            avgProfit,
            highCostCount,
            lowMarginCount
        };
    }, [menuItems]);

    // Unique Categories for Filter Strip
    const categories = useMemo(() => {
        const set = new Set();
        menuItems.forEach(i => {
            if (i.category && typeof i.category === 'string') {
                set.add(i.category.trim());
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
    }, [menuItems]);

    // Sort handling
    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // Filter and Sort Process
    const processedItems = useMemo(() => {
        let list = [...menuItems];

        // 1. Text Search (name or category)
        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            list = list.filter(i =>
                (i.name && i.name.toLowerCase().includes(q)) ||
                (i.category && i.category.toLowerCase().includes(q))
            );
        }

        // 2. Category Filter
        if (selectedCategory !== 'ALL') {
            list = list.filter(i => i.category === selectedCategory);
        }

        // 3. Status Filter Mode
        if (filterMode === 'has_recipe') {
            list = list.filter(i => i.hasRecipe);
        } else if (filterMode === 'missing_recipe') {
            list = list.filter(i => !i.hasRecipe);
        } else if (filterMode === 'high_cost') {
            list = list.filter(i => i.hasRecipe && i.costPercent > 35);
        } else if (filterMode === 'low_margin') {
            list = list.filter(i => i.hasRecipe && i.margin < 50);
        }

        // 4. Sorting
        list.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();

            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;

            return (a.name || '').localeCompare(b.name || '', 'th');
        });

        return list;
    }, [menuItems, searchTerm, selectedCategory, filterMode, sortConfig]);

    // Sorted by category (the default): one charcoal band per category, so each group reads as a block.
    // Sorted by anything else the categories are mixed, so each row keeps its own category tag instead.
    const groupedByCategory = sortConfig.key === 'category';
    const categoryGroups = useMemo(() => {
        if (!groupedByCategory) return [{ key: 'all', name: null, items: processedItems }];
        const groups = [];
        processedItems.forEach(item => {
            const name = (item.category || '').trim() || 'ไม่ระบุหมวด';
            const last = groups[groups.length - 1];
            if (last && last.name === name) last.items.push(item);
            else groups.push({ key: name, name, items: [item] });
        });
        return groups;
    }, [processedItems, groupedByCategory]);

    // Digital Export: UTF-8 CSV with BOM for Windows Excel Thai compatibility
    const handleExportCSV = () => {
        if (!menuItems || menuItems.length === 0) return;

        const headers = [
            'รหัสเมนู (ID)',
            'ชื่อเมนู (Menu Name)',
            'หมวดหมู่ (Category)',
            'ราคาขาย (THB)',
            'ต้นทุนวัตถุดิบ (THB)',
            'กำไรขั้นต้น (THB)',
            'สัดส่วนต้นทุน % (Food Cost %)',
            'อัตรากำไร % (Margin %)',
            'สถานะสูตร (Recipe Status)',
            'จำนวนวัตถุดิบในสูตร'
        ];

        const rows = processedItems.map(item => {
            const statusStr = item.hasRecipe ? 'มีสูตรมาตรฐาน' : 'ยังไม่ผูกสูตร';
            const costVal = item.hasRecipe ? item.cost.toFixed(2) : '0.00';
            const profitVal = item.hasRecipe ? item.profit.toFixed(2) : '0.00';
            const costPctVal = item.hasRecipe ? item.costPercent.toFixed(1) : '0.0';
            const marginVal = item.hasRecipe ? item.margin.toFixed(1) : '0.0';

            return [
                `"${item.id}"`,
                `"${(item.name || '').replace(/"/g, '""')}"`,
                `"${(item.category || '').replace(/"/g, '""')}"`,
                item.price || 0,
                costVal,
                profitVal,
                costPctVal,
                marginVal,
                `"${statusStr}"`,
                item.ingredientCount || 0
            ].join(',');
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const nowStr = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `food_costing_report_${nowStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleOpenRecipe = (item) => {
        setRecipeTarget(item);
        setIsRecipeOpen(true);
    };

    return (
        <div className={`${isEmbedded ? '' : 'min-h-screen bg-[var(--color-paper)]'} text-[var(--color-ink)] font-sans`}>
            {/* Top Bar / Header */}
            <div className={`${isEmbedded ? 'mb-4' : 'sticky top-0 z-30 bg-[var(--color-paper)] border-b border-[var(--color-rule)]'}`}>
                <div className={`p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 ${isEmbedded ? '' : 'max-w-7xl mx-auto'}`}>
                    <div className="flex items-center gap-3">
                        {!isEmbedded && (
                            <button
                                onClick={() => navigate('/admin')}
                                className="admin-btn h-9"
                            >
                                ← กลับ
                            </button>
                        )}
                        <div>
                            <h2 className="text-base font-semibold text-[var(--color-ink)]">
                                ต้นทุนเมนู
                            </h2>
                            <p className="text-[13px] text-[var(--color-neutral)] tabular-nums mt-0.5">
                                วิเคราะห์สัดส่วนต้นทุนวัตถุดิบ (COGS) อัตรากำไรขั้นต้น และความคุ้มค่าราคาขายต่อหน่วย
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        {/* View Mode Segmented Controls */}
                        <div className="flex items-center border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-0.5 rounded-xs tabular-nums text-xs">
                            <button
                                onClick={() => setViewLayout('table')}
                                className={`px-2 py-1 transition-colors ${
                                    viewLayout === 'table'
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold'
                                        : 'text-[var(--color-muted)] hover:bg-[var(--color-paper-3)]'
                                }`}
                                title="แสดงแบบตารางละเอียด"
                            >
                                ตาราง
                            </button>
                            <button
                                onClick={() => setViewLayout('cards')}
                                className={`px-2 py-1 transition-colors ${
                                    viewLayout === 'cards'
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] font-bold'
                                        : 'text-[var(--color-muted)] hover:bg-[var(--color-paper-3)]'
                                }`}
                                title="แสดงแบบการ์ดขนาดกะทัดรัด"
                            >
                                การ์ด
                            </button>
                        </div>

                        <button
                            onClick={handleExportCSV}
                            disabled={menuItems.length === 0}
                            className="admin-btn h-9 disabled:opacity-40"
                            title="ดาวน์โหลดข้อมูลเป็นไฟล์ Excel / CSV"
                        >
                            <span className="text-[var(--brand-plum)] font-bold">↓</span>
                            <span>EXPORT CSV</span>
                        </button>
                        <button
                            onClick={() => loadData(true)}
                            disabled={loading}
                            className="admin-btn h-9 disabled:opacity-40"
                            title="รีเฟรชข้อมูลล่าสุด"
                        >
                            <span className={`tabular-nums ${loading ? 'animate-spin inline-block' : ''}`}>↻</span>
                            <span>รีเฟรช</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className={`${isEmbedded ? '' : 'max-w-7xl mx-auto p-4'} space-y-5 pb-20`}>

                <RecipeReadinessPanel
                    menuItems={menuItems}
                    onOpenRecipe={handleOpenRecipe}
                    onLinked={() => loadData(false)}
                />

                <RecipeUnitCheckPanel
                    onOpenRecipe={(issue) => {
                        const menu = menuItems.find(m => m.id === issue.parentId);
                        if (menu) handleOpenRecipe(menu);
                    }}
                    onFixed={() => loadData(false)}
                />

                {/* 4 Strategic F&B KPI Cards (Dieter Rams Tabular Structure) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Card 1: Recipe Coverage */}
                    <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-3.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="tabular-nums text-xs text-[var(--color-neutral)] font-bold">
                                ครอบคลุมสูตรมาตรฐาน
                            </span>
                            <span className="tabular-nums text-[11px] px-1.5 py-0.5 bg-[var(--color-paper-3)] text-[var(--color-muted)] rounded-xs">
                                COVERAGE
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 my-1">
                            <span className="text-2xl tabular-nums font-bold tracking-tight text-[var(--color-ink)]">
                                {metrics.coveragePct.toFixed(1)}%
                            </span>
                            <span className="tabular-nums text-xs text-[var(--color-neutral)]">
                                ({metrics.recipeCount}/{metrics.totalItems})
                            </span>
                        </div>
                        {/* Visual Progress Bar */}
                        <div className="w-full bg-[var(--color-paper-3)] h-1.5 rounded-full overflow-hidden mt-2 mb-1.5">
                            <div
                                className="h-full bg-[var(--brand-plum)] transition-all duration-300"
                                style={{ width: `${Math.min(100, metrics.coveragePct)}%` }}
                            />
                        </div>
                        <div className="tabular-nums text-xs text-[var(--color-neutral)]">
                            {metrics.missingRecipeCount > 0 ? (
                                <span className="text-[var(--brand-plum)]">รอผูกสูตรอีก {metrics.missingRecipeCount} เมนู</span>
                            ) : (
                                <span className="text-[oklch(38%_0.08_140)]">ผูกสูตรครบ 100% ทุกรายการ</span>
                            )}
                        </div>
                    </div>

                    {/* Card 2: Average Food Cost % */}
                    <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-3.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="tabular-nums text-xs text-[var(--color-neutral)] font-bold">
                                ต้นทุนอาหารเฉลี่ย
                            </span>
                            <span className={`tabular-nums text-[11px] px-1.5 py-0.5 rounded-xs font-bold ${
                                metrics.avgFoodCost <= targetFoodCostPct
                                    ? 'bg-[oklch(90%_0.04_140)] text-[oklch(35%_0.08_140)]'
                                    : metrics.avgFoodCost <= 35
                                    ? 'bg-[oklch(90%_0.05_70)] text-[oklch(40%_0.10_70)]'
                                    : 'bg-[oklch(90%_0.06_348.33)] text-[var(--brand-plum)]'
                            }`}>
                                {metrics.avgFoodCost <= targetFoodCostPct ? 'OPTIMAL' : metrics.avgFoodCost <= 35 ? 'WATCH' : 'HIGH'}
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 my-1">
                            <span className={`text-2xl tabular-nums font-bold tracking-tight ${
                                metrics.avgFoodCost <= targetFoodCostPct
                                    ? 'text-[oklch(35%_0.08_140)]'
                                    : metrics.avgFoodCost <= 35
                                    ? 'text-[oklch(40%_0.10_70)]'
                                    : 'text-[var(--brand-plum)]'
                            }`}>
                                {metrics.avgFoodCost.toFixed(1)}%
                            </span>
                            <span className="tabular-nums text-xs text-[var(--color-neutral)]">
                                (Food Cost)
                            </span>
                        </div>
                        <div className="tabular-nums text-xs text-[var(--color-neutral)] mt-2">
                            เป้าหมายมาตรฐานร้าน: {targetFoodCostPct.toFixed(0)}% (28 - 32%)
                        </div>
                    </div>

                    {/* Card 3: High Cost Alert (> 35%) */}
                    <div
                        onClick={() => setFilterMode(current => current === 'high_cost' ? 'all' : 'high_cost')}
                        className={`border p-3.5 flex flex-col justify-between cursor-pointer transition-colors ${
                            filterMode === 'high_cost'
                                ? 'border-[var(--brand-plum)] bg-[oklch(92%_0.04_348.33)]'
                                : 'border-[var(--color-rule)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)]'
                        }`}
                        title="คลิกเพื่อกรองเฉพาะเมนูที่ต้นทุนสูงเกิน 35%"
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="tabular-nums text-xs text-[var(--color-neutral)] font-bold">
                                03 / ต้นทุนสูงเกินเกณฑ์ (&gt;35%)
                            </span>
                            <span className="tabular-nums text-[11px] px-1.5 py-0.5 bg-[oklch(90%_0.06_348.33)] text-[var(--brand-plum)] rounded-xs font-bold">
                                ALERT
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 my-1">
                            <span className={`text-2xl tabular-nums font-bold tracking-tight ${metrics.highCostCount > 0 ? 'text-[var(--brand-plum)]' : 'text-[var(--color-ink)]'}`}>
                                {metrics.highCostCount}
                            </span>
                            <span className="tabular-nums text-xs text-[var(--color-neutral)]">รายการ</span>
                        </div>
                        <div className="tabular-nums text-xs text-[var(--color-neutral)] mt-2">
                            {filterMode === 'high_cost' ? (
                                <span className="text-[var(--brand-plum)] font-bold">กำลังแสดงตัวกรองนี้</span>
                            ) : (
                                <span>คลิกเพื่อดูเมนูที่ควรปรับสูตรหรือราคา</span>
                            )}
                        </div>
                    </div>

                    {/* Card 4: Gross Profit Margin % */}
                    <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-3.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="tabular-nums text-xs text-[var(--color-neutral)] font-bold">
                                กำไรขั้นต้นเฉลี่ย
                            </span>
                            <span className="tabular-nums text-[11px] px-1.5 py-0.5 bg-[oklch(90%_0.04_140)] text-[oklch(35%_0.08_140)] rounded-xs font-bold">
                                MARGIN
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2 my-1">
                            <span className="text-2xl tabular-nums font-bold tracking-tight text-[var(--color-ink)]">
                                {metrics.avgMargin.toFixed(1)}%
                            </span>
                            <span className="tabular-nums text-xs text-[var(--color-neutral)]">
                                (Gross Profit)
                            </span>
                        </div>
                        <div className="tabular-nums text-xs text-[var(--color-neutral)] mt-2">
                            กำไรเฉลี่ย ฿{metrics.avgProfit.toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / หน่วยขาย
                        </div>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-3 space-y-3">
                    <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
                        {/* Search */}
                        <div className="flex-1 min-w-[200px] flex items-center border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-1.5">
                            <span className="tabular-nums text-xs text-[var(--color-neutral)] mr-2">FIND:</span>
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อเมนูหรือหมวดหมู่..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-transparent text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-neutral)]"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="tabular-nums text-xs text-[var(--color-neutral)] hover:text-[var(--color-ink)] ml-1"
                                >
                                    [×]
                                </button>
                            )}
                        </div>

                        {/* Status Filter Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                onClick={() => setFilterMode('all')}
                                className={`px-2.5 py-1 text-xs tabular-nums border transition-colors ${
                                    filterMode === 'all'
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                        : 'bg-[var(--color-paper)] text-[var(--color-muted)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'
                                }`}
                            >
                                ทั้งหมด ({menuItems.length})
                            </button>
                            <button
                                onClick={() => setFilterMode('has_recipe')}
                                className={`px-2.5 py-1 text-xs tabular-nums border transition-colors ${
                                    filterMode === 'has_recipe'
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]'
                                        : 'bg-[var(--color-paper)] text-[var(--color-muted)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'
                                }`}
                            >
                                มีสูตรแล้ว ({metrics.recipeCount})
                            </button>
                            <button
                                onClick={() => setFilterMode('missing_recipe')}
                                className={`px-2.5 py-1 text-xs tabular-nums border transition-colors ${
                                    filterMode === 'missing_recipe'
                                        ? 'bg-[var(--brand-plum)] text-[var(--color-paper)] border-[var(--brand-plum)] font-bold'
                                        : 'bg-[var(--color-paper)] text-[var(--brand-plum)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'
                                }`}
                            >
                                ยังไม่มีสูตร ({metrics.missingRecipeCount})
                            </button>
                            <button
                                onClick={() => setFilterMode('high_cost')}
                                className={`px-2.5 py-1 text-xs tabular-nums border transition-colors ${
                                    filterMode === 'high_cost'
                                        ? 'bg-[var(--brand-plum)] text-[var(--color-paper)] border-[var(--brand-plum)] font-bold'
                                        : 'bg-[var(--color-paper)] text-[var(--brand-plum)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'
                                }`}
                            >
                                ต้นทุนสูง &gt; 35% ({metrics.highCostCount})
                            </button>
                            <button
                                onClick={() => setFilterMode('low_margin')}
                                className={`px-2.5 py-1 text-xs tabular-nums border transition-colors ${
                                    filterMode === 'low_margin'
                                        ? 'bg-[oklch(40%_0.10_70)] text-[var(--color-paper)] border-[oklch(40%_0.10_70)] font-bold'
                                        : 'bg-[var(--color-paper)] text-[oklch(40%_0.10_70)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'
                                }`}
                            >
                                กำไรน้อย &lt; 50% ({metrics.lowMarginCount})
                            </button>
                        </div>
                    </div>

                    {/* Category Filter Horizontal Strip */}
                    {categories.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 text-xs tabular-nums border-t border-[var(--color-paper-3)]">
                            <span className="text-[var(--color-neutral)] shrink-0 mr-1 text-xs">หมวดหมู่:</span>
                            <button
                                onClick={() => setSelectedCategory('ALL')}
                                className={`px-2.5 py-1 shrink-0 border rounded-xs transition-colors ${
                                    selectedCategory === 'ALL'
                                        ? 'bg-[var(--mc-charcoal)] text-[var(--mc-on-charcoal)] border-[var(--mc-charcoal)] font-bold'
                                        : 'bg-[var(--color-paper)] text-[var(--color-muted)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'
                                }`}
                            >
                                ทั้งหมด
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-2.5 py-1 shrink-0 border rounded-xs transition-colors ${
                                        selectedCategory === cat
                                            ? 'bg-[var(--mc-charcoal)] text-[var(--mc-on-charcoal)] border-[var(--mc-charcoal)] font-bold'
                                            : 'bg-[var(--color-paper)] text-[var(--color-muted)] border-[var(--color-rule)] hover:bg-[var(--color-paper-3)]'
                                }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Main List: Desktop Table + Mobile Cards */}
                {loading ? (
                    <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-12 text-center">
                        <div className="tabular-nums text-sm text-[var(--color-neutral)] ">
                            กำลังโหลดและคำนวณต้นทุนเมนู...
                        </div>
                    </div>
                ) : processedItems.length === 0 ? (
                    <div className="border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-12 text-center">
                        <div className="tabular-nums text-sm text-[var(--color-neutral)]">
                            ไม่พบเมนูตามเงื่อนไขการค้นหา
                        </div>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCategory('ALL');
                                setFilterMode('all');
                            }}
                            className="admin-btn h-9 mt-3"
                        >
                            ล้างตัวกรองทั้งหมด
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Tabular Grid */}
                        {(viewLayout === 'table' || viewLayout === 'auto') && (
                            <div className={`${viewLayout === 'auto' ? 'hidden lg:block' : 'block'} border border-[var(--color-rule)] bg-[var(--color-paper)] overflow-x-auto `}>
                                <table className="text-[13px] w-full min-w-[760px] text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)] tabular-nums text-xs text-[var(--color-muted)] select-none">
                                            <th
                                                className="p-3.5 cursor-pointer hover:text-[var(--color-ink)] border-r border-[var(--color-rule)] whitespace-nowrap w-[34%] min-w-[220px]"
                                                onClick={() => handleSort('name')}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-bold">รายการเมนู</span>
                                                    <span className="text-xs text-[var(--color-neutral)]">
                                                        {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th
                                                className="p-3.5 text-right cursor-pointer hover:text-[var(--color-ink)] border-r border-[var(--color-rule)] whitespace-nowrap w-[12%] min-w-[90px]"
                                                onClick={() => handleSort('price')}
                                            >
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <span>ราคาขาย</span>
                                                    <span className="text-xs text-[var(--color-neutral)]">
                                                        {sortConfig.key === 'price' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th
                                                className="p-3.5 text-right cursor-pointer hover:text-[var(--color-ink)] border-r border-[var(--color-rule)] whitespace-nowrap w-[15%] min-w-[110px]"
                                                onClick={() => handleSort('cost')}
                                            >
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <span>ต้นทุนวัตถุดิบ</span>
                                                    <span className="text-xs text-[var(--color-neutral)]">
                                                        {sortConfig.key === 'cost' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th
                                                className="p-3.5 text-right cursor-pointer hover:text-[var(--color-ink)] border-r border-[var(--color-rule)] whitespace-nowrap w-[13%] min-w-[95px]"
                                                onClick={() => handleSort('profit')}
                                            >
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <span>กำไรต่อแก้ว</span>
                                                    <span className="text-xs text-[var(--color-neutral)]">
                                                        {sortConfig.key === 'profit' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th
                                                className="p-3.5 text-right cursor-pointer hover:text-[var(--color-ink)] border-r border-[var(--color-rule)] whitespace-nowrap w-[13%] min-w-[105px]"
                                                onClick={() => handleSort('costPercent')}
                                            >
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <span>ต้นทุน %</span>
                                                    <span className="text-xs text-[var(--color-neutral)]">
                                                        {sortConfig.key === 'costPercent' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </div>
                                            </th>
                                            <th className="p-3.5 text-center whitespace-nowrap w-[13%] min-w-[110px]">
                                                <span>จัดการสูตร</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-paper-3)] tabular-nums text-[13px]">
                                        {categoryGroups.map(group => (
                                            <React.Fragment key={group.key}>
                                            {group.name && (
                                                <tr className="mc-band">
                                                    <th colSpan={6} scope="rowgroup" className="px-3 py-2 text-left font-normal">
                                                        <span className="mc-band__row">
                                                            <span className="mc-band__name">{group.name}</span>
                                                            <span className="mc-band__count">{group.items.length} เมนู</span>
                                                            {group.items.some(i => !i.hasRecipe) && (
                                                                <span className="mc-band__note">รอผูกสูตร {group.items.filter(i => !i.hasRecipe).length}</span>
                                                            )}
                                                        </span>
                                                    </th>
                                                </tr>
                                            )}
                                            {group.items.map(item => (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-[var(--color-paper-2)] transition-colors"
                                            >
                                                {/* Name & Category */}
                                                <td className="p-3 border-r border-[var(--color-paper-3)] w-[34%] min-w-[220px]">
                                                    <div className="flex items-center gap-3">
                                                        {item.image_url ? (
                                                            <img
                                                                src={item.image_url}
                                                                alt={item.name}
                                                                className="w-9 h-9 object-cover rounded-xs border border-[var(--color-rule)] shrink-0"
                                                            />
                                                        ) : (
                                                            <div className="w-9 h-9 bg-[var(--color-paper-2)] border border-[var(--color-rule)] flex items-center justify-center text-xs text-[var(--color-neutral)] shrink-0 tabular-nums">
                                                                N/A
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            {/* Wraps (max 2 lines) instead of truncating: a no-wrap name stretches the auto-width table */}
                                                            <div className="font-bold text-[var(--color-ink)] text-sm leading-snug line-clamp-2 break-words font-sans" title={item.name}>
                                                                {item.name}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--color-neutral)]">
                                                                {!groupedByCategory && (
                                                                    <span className="px-1.5 py-0.2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-xs">
                                                                        {item.category || 'ไม่ระบุหมวด'}
                                                                    </span>
                                                                )}
                                                                {item.hasRecipe && (
                                                                    <span className="text-xs text-[var(--color-neutral)]">
                                                                        {item.ingredientCount} วัตถุดิบ
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Price */}
                                                <td className="p-3 text-right font-medium tabular-nums border-r border-[var(--color-paper-3)] text-sm whitespace-nowrap w-[12%] min-w-[90px]">
                                                    ฿{item.price.toLocaleString('th-TH', { minimumFractionDigits: 0 })}
                                                </td>

                                                {/* Cost */}
                                                <td className="p-3 text-right tabular-nums border-r border-[var(--color-paper-3)] whitespace-nowrap w-[15%] min-w-[110px]">
                                                    {item.hasRecipe ? (
                                                        <div>
                                                            <span className="font-bold text-[var(--color-ink)]">
                                                                ฿{item.cost.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[var(--color-neutral)] italic text-xs">
                                                            รอผูกสูตร
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Profit */}
                                                <td className="p-3 text-right tabular-nums border-r border-[var(--color-paper-3)] whitespace-nowrap w-[13%] min-w-[95px]">
                                                    {item.hasRecipe ? (
                                                        <span className={`font-bold ${
                                                            item.profit > 0 ? 'text-[oklch(38%_0.08_140)]' : 'text-[var(--brand-plum)]'
                                                        }`}>
                                                            ฿{item.profit.toFixed(0)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[var(--color-neutral)]">-</span>
                                                    )}
                                                </td>

                                                {/* Cost % & Margin Badge */}
                                                <td className="p-3 text-right tabular-nums border-r border-[var(--color-paper-3)] whitespace-nowrap w-[13%] min-w-[105px]">
                                                    {item.hasRecipe ? (
                                                        <div className="flex flex-col items-end gap-0.5">
                                                            <span className={`px-1.5 py-0.5 rounded-xs text-[11px] font-bold border ${
                                                                item.costPercent > 35
                                                                    ? 'bg-[oklch(93%_0.05_348.33)] text-[var(--brand-plum)] border-[oklch(85%_0.08_348.33)]'
                                                                    : item.costPercent > targetFoodCostPct
                                                                    ? 'bg-[oklch(93%_0.05_70)] text-[oklch(40%_0.10_70)] border-[oklch(85%_0.07_70)]'
                                                                    : 'bg-[oklch(93%_0.04_140)] text-[oklch(35%_0.08_140)] border-[oklch(85%_0.05_140)]'
                                                            }`}>
                                                                {item.costPercent.toFixed(1)}%
                                                            </span>
                                                            <span className="text-xs text-[var(--color-neutral)]">
                                                                มาร์จิ้น {item.margin.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[var(--color-neutral)]">-</span>
                                                    )}
                                                </td>

                                                {/* Action Button */}
                                                <td className="p-3 text-center whitespace-nowrap w-[13%] min-w-[110px]">
                                                    <div className="flex flex-col items-stretch gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenRecipe(item)}
                                                        className={`px-3 py-1.5 tabular-nums text-xs border transition-colors ${
                                                            item.hasRecipe
                                                                ? 'border-[var(--color-rule)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] text-[var(--color-ink)]'
                                                                : 'border-[var(--color-ink)] bg-[var(--color-ink)] hover:bg-[oklch(28%_0.012_348.33)] text-[var(--color-paper)] font-bold'
                                                        }`}
                                                    >
                                                        {item.hasRecipe ? 'ปรุงสูตร' : '+ สร้างสูตร'}
                                                    </button>
                                                    {onOpenMethod && (
                                                        <button
                                                            onClick={() => onOpenMethod({ type: 'menu', id: item.id, name: item.name })}
                                                            title="วิธีทำ (SOP) ของเมนูนี้"
                                                            className="admin-btn h-9"
                                                        >
                                                            วิธีทำ
                                                        </button>
                                                    )}
                                                    </div>
                                                </td>
                                            </tr>
                                            ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Mobile Compact Financial Cards */}
                        {(viewLayout === 'cards' || viewLayout === 'auto') && (
                            <div className={`${viewLayout === 'auto' ? 'block lg:hidden' : 'block'} space-y-3`}>
                            {categoryGroups.map(group => (
                                <section key={group.key} className="space-y-3" aria-label={group.name || undefined}>
                                {group.name && (
                                    <h3 className="mc-band mc-band--card">
                                        <span className="mc-band__row">
                                            <span className="mc-band__name">{group.name}</span>
                                            <span className="mc-band__count">{group.items.length} เมนู</span>
                                            {group.items.some(i => !i.hasRecipe) && (
                                                <span className="mc-band__note">รอผูกสูตร {group.items.filter(i => !i.hasRecipe).length}</span>
                                            )}
                                        </span>
                                    </h3>
                                )}
                                {group.items.map(item => (
                                <div
                                    key={item.id}
                                    className="border border-[var(--color-rule)] bg-[var(--color-paper)] p-3.5 space-y-3"
                                >
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            {item.image_url ? (
                                                <img
                                                    src={item.image_url}
                                                    alt={item.name}
                                                    className="w-10 h-10 object-cover rounded-xs border border-[var(--color-rule)] shrink-0"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 bg-[var(--color-paper-2)] border border-[var(--color-rule)] flex items-center justify-center text-xs text-[var(--color-neutral)] shrink-0 tabular-nums">
                                                    N/A
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-bold text-sm text-[var(--color-ink)]">
                                                    {item.name}
                                                </div>
                                                {!groupedByCategory && (
                                                    <div className="tabular-nums text-xs text-[var(--color-neutral)]">
                                                        {item.category || 'ไม่ระบุหมวด'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <span className={`tabular-nums text-[11px] px-1.5 py-0.5 border rounded-xs font-bold ${
                                            !item.hasRecipe
                                                ? 'bg-[oklch(92%_0.05_348.33)] text-[var(--brand-plum)] border-[oklch(85%_0.08_348.33)]'
                                                : item.costPercent > 35
                                                ? 'bg-[oklch(92%_0.05_348.33)] text-[var(--brand-plum)] border-[oklch(85%_0.08_348.33)]'
                                                : 'bg-[oklch(92%_0.04_140)] text-[oklch(35%_0.08_140)] border-[oklch(85%_0.05_140)]'
                                        }`}>
                                            {!item.hasRecipe ? 'NO RECIPE' : `${item.costPercent.toFixed(1)}% COST`}
                                        </span>
                                    </div>

                                    {/* 2x2 Numeric Grid */}
                                    <div className="grid grid-cols-2 gap-2 border-t border-b border-[var(--color-paper-3)] py-2 tabular-nums text-xs">
                                        <div>
                                            <div className="text-xs text-[var(--color-neutral)]">ราคาขาย:</div>
                                            <div className="font-bold text-sm text-[var(--color-ink)]">
                                                ฿{item.price.toLocaleString('th-TH')}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-[var(--color-neutral)]">ต้นทุนวัตถุดิบ:</div>
                                            <div className="font-bold text-sm text-[var(--color-ink)]">
                                                {item.hasRecipe ? `฿${item.cost.toFixed(2)}` : '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-[var(--color-neutral)]">กำไรต่อแก้ว:</div>
                                            <div className={`font-bold ${item.hasRecipe && item.profit > 0 ? 'text-[oklch(38%_0.08_140)]' : 'text-[var(--color-neutral)]'}`}>
                                                {item.hasRecipe ? `฿${item.profit.toFixed(0)}` : '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-[var(--color-neutral)]">Gross Margin:</div>
                                            <div className="font-bold text-[var(--color-ink)]">
                                                {item.hasRecipe ? `${item.margin.toFixed(1)}%` : '-'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        onClick={() => handleOpenRecipe(item)}
                                        className={`w-full py-2 tabular-nums text-xs border text-center transition-colors ${
                                            item.hasRecipe
                                                ? 'border-[var(--color-rule)] bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] text-[var(--color-ink)] font-bold'
                                                : 'border-[var(--color-ink)] bg-[var(--color-ink)] hover:bg-[oklch(28%_0.012_348.33)] text-[var(--color-paper)] font-bold'
                                        }`}
                                    >
                                        {item.hasRecipe ? 'ปรุงสูตร' : '+ ผูกสูตรใหม่'}
                                    </button>
                                    {onOpenMethod && (
                                        <button
                                            onClick={() => onOpenMethod({ type: 'menu', id: item.id, name: item.name })}
                                            className="admin-btn h-9 w-full mt-1.5"
                                        >
                                            [วิธีทำ (SOP)]
                                        </button>
                                    )}
                                </div>
                                ))}
                                </section>
                            ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Recipe Modal */}
            {isRecipeOpen && recipeTarget && (
                <RecipeBuilder
                    parentId={recipeTarget.id}
                    parentType="menu"
                    initialPrice={recipeTarget.price}
                    onClose={async () => {
                        setIsRecipeOpen(false);
                        setRecipeTarget(null);
                        // Reload data with slight delay to ensure DB triggers/writes propagate
                        setTimeout(() => loadData(false), 300);
                    }}
                />
            )}
        </div>
    );
}
