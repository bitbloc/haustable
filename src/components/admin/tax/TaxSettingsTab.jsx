import React, { useState, useEffect } from 'react';
import { 
    Building2, 
    Save, 
    CheckCircle2, 
    AlertCircle, 
    Plus, 
    Trash2, 
    Edit2, 
    Users, 
    FileText, 
    ShieldCheck,
    Search,
    ToggleLeft,
    ToggleRight,
    Sparkles,
    Bot,
    Key
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { validateThaiTaxId, formatTaxId, formatBranch } from '../../../utils/thaiTaxHelper';
import { toast } from 'sonner';

export default function TaxSettingsTab({ 
    companySettings = {}, 
    onSettingsUpdated 
}) {
    // Form Settings State
    const [settings, setSettings] = useState({
        tax_is_vat_registered: 'false',
        tax_company_name: 'IN THE HAUS',
        tax_company_name_en: 'IN THE HAUS CO., LTD.',
        tax_id: '',
        tax_branch_type: 'head_office',
        tax_branch_code: '00000',
        tax_address: '',
        tax_phone: '',
        tax_email: '',
        tax_vat_rate: '7.00',
        tax_vat_model: 'inclusive',
        tax_receipt_prefix: 'REC',
        tax_invoice_prefix: 'INV',
        tax_wht_prefix: 'WHT',
        tax_signature_name: 'ผู้มีอำนาจลงนาม / ผู้รับเงิน',
        gemini_api_key: localStorage.getItem('onhaus_gemini_api_key') || ''
    });

    const [saving, setSaving] = useState(false);

    // Customer Directory State
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [showCustomerModal, setShowCustomerModal] = useState(false);

    useEffect(() => {
        if (companySettings && Object.keys(companySettings).length > 0) {
            setSettings(prev => ({
                ...prev,
                ...companySettings
            }));
        }
        fetchCustomerDirectory();
    }, [companySettings]);

    const fetchCustomerDirectory = async () => {
        try {
            const { data, error } = await supabase
                .from('tax_customer_profiles')
                .select('*')
                .order('company_name', { ascending: true });

            if (!error && data) {
                setCustomers(data);
                localStorage.setItem('onhaus_tax_customer_profiles', JSON.stringify(data));
            } else {
                const local = localStorage.getItem('onhaus_tax_customer_profiles');
                if (local) setCustomers(JSON.parse(local));
            }
        } catch {
            const local = localStorage.getItem('onhaus_tax_customer_profiles');
            if (local) setCustomers(JSON.parse(local));
        }
    };

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const isCompanyTaxIdValid = validateThaiTaxId(settings.tax_id);
    const isVatOn = settings.tax_is_vat_registered === 'true' || settings.tax_is_vat_registered === true;

    // Save Settings
    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const entries = Object.entries(settings).map(([key, value]) => ({
                key,
                value: String(value)
            }));

            // 1. Try Upserting to Supabase app_settings
            try {
                await supabase.from('app_settings').upsert(entries, { onConflict: 'key' });
            } catch (e) {
                console.warn('app_settings upsert error:', e);
            }

            // 2. LocalStorage Sync
            localStorage.setItem('onhaus_tax_settings', JSON.stringify(settings));
            if (settings.gemini_api_key) {
                localStorage.setItem('onhaus_gemini_api_key', settings.gemini_api_key.trim());
            }

            toast.success('บันทึกการตั้งค่าระบบภาษีและ Gemini AI เรียบร้อยแล้ว');
            if (onSettingsUpdated) onSettingsUpdated(settings);
        } catch (err) {
            toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Save Customer Profile in Directory
    const handleSaveCustomer = async (e) => {
        e.preventDefault();
        const form = e.target;
        const payload = {
            customer_type: form.customer_type.value,
            company_name: form.company_name.value.trim(),
            tax_id: form.tax_id.value.replace(/\D/g, ''),
            branch_type: form.branch_type.value,
            branch_code: form.branch_type.value === 'head_office' ? '00000' : form.branch_code.value.trim(),
            address: form.address.value.trim(),
            phone: form.phone.value.trim(),
            email: form.email.value.trim()
        };

        if (!payload.company_name) {
            toast.error('กรุณาระบุชื่อบริษัท / ผู้ซื้อ');
            return;
        }

        try {
            let savedRecord = { ...payload, id: editingCustomer?.id || `local_${Date.now()}` };
            try {
                if (editingCustomer?.id && !String(editingCustomer.id).startsWith('local_')) {
                    const { data } = await supabase
                        .from('tax_customer_profiles')
                        .update(payload)
                        .eq('id', editingCustomer.id)
                        .select()
                        .single();
                    if (data) savedRecord = data;
                } else {
                    const { data } = await supabase
                        .from('tax_customer_profiles')
                        .insert([payload])
                        .select()
                        .single();
                    if (data) savedRecord = data;
                }
            } catch {
                // Fallback locally
            }

            let updatedList;
            if (editingCustomer) {
                updatedList = customers.map(c => c.id === editingCustomer.id ? savedRecord : c);
            } else {
                updatedList = [savedRecord, ...customers];
            }
            setCustomers(updatedList);
            localStorage.setItem('onhaus_tax_customer_profiles', JSON.stringify(updatedList));

            toast.success('บันทึกข้อมูลลูกค้าเรียบร้อยแล้ว');
            setShowCustomerModal(false);
            setEditingCustomer(null);
        } catch (err) {
            toast.error('บันทึกไม่สำเร็จ: ' + err.message);
        }
    };

    const handleDeleteCustomer = async (id, name) => {
        if (!confirm(`ต้องการลบรายชื่อ "${name}" หรือไม่?`)) return;
        try {
            if (!String(id).startsWith('local_')) {
                await supabase.from('tax_customer_profiles').delete().eq('id', id);
            }
        } catch {
            // Local deletion
        }
        const updated = customers.filter(c => c.id !== id);
        setCustomers(updated);
        localStorage.setItem('onhaus_tax_customer_profiles', JSON.stringify(updated));
        toast.success(`ลบรายชื่อ ${name} แล้ว`);
    };

    const filteredCustomers = customers.filter(c =>
        (c.company_name || '').toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.tax_id || '').includes(customerSearch)
    );

    return (
        <div className="space-y-8 text-xs">
            {/* VAT Transition Master Control (Switching between Non-VAT and VAT 7%) */}
            <div className={`border rounded-2xl p-5 sm:p-6 shadow-sm transition-all ${isVatOn ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-[#D1D1CD]'}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl font-mono font-bold text-sm ${isVatOn ? 'bg-[oklch(52%_0.16_28)] text-white' : 'bg-zinc-800 text-white'}`}>
                            {isVatOn ? 'VAT 7%' : 'NON-VAT'}
                        </div>
                        <div>
                            <h3 className="font-bold text-sm sm:text-base text-zinc-950">
                                สถานะการจดทะเบียนภาษีมูลค่าเพิ่ม (VAT Registration Status)
                            </h3>
                            <p className="text-[11px] text-zinc-600 mt-0.5">
                                {isVatOn 
                                    ? '✓ กำลังใช้งานโหมด: จดทะเบียนภาษีมูลค่าเพิ่ม 7% (ออกใบกำกับภาษีเต็มรูปแบบ และจัดทำรายงานภาษีขาย ภ.พ.30)' 
                                    : '• กำลังใช้งานโหมด: ยังไม่จดทะเบียนภาษีมูลค่าเพิ่ม (ออกใบเสร็จรับเงินทางการ ไม่คิด VAT 7% พร้อมสวิตช์เปิด VAT ได้ทันทีในปีหน้า)'}
                            </p>
                        </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                        type="button"
                        onClick={() => handleSettingChange('tax_is_vat_registered', isVatOn ? 'false' : 'true')}
                        className={`px-4 py-2 rounded-xl font-mono font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${isVatOn ? 'bg-[oklch(52%_0.16_28)] text-white' : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300'}`}
                    >
                        {isVatOn ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        <span>{isVatOn ? 'เปิดใช้งาน VAT 7% แล้ว' : 'สถานะปัจจุบัน: ยังไม่จด VAT'}</span>
                    </button>
                </div>
            </div>

            {/* Enterprise Tax Profile Card */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5 border-b border-zinc-200 pb-3">
                    <Building2 size={18} className="text-[oklch(52%_0.16_28)]" />
                    <div>
                        <h3 className="font-mono font-bold text-sm text-zinc-950 uppercase tracking-wider">
                            ข้อมูลผู้ประกอบการ / ร้านค้า (Seller Enterprise Profile)
                        </h3>
                        <p className="text-[11px] text-zinc-500 font-mono">
                            ข้อมูลส่วนนี้จะถูกพิมพ์ลงบนหัวเอกสารใบเสร็จรับเงิน และใบกำกับภาษีเต็มรูปแบบทุกฉบับ
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                            ชื่อนิติบุคคล / ชื่อร้านค้า (ภาษาไทย) *
                        </label>
                        <input
                            type="text"
                            value={settings.tax_company_name}
                            onChange={(e) => handleSettingChange('tax_company_name', e.target.value)}
                            placeholder="เช่น บริษัท อินเดอะเฮ้าส์ จำกัด"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-semibold focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                            Company Name (English)
                        </label>
                        <input
                            type="text"
                            value={settings.tax_company_name_en}
                            onChange={(e) => handleSettingChange('tax_company_name_en', e.target.value)}
                            placeholder="e.g. IN THE HAUS CO., LTD."
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    {/* Tax ID */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase">
                                เลขประจำตัวผู้เสียภาษี 13 หลัก (Tax ID)
                            </label>
                            {settings.tax_id && (
                                <span className={`font-mono text-[9px] font-bold ${isCompanyTaxIdValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {isCompanyTaxIdValid ? '✓ เลขถูกต้อง' : 'รูปแบบ 13 หลัก'}
                                </span>
                            )}
                        </div>
                        <input
                            type="text"
                            value={settings.tax_id}
                            onChange={(e) => handleSettingChange('tax_id', e.target.value)}
                            placeholder="01055xxxxxxxx หรือ เลขบัตรประชาชน"
                            maxLength={17}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    {/* Branch */}
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                สถานประกอบการ
                            </label>
                            <select
                                value={settings.tax_branch_type}
                                onChange={(e) => handleSettingChange('tax_branch_type', e.target.value)}
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium focus:border-zinc-900 focus:outline-none bg-white"
                            >
                                <option value="head_office">สำนักงานใหญ่ (Head Office)</option>
                                <option value="branch">สาขา (Branch Code)</option>
                            </select>
                        </div>
                        {settings.tax_branch_type === 'branch' && (
                            <div className="w-28">
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    รหัสสาขา 5 หลัก
                                </label>
                                <input
                                    type="text"
                                    value={settings.tax_branch_code}
                                    onChange={(e) => handleSettingChange('tax_branch_code', e.target.value)}
                                    placeholder="00001"
                                    maxLength={5}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs text-center focus:border-zinc-900 focus:outline-none"
                                />
                            </div>
                        )}
                    </div>

                    {/* Registered Address */}
                    <div className="sm:col-span-2">
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                            ที่อยู่จดทะเบียนตาม ภ.พ.20 / ทะเบียนพาณิชย์
                        </label>
                        <textarea
                            value={settings.tax_address}
                            onChange={(e) => handleSettingChange('tax_address', e.target.value)}
                            placeholder="เลขที่ อาคาร ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                            rows={2}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs leading-relaxed focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    {/* Phone & Email */}
                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                            เบอร์โทรศัพท์สำหรับเอกสาร
                        </label>
                        <input
                            type="text"
                            value={settings.tax_phone}
                            onChange={(e) => handleSettingChange('tax_phone', e.target.value)}
                            placeholder="08X-XXX-XXXX"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                            อีเมลฝ่ายบัญชี / ใบกำกับภาษี
                        </label>
                        <input
                            type="email"
                            value={settings.tax_email}
                            onChange={(e) => handleSettingChange('tax_email', e.target.value)}
                            placeholder="accounting@inthehaus.com"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs focus:border-zinc-900 focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Document Formatting & Calculation Rules */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-3">
                    <FileText size={18} className="text-zinc-700" />
                    <h3 className="font-mono font-bold text-sm text-zinc-950 uppercase tracking-wider">
                        การกำหนดรหัสเอกสาร & การคำนวณภาษี (Document & VAT Rules)
                    </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                            คำนำหน้าใบเสร็จรับเงิน (Non-VAT Prefix)
                        </label>
                        <input
                            type="text"
                            value={settings.tax_receipt_prefix}
                            onChange={(e) => handleSettingChange('tax_receipt_prefix', e.target.value)}
                            placeholder="REC"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs uppercase focus:border-zinc-900 focus:outline-none"
                        />
                        <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">ตัวอย่าง: REC-202608-0001</span>
                    </div>

                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                            คำนำหน้าใบกำกับภาษี (VAT Prefix)
                        </label>
                        <input
                            type="text"
                            value={settings.tax_invoice_prefix}
                            onChange={(e) => handleSettingChange('tax_invoice_prefix', e.target.value)}
                            placeholder="INV"
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs uppercase focus:border-zinc-900 focus:outline-none"
                        />
                        <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">ตัวอย่าง: INV-202608-0001</span>
                    </div>

                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                            รูปแบบการคิด VAT ในเมนู (เมื่อเปิด VAT)
                        </label>
                        <select
                            value={settings.tax_vat_model}
                            onChange={(e) => handleSettingChange('tax_vat_model', e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium focus:border-zinc-900 focus:outline-none bg-white"
                        >
                            <option value="inclusive">รวมภาษีในราคาแล้ว (Inclusive 7%)</option>
                            <option value="exclusive">ยังไม่รวมภาษี (Exclusive +7%)</option>
                        </select>
                        <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">ร้านอาหารส่วนใหญ่นิยมใช้ Inclusive</span>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveSettings}
                        className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-mono font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                    >
                        <Save size={15} />
                        <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า (SAVE SETTINGS)'}</span>
                    </button>
                </div>
            </div>

            {/* Google Gemini Vision AI OCR Engine Setup */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-zinc-200 pb-3">
                    <div className="p-1.5 bg-gradient-to-tr from-amber-500 to-orange-500 text-white rounded-lg">
                        <Bot size={18} />
                    </div>
                    <div>
                        <h3 className="font-mono font-bold text-sm text-zinc-950 uppercase tracking-wider flex items-center gap-2">
                            Google Gemini Vision AI (ระบบ AI สแกนบิลและแยกหมวดหมู่อัตโนมัติ)
                        </h3>
                        <p className="text-[11px] text-zinc-500 font-mono">
                            ใช้พลัง AI ของ Google ช่วยอ่านยอดรวม, วันที่, ชื่อร้าน, เลข 13 หลัก และแยกหมวดหมู่ Makro/ค่าน้ำไฟ/ค่าน้ำมัน ทันทีที่ถ่ายรูป
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                            Google Gemini API Key
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                value={settings.gemini_api_key}
                                onChange={(e) => handleSettingChange('gemini_api_key', e.target.value)}
                                placeholder="AIzaSy..."
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs focus:border-zinc-900 focus:outline-none"
                            />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                            💡 สมัครและรับ API Key ฟรีได้ที่ <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-orange-600 underline font-bold">Google AI Studio (aistudio.google.com)</a>
                        </span>
                    </div>

                    <div className="flex justify-end pt-1">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={handleSaveSettings}
                            className="px-5 py-2 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white rounded-lg font-mono font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                        >
                            <Save size={14} />
                            <span>บันทึก Gemini API Key</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Corporate Customer Directory (สมุดรายชื่อลูกค้าภาษี/บริษัทคู่ค้า) */}
            <div className="bg-white border border-[#D1D1CD] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
                    <div className="flex items-center gap-2">
                        <Users size={18} className="text-zinc-700" />
                        <div>
                            <h3 className="font-mono font-bold text-sm text-zinc-950 uppercase tracking-wider">
                                สมุดรายชื่อลูกค้าประจำสำหรับออกบิล (Customer Tax Directory)
                            </h3>
                            <p className="text-[11px] text-zinc-500 font-mono">
                                บันทึกข้อมูลบริษัทคู่ค้า / ลูกค้าประจำ เพื่อเลือกดึงข้อมูลมาออกเอกสารได้ใน 1 คลิก
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อบริษัท / Tax ID..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono w-44 sm:w-56 focus:border-zinc-900 focus:outline-none"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setEditingCustomer(null);
                                setShowCustomerModal(true);
                            }}
                            className="px-3 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg font-mono font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <Plus size={14} />
                            <span>เพิ่มลูกค้า</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-zinc-100 border-b border-zinc-300 font-mono text-[10px] uppercase text-zinc-700">
                                <th className="p-3">ชื่อบริษัท / ลูกค้า</th>
                                <th className="p-3 w-36">เลขประจำตัวผู้เสียภาษี</th>
                                <th className="p-3 w-32">สาขา</th>
                                <th className="p-3">ที่อยู่จดทะเบียน</th>
                                <th className="p-3 w-28">เบอร์โทร</th>
                                <th className="p-3 text-center w-20">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {filteredCustomers.map((c, idx) => (
                                <tr key={c.id || idx} className="hover:bg-zinc-50 transition-colors">
                                    <td className="p-3 font-semibold text-zinc-900">{c.company_name}</td>
                                    <td className="p-3 font-mono">{formatTaxId(c.tax_id)}</td>
                                    <td className="p-3 font-mono">{formatBranch(c.branch_type, c.branch_code)}</td>
                                    <td className="p-3 text-zinc-600 max-w-xs truncate" title={c.address}>{c.address}</td>
                                    <td className="p-3 font-mono">{c.phone || '-'}</td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditingCustomer(c);
                                                    setShowCustomerModal(true);
                                                }}
                                                className="p-1 text-zinc-600 hover:text-zinc-950 transition-colors cursor-pointer"
                                                title="แก้ไข"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCustomer(c.id, c.company_name)}
                                                className="p-1 text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
                                                title="ลบ"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredCustomers.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-zinc-400 font-mono">
                                        ยังไม่มีข้อมูลลูกค้าในสมุดรายชื่อ
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Customer Add/Edit Modal */}
            {showCustomerModal && (
                <div className="fixed inset-0 z-[170] flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-[#ECECE9] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#D1D1CD] font-sans text-xs">
                        <div className="bg-[#1A1A1A] text-white p-4 flex items-center justify-between">
                            <h3 className="font-mono font-bold text-sm uppercase">
                                {editingCustomer ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่ในสมุดรายชื่อ'}
                            </h3>
                            <button onClick={() => setShowCustomerModal(false)} className="p-1 text-white hover:bg-white/10 rounded cursor-pointer">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5 bg-white">
                            <div>
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    ประเภทลูกค้า
                                </label>
                                <select name="customer_type" defaultValue={editingCustomer?.customer_type || 'company'} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs">
                                    <option value="company">นิติบุคคล (บริษัท / หจก.)</option>
                                    <option value="individual">บุคคลธรรมดา</option>
                                </select>
                            </div>

                            <div>
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    ชื่อบริษัท / ลูกค้า *
                                </label>
                                <input
                                    type="text"
                                    name="company_name"
                                    defaultValue={editingCustomer?.company_name || ''}
                                    placeholder="เช่น บริษัท ทดสอบ จำกัด"
                                    required
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-semibold"
                                />
                            </div>

                            <div>
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    เลขประจำตัวผู้เสียภาษี 13 หลัก
                                </label>
                                <input
                                    type="text"
                                    name="tax_id"
                                    defaultValue={editingCustomer?.tax_id || ''}
                                    placeholder="01055xxxxxxxx"
                                    maxLength={13}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                        สถานประกอบการ
                                    </label>
                                    <select name="branch_type" defaultValue={editingCustomer?.branch_type || 'head_office'} className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs">
                                        <option value="head_office">สำนักงานใหญ่</option>
                                        <option value="branch">สาขา</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                        รหัสสาขา
                                    </label>
                                    <input
                                        type="text"
                                        name="branch_code"
                                        defaultValue={editingCustomer?.branch_code || '00000'}
                                        placeholder="00000"
                                        maxLength={5}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs text-center"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    ที่อยู่จดทะเบียนตาม ภ.พ.20
                                </label>
                                <textarea
                                    name="address"
                                    defaultValue={editingCustomer?.address || ''}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                        เบอร์โทรศัพท์
                                    </label>
                                    <input
                                        type="text"
                                        name="phone"
                                        defaultValue={editingCustomer?.phone || ''}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                        อีเมล
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        defaultValue={editingCustomer?.email || ''}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCustomerModal(false)}
                                    className="px-4 py-2 border border-zinc-300 text-zinc-700 rounded-lg font-mono font-bold text-xs"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-mono font-bold text-xs"
                                >
                                    บันทึกข้อมูล
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
