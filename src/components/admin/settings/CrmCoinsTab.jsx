/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react';
import { Coins, Save, RotateCcw, Plus, Trash2, Calculator, QrCode, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_CRM_TIERS, parseTiersConfig, calculateMemberTier, calculateCoinsEarned, calculateCoinsDiscount, getTierVisualTheme } from '../../../utils/crmHelper';
import { getAppOrigin } from '../../../utils/urlHelper';

export default function CrmCoinsTab({
    settings,
    setSettings,
    handleSave,
    editableTiers,
    setEditableTiers,
    crmQrUrl
}) {
    const [isTiersSaving, setIsTiersSaving] = useState(false);
    const [simSpendAmount, setSimSpendAmount] = useState('500');
    const [simAccumSpent, setSimAccumSpent] = useState('4500');
    const [simGracePeriod, setSimGracePeriod] = useState(false);

    const handleTierFieldChange = (index, field, value) => {
        setEditableTiers(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleAddTier = () => {
        setEditableTiers(prev => {
            const lastTier = prev[prev.length - 1];
            const nextMinSpend = lastTier ? (parseFloat(lastTier.min_spend) || 0) + 4000 : 0;
            const nextMultiplier = lastTier ? (parseFloat(lastTier.multiplier) || 1.0) + 0.25 : 1.0;
            const nextLevel = String(prev.length + 1).padStart(2, '0');
            const themeOptions = ['bronze', 'silver', 'gold', 'emerald'];
            const nextTheme = themeOptions[prev.length % themeOptions.length];
            const newTier = {
                id: `tier_${Date.now()}`,
                level_code: nextLevel,
                name: `Tier ${prev.length + 1}`,
                min_spend: nextMinSpend,
                multiplier: nextMultiplier,
                tagline: 'ระดับสมาชิกใหม่',
                condition_text: `มียอดจ่ายสะสมสุทธิครบ ${nextMinSpend.toLocaleString()} บาทภายใน ${settings.crm_tier_eval_months || 12} เดือน`,
                badge_theme: nextTheme
            };
            return [...prev, newTier];
        });
        toast.info('เพิ่มระดับสมาชิกใหม่เรียบร้อย กรุณากดบันทึก');
    };

    const handleDeleteTier = (index) => {
        if (editableTiers.length <= 1) {
            toast.error('ต้องมีระดับความสัมพันธ์อย่างน้อย 1 ระดับในระบบ');
            return;
        }
        if (!window.confirm(`ต้องการลบระดับ "${editableTiers[index].name}" หรือไม่?`)) return;
        setEditableTiers(prev => prev.filter((_, i) => i !== index));
        toast.info('ลบระดับสมาชิกแล้ว กรุณากดบันทึก');
    };

    const handleResetTiers = () => {
        if (!window.confirm('ต้องการคืนค่าระดับความสัมพันธ์ทั้งหมดกลับเป็นค่าเริ่มต้นระบบหรือไม่?')) return;
        setEditableTiers([...DEFAULT_CRM_TIERS]);
        toast.info('คืนค่าเริ่มต้นเรียบร้อย กรุณากดบันทึก');
    };

    const handleSaveTiers = async () => {
        setIsTiersSaving(true);
        try {
            const normalized = parseTiersConfig(editableTiers);
            setEditableTiers(normalized);
            const jsonStr = JSON.stringify(normalized);
            await handleSave('crm_tiers_config', jsonStr);
            toast.success('บันทึกการตั้งค่าระดับความสัมพันธ์ (Relationship Tiers) สำเร็จ');
        } catch (err) {
            console.error('Save tiers error:', err);
            toast.error('บันทึกระดับสมาชิกล้มเหลว: ' + (err.message || err));
        } finally {
            setIsTiersSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left & Center: Rules & Tiers (2 cols) */}
            <div className="lg:col-span-2 space-y-6">
                {/* 1. Coins Settings Card */}
                <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-6 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--color-rule)] pb-3">
                        <div className="flex items-center gap-2">
                            <Coins size={18} className="text-[var(--color-ink)]" />
                            <div>
                                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                    xhaus Coins Configuration
                                </h2>
                                <p className="text-[11px] font-mono text-[var(--color-neutral)]">
                                    กำหนดอัตราแลกเปลี่ยน โบนัสต้อนรับ และเงื่อนไขการสะสมเหรียญ
                                </p>
                            </div>
                        </div>
                        <span className="px-2 py-0.5 bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)] text-[9px] font-mono font-bold rounded">
                            REAL-TIME
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Welcome Coins */}
                        <div>
                            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                Welcome Coins
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={settings.crm_welcome_xhaus || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, crm_welcome_xhaus: e.target.value }))}
                                    onBlur={(e) => handleSave('crm_welcome_xhaus', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[var(--color-neutral)]">
                                    xhaus
                                </span>
                            </div>
                            <p className="text-[9px] font-mono text-[var(--color-neutral)] mt-1">รับฟรีเมื่อสมัคร</p>
                        </div>

                        {/* Redeem Rate */}
                        <div>
                            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                Redeem Rate
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={settings.crm_redeem_rate_xhaus || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, crm_redeem_rate_xhaus: e.target.value }))}
                                    onBlur={(e) => handleSave('crm_redeem_rate_xhaus', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[var(--color-neutral)]">
                                    ฿/coin
                                </span>
                            </div>
                            <p className="text-[9px] font-mono text-[var(--color-neutral)] mt-1">มูลค่าบาทต่อ 1 xhaus</p>
                        </div>

                        {/* Min Redeem */}
                        <div>
                            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                Min Redeem
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={settings.crm_min_redeem_xhaus || ''}
                                    onChange={(e) => setSettings(prev => ({ ...prev, crm_min_redeem_xhaus: e.target.value }))}
                                    onBlur={(e) => handleSave('crm_min_redeem_xhaus', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[var(--color-neutral)]">
                                    xhaus
                                </span>
                            </div>
                            <p className="text-[9px] font-mono text-[var(--color-neutral)] mt-1">เหรียญขั้นต่ำที่แลกได้</p>
                        </div>

                        {/* Base Spend Unit */}
                        <div>
                            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                Base Spend Unit
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="1"
                                    value={settings.crm_base_spend_amount || '100'}
                                    onChange={(e) => setSettings(prev => ({ ...prev, crm_base_spend_amount: e.target.value }))}
                                    onBlur={(e) => handleSave('crm_base_spend_amount', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[var(--color-neutral)]">
                                    THB
                                </span>
                            </div>
                            <p className="text-[9px] font-mono text-[var(--color-neutral)] mt-1">ทุกๆ X บาท = ตัวคูณเหรียญ</p>
                        </div>
                    </div>

                    {/* Granular Advanced Limits */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[var(--color-rule)]">
                        <div>
                            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                Max Redeem Per Bill (% ยอดบิล)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={settings.crm_max_redeem_percent || '100'}
                                    onChange={(e) => setSettings(prev => ({ ...prev, crm_max_redeem_percent: e.target.value }))}
                                    onBlur={(e) => handleSave('crm_max_redeem_percent', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[var(--color-neutral)]">%</span>
                            </div>
                            <p className="text-[9px] font-mono text-[var(--color-neutral)] mt-1">จำกัดส่วนลดไม่เกิน X% ของบิล (100 = ไม่จำกัด)</p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                Evaluation Period (รอบประเมิน)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="1"
                                    max="36"
                                    value={settings.crm_tier_eval_months || '12'}
                                    onChange={(e) => setSettings(prev => ({ ...prev, crm_tier_eval_months: e.target.value }))}
                                    onBlur={(e) => handleSave('crm_tier_eval_months', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[var(--color-neutral)]">Months</span>
                            </div>
                            <p className="text-[9px] font-mono text-[var(--color-neutral)] mt-1">รอบคำนวณยอดสะสมเพื่อจัดระดับ</p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                Grace Period (ระยะผ่อนผัน)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="180"
                                    value={settings.crm_grace_period_days || '30'}
                                    onChange={(e) => setSettings(prev => ({ ...prev, crm_grace_period_days: e.target.value }))}
                                    onBlur={(e) => handleSave('crm_grace_period_days', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[var(--color-neutral)]">Days</span>
                            </div>
                            <p className="text-[9px] font-mono text-[var(--color-neutral)] mt-1">ผ่อนผันตรึงระดับสมาชิกรักษาระดับ</p>
                        </div>
                    </div>
                </div>

                {/* 2. Dynamic Relationship Tiers Card */}
                <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-6 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--color-rule)] pb-4 gap-2">
                        <div>
                            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                Relationship Levels Configuration (ระดับความสัมพันธ์)
                            </h2>
                            <p className="text-[11px] font-mono text-[var(--color-neutral)]">
                                ปรับแต่งยอดใช้จ่ายขั้นต่ำ ตัวคูณเหรียญ และธีมบัตรสมาชิก
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={handleResetTiers}
                                className="px-3 py-1.5 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] text-[var(--color-neutral)] border border-[var(--color-rule)] rounded-lg text-[10px] font-mono font-bold transition-colors cursor-pointer"
                            >
                                <RotateCcw size={12} className="inline mr-1" /> คืนค่าเริ่มต้น
                            </button>
                            <button
                                type="button"
                                onClick={handleAddTier}
                                className="px-3 py-1.5 bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)] rounded-lg text-[10px] font-mono font-bold transition-colors cursor-pointer"
                            >
                                <Plus size={12} className="inline mr-1" /> เพิ่มระดับ
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveTiers}
                                disabled={isTiersSaving}
                                className="px-4 py-1.5 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] rounded-lg text-[10px] font-mono font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                <Save size={12} className="inline mr-1" /> {isTiersSaving ? 'กำลังบันทึก...' : 'บันทึกระดับสมาชิก'}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {editableTiers.map((tier, idx) => {
                            const baseSpend = parseFloat(settings.crm_base_spend_amount) || 100;
                            const mult = parseFloat(tier.multiplier) || 1.0;
                            const redeemRate = parseFloat(settings.crm_redeem_rate_xhaus) || 1.0;
                            const coinsPerBase = (mult).toFixed(2);
                            const returnPct = ((mult * redeemRate / baseSpend) * 100).toFixed(1);

                            return (
                                <div
                                    key={tier.id || idx}
                                    className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-4 space-y-3"
                                >
                                    <div className="flex flex-wrap items-center justify-between border-b border-[var(--color-rule)] pb-2 gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--color-paper-2)] text-[var(--color-ink)] border border-[var(--color-rule)]">
                                                LV.{tier.level_code || String(idx + 1).padStart(2, '0')}
                                            </span>
                                            <input
                                                type="text"
                                                value={tier.name || ''}
                                                onChange={(e) => handleTierFieldChange(idx, 'name', e.target.value)}
                                                className="font-bold text-xs text-[var(--color-ink)] bg-transparent border-b border-dashed border-[var(--color-rule)] focus:border-[var(--color-ink)] outline-none px-1"
                                                placeholder="ชื่อระดับสมาชิก"
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[9px] font-mono text-[var(--color-neutral)]">THEME:</span>
                                                <select
                                                    value={tier.badge_theme || 'bronze'}
                                                    onChange={(e) => handleTierFieldChange(idx, 'badge_theme', e.target.value)}
                                                    className="text-[10px] font-mono font-bold bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded px-2 py-1 outline-none cursor-pointer"
                                                >
                                                    <option value="bronze">Clay / Bronze</option>
                                                    <option value="silver">Silver / Slate</option>
                                                    <option value="gold">Gold / VIP</option>
                                                    <option value="emerald">Emerald / Green</option>
                                                </select>
                                            </div>

                                            {editableTiers.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteTier(idx)}
                                                    className="text-[var(--color-neutral)] hover:text-[var(--color-accent)] p-1 rounded transition-colors cursor-pointer"
                                                    title="ลบระดับนี้"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Parameters Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--color-neutral)] mb-1">
                                                Min Spend (ยอดสะสมขั้นต่ำ)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="100"
                                                    value={tier.min_spend}
                                                    onChange={(e) => handleTierFieldChange(idx, 'min_spend', e.target.value)}
                                                    className="w-full px-2.5 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[var(--color-neutral)]">THB</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--color-neutral)] mb-1">
                                                Earn Multiplier (ตัวคูณแต้ม)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.05"
                                                    min="0.1"
                                                    value={tier.multiplier}
                                                    onChange={(e) => handleTierFieldChange(idx, 'multiplier', e.target.value)}
                                                    className="w-full px-2.5 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                                />
                                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[var(--color-neutral)]">x</span>
                                            </div>
                                        </div>

                                        <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded p-2 flex flex-col justify-center text-right font-mono">
                                            <p className="text-[10px] font-bold text-[var(--color-ink)] tabular-nums">
                                                ทุก {baseSpend} บ. = {coinsPerBase} xhaus
                                            </p>
                                            <p className="text-[9px] text-[var(--color-neutral)] font-bold uppercase mt-0.5 tabular-nums">
                                                มูลค่าคืน {returnPct}%
                                            </p>
                                        </div>
                                    </div>

                                    {/* Tagline & Condition Texts */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <label className="block text-[9px] font-mono uppercase text-[var(--color-neutral)] mb-0.5">
                                                Tagline (คำโปรยระดับสมาชิก)
                                            </label>
                                            <input
                                                type="text"
                                                value={tier.tagline || ''}
                                                onChange={(e) => handleTierFieldChange(idx, 'tagline', e.target.value)}
                                                placeholder="เช่น พื้นที่ที่เราเริ่มรู้จักกัน"
                                                className="w-full px-2.5 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-mono uppercase text-[var(--color-neutral)] mb-0.5">
                                                Condition Note (คำอธิบายเงื่อนไข)
                                            </label>
                                            <input
                                                type="text"
                                                value={tier.condition_text || ''}
                                                onChange={(e) => handleTierFieldChange(idx, 'condition_text', e.target.value)}
                                                placeholder="เช่น มียอดใช้จ่ายสะสม 12 เดือนแรกเริ่ม"
                                                className="w-full px-2.5 py-1.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Live Simulation & Sandbox Tool */}
                <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-6 rounded-2xl space-y-4">
                    <div className="flex items-center gap-2 border-b border-[var(--color-rule)] pb-3">
                        <Calculator size={18} className="text-[var(--color-ink)]" />
                        <div>
                            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                                Tier & Coins Live Simulator (เครื่องมือจำลองคำนวณ)
                            </h2>
                            <p className="text-[11px] font-mono text-[var(--color-neutral)]">
                                ทดสอบกรอกยอดสะสมและยอดบิลเพื่อตรวจสอบระดับสมาชิกและจำนวนเหรียญที่จะได้รับ
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                    Test 12M Accumulated Spend (ยอดสะสมย้อนหลัง)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={simAccumSpent}
                                        onChange={(e) => setSimAccumSpent(e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-bold font-mono outline-none text-[var(--color-ink)]"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[var(--color-neutral)]">THB</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                    Test Current Bill Total (ยอดบิลมื้อนี้)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={simSpendAmount}
                                        onChange={(e) => setSimSpendAmount(e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-bold font-mono outline-none text-[var(--color-ink)]"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-[var(--color-neutral)]">THB</span>
                                </div>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer pt-1">
                                <input
                                    type="checkbox"
                                    checked={simGracePeriod}
                                    onChange={(e) => setSimGracePeriod(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded"
                                />
                                <span className="text-[10px] font-mono text-[var(--color-ink)]">
                                    จำลองสถานะอยู่ในช่วงผ่อนผันรักษาระดับ (Grace Period)
                                </span>
                            </label>
                        </div>

                        {/* Simulation Result Preview */}
                        {(() => {
                            const spendVal = parseFloat(simSpendAmount) || 0;
                            const accumVal = parseFloat(simAccumSpent) || 0;
                            const graceVal = simGracePeriod ? accumVal + 1000 : accumVal;
                            const parsedTiers = parseTiersConfig(editableTiers);
                            const res = calculateMemberTier(accumVal, graceVal, parsedTiers);
                            const baseUnit = parseFloat(settings.crm_base_spend_amount) || 100;
                            const coinsEarned = calculateCoinsEarned(spendVal, res.multiplier, baseUnit);
                            const maxPct = parseFloat(settings.crm_max_redeem_percent) || 100;
                            const theme = getTierVisualTheme(res.current_tier, res.tier_obj?.badge_theme);

                            return (
                                <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-xl p-4 flex flex-col justify-between space-y-3 font-mono text-[10px]">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-2">
                                            <span className="text-[9px] uppercase tracking-wider text-[var(--color-neutral)]">Calculated Tier:</span>
                                            <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase ${theme.pillBg}`}>
                                                {res.current_tier} ({res.multiplier}x)
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-[var(--color-neutral)]">Coins Earned:</span>
                                            <span className="font-bold text-[var(--color-ink)] tabular-nums">+{coinsEarned.toFixed(2)} xhaus</span>
                                        </div>

                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-[var(--color-neutral)]">Next Tier Target:</span>
                                            <span className="font-bold text-[var(--color-ink)] tabular-nums">
                                                {res.next_tier ? `อีก ${res.amount_to_next_tier.toLocaleString()} บ. (${res.progress_pct}%)` : 'สูงสุดแล้ว'}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="text-[var(--color-neutral)]">Max Discount:</span>
                                            <span className="font-bold text-[var(--color-ink)] tabular-nums">{((spendVal * maxPct) / 100).toLocaleString()} Baht</span>
                                        </div>
                                    </div>

                                    <div className="bg-[var(--color-paper-2)] p-2 rounded border border-[var(--color-rule)] text-[9px] text-[var(--color-neutral)] tabular-nums">
                                        สูตร: (ยอดบิล {spendVal} ÷ {baseUnit}) × {res.multiplier}x = {coinsEarned.toFixed(2)} xhaus
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Right Column: Registration QR Code Card */}
            <div className="space-y-6">
                <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-6 rounded-2xl flex flex-col items-center text-center space-y-4">
                    <div className="w-full flex items-center gap-2 border-b border-[var(--color-rule)] pb-3 text-left">
                        <QrCode size={18} className="text-[var(--color-ink)]" />
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                            Member Registration QR
                        </h2>
                    </div>

                    <p className="text-[11px] font-mono text-[var(--color-neutral)] leading-relaxed">
                        ตั้งคิวอาร์โค้ดนี้ไว้ที่โต๊ะอาหารเพื่อให้ลูกค้าสแกนเปิดบัตรสมาชิกผ่านมือถือ
                    </p>

                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-4 rounded-xl flex items-center justify-center">
                        {crmQrUrl ? (
                            <img src={crmQrUrl} alt="CRM Member Registration QR" className="w-44 h-44" />
                        ) : (
                            <div className="w-44 h-44 flex items-center justify-center text-[var(--color-neutral)] font-mono text-xs">
                                Generating QR...
                            </div>
                        )}
                    </div>

                    <div className="w-full pt-2 space-y-2 font-mono">
                        <a
                            href={crmQrUrl}
                            download="crm-member-registration-qr.png"
                            className="w-full bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                            <Download size={13} /> Download QR Code Image
                        </a>
                        <a
                            href={`${getAppOrigin()}/member-card`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full bg-[var(--color-paper)] hover:bg-[var(--color-paper-2)] border border-[var(--color-rule)] text-[var(--color-ink)] py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <ExternalLink size={12} /> Open Member Portal ↗
                        </a>
                        <p className="text-[9px] text-[var(--color-neutral)] select-all truncate">
                            {getAppOrigin()}/member-card
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
