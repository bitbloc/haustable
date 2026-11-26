import React, { useState, useEffect, useRef } from 'react';
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
    Key,
    PenTool,
    Upload,
    RotateCcw,
    Image as ImageIcon,
    Check
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { validateThaiTaxId, formatTaxId, formatBranch } from '../../../utils/thaiTaxHelper';
import { saveTaxCustomerProfile } from '../../../utils/taxCustomerDirectory';
import { GEMINI_SUPPORTED_MODELS, saveGeminiApiKey } from '../../../utils/geminiOcrHelper';
import { withoutSecretSettings } from '../../../utils/secretSettingKeys';
import { toast } from 'sonner';

export default function TaxSettingsTab({ 
    companySettings = {}, 
    onSettingsUpdated 
}) {
    // Form Settings State
    const [settings, setSettings] = useState({
        tax_is_vat_registered: 'false',
        tax_company_name: 'ร้านในบ้าน นครพนม',
        tax_company_name_en: 'IN THE HAUS NAKHON PHANOM',
        tax_proprietor_name: 'นายธนภัทร บุญเจริญ',
        tax_citizen_id: '',
        tax_establishment_name: 'ร้านในบ้าน นครพนม',
        tax_id: '',
        tax_branch_type: 'head_office',
        tax_branch_code: '00000',
        tax_address: '788/1, สุนทรวิจิตร ซ.พนมพนารักษ์ ในเมือง เมืองนครพนม นครพนม 48000',
        tax_phone: '',
        tax_email: '',
        tax_vat_rate: '7.00',
        tax_vat_model: 'inclusive',
        tax_receipt_prefix: 'REC',
        tax_invoice_prefix: 'INV',
        tax_wht_prefix: 'WHT',
        tax_signature_name: 'ผู้มีอำนาจลงนาม / ผู้รับเงิน',
        tax_signature_position: 'ผู้จัดการร้าน / กรรมการผู้มีอำนาจ',
        tax_signature_image: localStorage.getItem('onhaus_tax_signature_image') || '',
        tax_signature_enabled: 'true',
        gemini_model: localStorage.getItem('onhaus_gemini_model') || 'gemini-4-argon'
    });

    // Write-only: a new key typed here is saved, the stored key is never shown
    const [newGeminiKey, setNewGeminiKey] = useState('');
    const [saving, setSaving] = useState(false);
    const [signatureMode, setSignatureMode] = useState('draw'); // 'draw' | 'upload'
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    // Customer Directory State
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [showCustomerModal, setShowCustomerModal] = useState(false);

    useEffect(() => {
        if (companySettings && Object.keys(companySettings).length > 0) {
            setSettings(prev => ({
                ...prev,
                ...withoutSecretSettings(companySettings)
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

    // Canvas Drawing Handlers
    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if (e.touches && e.touches[0]) {
            return {
                x: (e.touches[0].clientX - rect.left) * scaleX,
                y: (e.touches[0].clientY - rect.top) * scaleY
            };
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const coords = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        setIsDrawing(true);
        setHasDrawn(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        if (e.cancelable && e.type.startsWith('touch')) e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const coords = getCoordinates(e);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    };

    const saveCanvasSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas || !hasDrawn) {
            toast.error('กรุณาวาดลายเซ็นบนผืนผ้าใบก่อนกดบันทึก');
            return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        handleSettingChange('tax_signature_image', dataUrl);
        localStorage.setItem('onhaus_tax_signature_image', dataUrl);
        toast.success('นำลายเซ็นจากการวาดไปใช้งานแล้ว (อย่าลืมกดปุ่มบันทึกการตั้งค่า)');
    };

    const handleSignatureImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('กรุณาเลือกไฟล์รูปภาพ');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            handleSettingChange('tax_signature_image', dataUrl);
            localStorage.setItem('onhaus_tax_signature_image', dataUrl);
            toast.success('อัปโหลดรูปลายเซ็น/ตรายางเรียบร้อยแล้ว');
        };
        reader.readAsDataURL(file);
    };

    const removeSignatureImage = () => {
        handleSettingChange('tax_signature_image', '');
        localStorage.removeItem('onhaus_tax_signature_image');
        clearCanvas();
        toast.info('ลบลายเซ็นออกจากระบบแล้ว');
    };

    // Save Settings
    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const entries = Object.entries(withoutSecretSettings(settings)).map(([key, value]) => ({
                key,
                value: String(value)
            }));

            // 1. Try Upserting to Supabase app_settings
            try {
                await supabase.from('app_settings').upsert(entries, { onConflict: 'key' });
            } catch (e) {
                console.warn('app_settings upsert error:', e);
            }

            if (newGeminiKey.trim()) {
                await saveGeminiApiKey(newGeminiKey.trim());
                setNewGeminiKey('');
            }

            // 2. LocalStorage Sync
            localStorage.setItem('onhaus_tax_settings', JSON.stringify(withoutSecretSettings(settings)));
            if (settings.tax_signature_image) {
                localStorage.setItem('onhaus_tax_signature_image', settings.tax_signature_image);
            }
            if (settings.gemini_model) {
                localStorage.setItem('onhaus_gemini_model', settings.gemini_model.trim());
            }

            toast.success('บันทึกการตั้งค่าระบบภาษี ลายเซ็น และ Gemini AI เรียบร้อยแล้ว');
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
            let savedRecord;
            let mergedIntoExisting = false;
            if (editingCustomer?.id && !String(editingCustomer.id).startsWith('local_')) {
                const { data, error } = await supabase
                    .from('tax_customer_profiles')
                    .update({ ...payload, updated_at: new Date().toISOString() })
                    .eq('id', editingCustomer.id)
                    .select()
                    .single();
                if (error || !data) throw new Error(error?.message || 'บันทึกไม่สำเร็จ');
                savedRecord = data;
            } else {
                // Adding a customer who is already in the list updates that entry instead
                const { record, updated } = await saveTaxCustomerProfile(payload);
                savedRecord = record;
                mergedIntoExisting = updated;
            }

            const updatedList = [savedRecord, ...customers.filter(c => c.id !== savedRecord.id && c.id !== editingCustomer?.id)];
            if (mergedIntoExisting) toast.info('มีลูกค้ารายนี้อยู่แล้ว อัปเดตข้อมูลให้แทนการเพิ่มซ้ำ');
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
            <div className={`border rounded-2xl p-5 sm:p-6 transition-all ${isVatOn ? 'bg-amber-50/70 border-amber-300' : 'bg-[var(--color-paper)] border-[#D1D1CD]'}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl tabular-nums font-bold text-sm ${isVatOn ? 'bg-[var(--brand-plum)] text-[var(--color-paper)]' : 'bg-[var(--color-ink)] text-[var(--color-paper)]'}`}>
                            {isVatOn ? 'VAT 7%' : 'ไม่จด VAT'}
                        </div>
                        <div>
                            <h3 className="font-bold text-sm sm:text-base text-[var(--color-ink)]">
                                สถานะการจดทะเบียนภาษีมูลค่าเพิ่ม
                            </h3>
                            <p className="text-[13px] text-[var(--color-muted)] mt-0.5">
                                {isVatOn 
                                    ? 'กำลังใช้งานโหมด: จดทะเบียนภาษีมูลค่าเพิ่ม 7% (ออกใบกำกับภาษีเต็มรูปแบบ และจัดทำรายงานภาษีขาย ภ.พ.30)' 
                                    : '• กำลังใช้งานโหมด: ยังไม่จดทะเบียนภาษีมูลค่าเพิ่ม (ออกใบเสร็จรับเงินทางการ ไม่คิด VAT 7% พร้อมสวิตช์เปิด VAT ได้ทันทีในปีหน้า)'}
                            </p>
                        </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                        type="button"
                        onClick={() => handleSettingChange('tax_is_vat_registered', isVatOn ? 'false' : 'true')}
                        className={`px-4 py-2 rounded-xl tabular-nums font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md ${isVatOn ? 'bg-[var(--brand-plum)] text-[var(--color-paper)]' : 'bg-[var(--color-paper-3)] text-[var(--color-ink)] hover:bg-zinc-300'}`}
                    >
                        {isVatOn ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        <span>{isVatOn ? 'เปิดใช้งาน VAT 7% แล้ว' : 'สถานะปัจจุบัน: ยังไม่จด VAT'}</span>
                    </button>
                </div>
            </div>

            {/* Enterprise Tax Profile Card */}
            <div className="bg-[var(--color-paper)] border border-[#D1D1CD] rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-2.5 border-b border-[var(--color-paper-3)] pb-3">
                    <Building2 size={18} className="text-[var(--brand-plum)]" />
                    <div>
                        <h3 className="tabular-nums font-bold text-sm text-[var(--color-ink)]  ">
                            ข้อมูลผู้ประกอบการ / ร้านค้า
                        </h3>
                        <p className="text-[13px] text-[var(--color-neutral)] tabular-nums">
                            ข้อมูลส่วนนี้จะถูกพิมพ์ลงบนหัวเอกสารใบเสร็จรับเงิน และใบกำกับภาษีเต็มรูปแบบทุกฉบับ
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            ชื่อนิติบุคคล / ชื่อร้านค้า (ภาษาไทย) *
                        </label>
                        <input
                            type="text"
                            value={settings.tax_company_name}
                            onChange={(e) => handleSettingChange('tax_company_name', e.target.value)}
                            placeholder="เช่น บริษัท อินเดอะเฮ้าส์ จำกัด"
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs font-semibold focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            Company Name (English)
                        </label>
                        <input
                            type="text"
                            value={settings.tax_company_name_en}
                            onChange={(e) => handleSettingChange('tax_company_name_en', e.target.value)}
                            placeholder="เช่น IN THE HAUS CO., LTD."
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    {/* Tax ID */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] ">
                                เลขประจำตัวผู้เสียภาษี 13 หลัก
                            </label>
                            {settings.tax_id && (
                                <span className={`tabular-nums text-xs font-bold ${isCompanyTaxIdValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                    {isCompanyTaxIdValid ? 'เลขถูกต้อง' : 'รูปแบบ 13 หลัก'}
                                </span>
                            )}
                        </div>
                        <input
                            type="text"
                            value={settings.tax_id}
                            onChange={(e) => handleSettingChange('tax_id', e.target.value)}
                            placeholder="01055xxxxxxxx หรือ เลขบัตรประชาชน"
                            maxLength={17}
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    {/* Branch */}
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                สถานประกอบการ
                            </label>
                            <select
                                value={settings.tax_branch_type}
                                onChange={(e) => handleSettingChange('tax_branch_type', e.target.value)}
                                className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs font-medium focus:border-zinc-900 focus:outline-none bg-[var(--color-paper)]"
                            >
                                <option value="head_office">สำนักงานใหญ่</option>
                                <option value="branch">สาขา</option>
                            </select>
                        </div>
                        {settings.tax_branch_type === 'branch' && (
                            <div className="w-28">
                                <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                    รหัสสาขา 5 หลัก
                                </label>
                                <input
                                    type="text"
                                    value={settings.tax_branch_code}
                                    onChange={(e) => handleSettingChange('tax_branch_code', e.target.value)}
                                    placeholder="00001"
                                    maxLength={5}
                                    className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs text-center focus:border-zinc-900 focus:outline-none"
                                />
                            </div>
                        )}
                    </div>

                    {/* Registered Address */}
                    <div className="sm:col-span-2">
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            ที่อยู่จดทะเบียนตาม ภ.พ.20 / ทะเบียนพาณิชย์
                        </label>
                        <textarea
                            value={settings.tax_address}
                            onChange={(e) => handleSettingChange('tax_address', e.target.value)}
                            placeholder="เลขที่ อาคาร ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                            rows={2}
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs leading-relaxed focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    {/* Phone & Email */}
                    <div>
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            เบอร์โทรศัพท์สำหรับเอกสาร
                        </label>
                        <input
                            type="text"
                            value={settings.tax_phone}
                            onChange={(e) => handleSettingChange('tax_phone', e.target.value)}
                            placeholder="08X-XXX-XXXX"
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            อีเมลฝ่ายบัญชี / ใบกำกับภาษี
                        </label>
                        <input
                            type="email"
                            value={settings.tax_email}
                            onChange={(e) => handleSettingChange('tax_email', e.target.value)}
                            placeholder="accounting@inthehaus.com"
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs focus:border-zinc-900 focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Individual Taxpayer & Revenue Dept Form 161 Metadata Card */}
            <div className="bg-[var(--color-paper)] border border-[#D1D1CD] rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-2.5 border-b border-[var(--color-paper-3)] pb-3">
                    <ShieldCheck size={18} className="text-emerald-700" />
                    <div>
                        <h3 className="tabular-nums font-bold text-sm text-[var(--color-ink)]  ">
                            ข้อมูลรายงานเงินสด รับ-จ่าย บุคคลธรรมดา (ม.161 &amp; Excel Template)
                        </h3>
                        <p className="text-[13px] text-[var(--color-neutral)] tabular-nums">
                            ข้อมูลสำหรับพิมพ์ลงหัวรายงานเงินสด รับ - จ่าย และส่งออก Excel ตามแบบฟอร์มกรมสรรพากร
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            ชื่อผู้ประกอบกิจการ (บุคคลธรรมดา) *
                        </label>
                        <input
                            type="text"
                            value={settings.tax_proprietor_name}
                            onChange={(e) => handleSettingChange('tax_proprietor_name', e.target.value)}
                            placeholder="เช่น นายธนภัทร บุญเจริญ"
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs font-semibold focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            เลขประจำตัวประชาชน (13 หลัก) *
                        </label>
                        <input
                            type="text"
                            value={settings.tax_citizen_id}
                            onChange={(e) => handleSettingChange('tax_citizen_id', e.target.value)}
                            placeholder="เลข 13 หลัก"
                            maxLength={17}
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs focus:border-zinc-900 focus:outline-none"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            ชื่อสถานประกอบการ
                        </label>
                        <input
                            type="text"
                            value={settings.tax_establishment_name}
                            onChange={(e) => handleSettingChange('tax_establishment_name', e.target.value)}
                            placeholder="เช่น ร้านในบ้าน นครพนม"
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs font-semibold focus:border-zinc-900 focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Document Formatting & Calculation Rules */}
            <div className="bg-[var(--color-paper)] border border-[#D1D1CD] rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--color-paper-3)] pb-3">
                    <FileText size={18} className="text-[var(--color-muted)]" />
                    <h3 className="tabular-nums font-bold text-sm text-[var(--color-ink)]  ">
                        การกำหนดรหัสเอกสาร & การคำนวณภาษี
                    </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            คำนำหน้าใบเสร็จรับเงิน
                        </label>
                        <input
                            type="text"
                            value={settings.tax_receipt_prefix}
                            onChange={(e) => handleSettingChange('tax_receipt_prefix', e.target.value)}
                            placeholder="REC"
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs focus:border-zinc-900 focus:outline-none"
                        />
                        <span className="text-xs text-[var(--color-neutral)] tabular-nums mt-0.5 block">ตัวอย่าง: REC-202608-0001</span>
                    </div>

                    <div>
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            คำนำหน้าใบกำกับภาษี
                        </label>
                        <input
                            type="text"
                            value={settings.tax_invoice_prefix}
                            onChange={(e) => handleSettingChange('tax_invoice_prefix', e.target.value)}
                            placeholder="INV"
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs focus:border-zinc-900 focus:outline-none"
                        />
                        <span className="text-xs text-[var(--color-neutral)] tabular-nums mt-0.5 block">ตัวอย่าง: INV-202608-0001</span>
                    </div>

                    <div>
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            รูปแบบการคิด VAT ในเมนู (เมื่อเปิด VAT)
                        </label>
                        <select
                            value={settings.tax_vat_model}
                            onChange={(e) => handleSettingChange('tax_vat_model', e.target.value)}
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs font-medium focus:border-zinc-900 focus:outline-none bg-[var(--color-paper)]"
                        >
                            <option value="inclusive">รวมภาษีในราคาแล้ว</option>
                            <option value="exclusive">ยังไม่รวมภาษี (บวกเพิ่ม 7%)</option>
                        </select>
                        <span className="text-xs text-[var(--color-neutral)] tabular-nums mt-0.5 block">ร้านอาหารส่วนใหญ่ใช้แบบรวมภาษีในราคา</span>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveSettings}
                        className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-[var(--color-ink)] text-[var(--color-paper)] rounded-lg tabular-nums font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                    >
                        <Save size={15} />
                        <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
                    </button>
                </div>
            </div>

            {/* Digital Signature & Official Stamp Manager */}
            <div className="bg-[var(--color-paper)] border border-[#D1D1CD] rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-paper-3)] pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] rounded-lg">
                            <PenTool size={18} />
                        </div>
                        <div>
                            <h3 className="tabular-nums font-bold text-sm text-[var(--color-ink)] flex items-center gap-2">
                                ระบบลายเซ็นดิจิทัล &amp; ตรายางประจำร้าน
                            </h3>
                            <p className="text-[13px] text-[var(--color-neutral)] tabular-nums">
                                เพิ่มลายเซ็นผู้มีอำนาจลงนาม เพื่อพิมพ์ลงในช่องผู้รับเงินของใบเสร็จรับเงินและใบกำกับภาษีอัตโนมัติ
                            </p>
                        </div>
                    </div>

                    {/* Enable / Disable Signature Toggle */}
                    <button
                        type="button"
                        onClick={() => handleSettingChange('tax_signature_enabled', settings.tax_signature_enabled === 'true' ? 'false' : 'true')}
                        className={`px-3 py-1.5 rounded-lg tabular-nums font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                            settings.tax_signature_enabled === 'true'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border border-[var(--color-rule)]'
                        }`}
                    >
                        {settings.tax_signature_enabled === 'true' ? <ToggleRight size={18} className="text-emerald-700" /> : <ToggleLeft size={18} />}
                        <span>{settings.tax_signature_enabled === 'true' ? 'แสดงลายเซ็นในเอกสาร' : 'ปิดการแสดงลายเซ็น'}</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Signer Information Form (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                        <div>
                            <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                ชื่อผู้มีอำนาจลงนาม / ผู้รับเงิน *
                            </label>
                            <input
                                type="text"
                                value={settings.tax_signature_name}
                                onChange={(e) => handleSettingChange('tax_signature_name', e.target.value)}
                                placeholder="เช่น นาย ธนวัฒน์ หรือ ผู้มีอำนาจลงนาม"
                                className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs font-semibold focus:border-zinc-900 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                ตำแหน่งผู้ลงนาม
                            </label>
                            <input
                                type="text"
                                value={settings.tax_signature_position}
                                onChange={(e) => handleSettingChange('tax_signature_position', e.target.value)}
                                placeholder="เช่น ผู้จัดการร้าน / กรรมการผู้จัดการ"
                                className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs focus:border-zinc-900 focus:outline-none"
                            />
                        </div>

                        {/* Signature Status & Quick Actions */}
                        <div className="p-3.5 bg-[var(--color-paper)] border border-[var(--color-paper-3)] rounded-xl space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="tabular-nums font-bold text-xs text-[var(--color-neutral)] ">สถานะลายเซ็นปัจจุบัน:</span>
                                {settings.tax_signature_image ? (
                                    <span className="tabular-nums font-bold text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                        <Check size={11} /> มีลายเซ็นในระบบแล้ว
                                    </span>
                                ) : (
                                    <span className="tabular-nums text-xs text-[var(--color-neutral)]">ยังไม่มีลายเซ็น</span>
                                )}
                            </div>

                            {settings.tax_signature_image && (
                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-xs text-[var(--color-muted)]">จัดการไฟล์ลายเซ็น:</span>
                                    <button
                                        type="button"
                                        onClick={removeSignatureImage}
                                        className="px-2 py-1 text-red-600 hover:bg-red-50 rounded tabular-nums text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                        <Trash2 size={12} />
                                        <span>ลบลายเซ็นออก</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleSaveSettings}
                                className="w-full py-2.5 bg-[#1A1A1A] hover:bg-[var(--color-ink)] text-[var(--color-paper)] rounded-lg tabular-nums font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <Save size={14} />
                                <span>บันทึกข้อมูลลายเซ็น &amp; การตั้งค่า</span>
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Signature Creator (Canvas / Upload) & Live Preview (7 cols) */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* Mode Selector */}
                        <div className="flex border border-[var(--color-rule)] rounded-lg p-1 bg-[var(--color-paper-2)] text-xs tabular-nums font-bold">
                            <button
                                type="button"
                                onClick={() => setSignatureMode('draw')}
                                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                    signatureMode === 'draw'
                                        ? 'bg-[var(--color-paper)] text-[var(--color-ink)] '
                                        : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                }`}
                            >
                                <PenTool size={13} />
                                <span>1. วาดลายเซ็นสด</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSignatureMode('upload')}
                                className={`flex-1 py-1.5 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                    signatureMode === 'upload'
                                        ? 'bg-[var(--color-paper)] text-[var(--color-ink)] '
                                        : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                }`}
                            >
                                <Upload size={13} />
                                <span>2. อัปโหลดรูปภาพ</span>
                            </button>
                        </div>

                        {/* 1. Interactive Drawing Canvas Mode */}
                        {signatureMode === 'draw' && (
                            <div className="border border-[var(--color-rule)] rounded-xl p-3 bg-[var(--color-paper)] space-y-2.5">
                                <div className="flex items-center justify-between text-xs text-[var(--color-neutral)] tabular-nums">
                                    <span>ใช้นิ้วมือ, เมาส์ หรือปากกาสไตลัสเซ็นชื่อลงในกรอบ:</span>
                                    <span className="text-[var(--color-neutral)] text-xs">ความหนาเส้น 2.5px คมชัด</span>
                                </div>

                                <div className="relative border-2 border-dashed border-[var(--color-rule)] rounded-lg bg-zinc-50/50 overflow-hidden flex items-center justify-center touch-none">
                                    <canvas
                                        ref={canvasRef}
                                        width={480}
                                        height={160}
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                        className="w-full h-36 cursor-crosshair bg-transparent"
                                    />
                                    {/* Baseline guide line */}
                                    <div className="absolute bottom-7 left-8 right-8 border-b border-[var(--color-paper-3)] pointer-events-none text-xs tabular-nums text-[var(--color-neutral)] flex justify-between">
                                        <span>เส้นฐานลายเซ็น</span>
                                        <span>IN THE HAUS</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                    <button
                                        type="button"
                                        onClick={clearCanvas}
                                        className="px-3 py-1.5 border border-[var(--color-rule)] text-[var(--color-muted)] hover:bg-[var(--color-paper-2)] rounded-lg tabular-nums text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <RotateCcw size={13} />
                                        <span>ล้างผ้าใบ</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={saveCanvasSignature}
                                        className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-[var(--color-paper)] rounded-lg tabular-nums font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer "
                                    >
                                        <Check size={14} />
                                        <span>นำลายเซ็นที่วาดไปใช้งาน</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 2. File Upload Mode */}
                        {signatureMode === 'upload' && (
                            <div className="border border-[var(--color-rule)] rounded-xl p-4 bg-[var(--color-paper)] space-y-3">
                                <label className="border-2 border-dashed border-[var(--color-rule)] hover:border-zinc-500 rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-zinc-50/50 hover:bg-[var(--color-paper)] transition-colors block text-center">
                                    <ImageIcon size={28} className="text-[var(--color-neutral)]" />
                                    <div className="tabular-nums font-bold text-xs text-[var(--color-ink)]">
                                        คลิกเพื่อเลือกไฟล์รูปลายเซ็น หรือรูปตรายาง
                                    </div>
                                    <p className="text-[13px] text-[var(--color-neutral)] tabular-nums">
                                        รองรับไฟล์ .PNG (แนะนำพื้นหลังโปร่งใส Transparent), .JPG, .SVG (ขนาดไม่เกิน 5MB)
                                    </p>
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/svg+xml"
                                        onChange={handleSignatureImageUpload}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        )}

                        {/* Live Document Preview Box */}
                        <div className="border border-[var(--color-rule)] rounded-xl p-4 bg-[var(--color-paper)] space-y-2">
                            <div className="tabular-nums font-bold text-xs text-[var(--color-neutral)] flex items-center justify-between">
                                <span>ตัวอย่างการแสดงผลบนเอกสารจริง</span>
                                <span className="text-xs text-[var(--color-neutral)]">มาตรา 86/4 &amp; 105</span>
                            </div>

                            <div className="bg-[var(--color-paper)] border border-zinc-900 p-4 max-w-sm mx-auto text-center tabular-nums text-xs space-y-1 ">
                                {/* Signature line container with overlay */}
                                <div className="relative w-48 mx-auto h-16 flex items-end justify-center mb-1">
                                    {settings.tax_signature_image && settings.tax_signature_enabled === 'true' ? (
                                        <img
                                            src={settings.tax_signature_image}
                                            alt="Signature"
                                            className="max-h-14 max-w-full object-contain filter drop-shadow-xs"
                                        />
                                    ) : (
                                        <div className="text-xs text-[var(--color-neutral)] italic pb-1">
                                            {settings.tax_signature_enabled === 'false' ? '(ปิดการแสดงลายเซ็น)' : '(ยังไม่ได้ใส่ลายเซ็น)'}
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 border-b border-zinc-900"></div>
                                </div>

                                <div className="font-bold text-[var(--color-ink)] text-xs">
                                    ( {settings.tax_signature_name || 'ผู้มีอำนาจลงนาม'} )
                                </div>
                                {settings.tax_signature_position && (
                                    <div className="text-xs text-[var(--color-muted)] font-sans">
                                        ตำแหน่ง: {settings.tax_signature_position}
                                    </div>
                                )}
                                <div className="text-xs text-[var(--color-neutral)]">
                                    วันที่ / Date: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Google Gemini Vision AI OCR Engine Setup */}
            <div className="bg-[var(--color-paper)] border border-[#D1D1CD] rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-[var(--color-paper-3)] pb-3">
                    <div className="p-1.5 bg-gradient-to-tr from-amber-500 to-orange-500 text-[var(--color-paper)] rounded-lg">
                        <Bot size={18} />
                    </div>
                    <div>
                        <h3 className="tabular-nums font-bold text-sm text-[var(--color-ink)] flex items-center gap-2">
                            Google Gemini Vision AI (ระบบ AI สแกนบิลและแยกหมวดหมู่อัตโนมัติ)
                        </h3>
                        <p className="text-[13px] text-[var(--color-neutral)] tabular-nums">
                            ใช้พลัง AI ของ Google ช่วยอ่านยอดรวม, วันที่, ชื่อร้าน, เลข 13 หลัก และแยกหมวดหมู่ Makro/ค่าน้ำไฟ/ค่าน้ำมัน ทันทีที่ถ่ายรูป
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            Google Gemini API Key
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                value={newGeminiKey}
                                onChange={(e) => setNewGeminiKey(e.target.value)}
                                autoComplete="off"
                                placeholder="กรอกเฉพาะเมื่อต้องการเปลี่ยน key"
                                className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs focus:border-zinc-900 focus:outline-none"
                            />
                        </div>
                        <span className="text-xs text-[var(--color-neutral)] tabular-nums mt-1 block">
                            Key เก็บไว้ที่เซิร์ฟเวอร์ ไม่แสดงในหน้านี้และไม่อยู่ในเครื่อง ตอนสร้าง key ให้จำกัดใช้ได้เฉพาะ Generative Language API · รับ API Key ได้ที่ <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-orange-600 underline font-bold">Google AI Studio (aistudio.google.com)</a>
                        </span>
                    </div>

                    <div>
                        <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                            โมเดล Gemini AI (Default Model)
                        </label>
                        <select
                            value={settings.gemini_model}
                            onChange={(e) => handleSettingChange('gemini_model', e.target.value)}
                            className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs focus:border-zinc-900 focus:outline-none bg-[var(--color-paper)]"
                        >
                            {GEMINI_SUPPORTED_MODELS.map(m => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                        </select>
                        <span className="text-xs text-[var(--color-neutral)] tabular-nums mt-1 block">
                            * หากโมเดลที่เลือกไม่พร้อมใช้งาน ระบบจะสลับไปยังโมเดลอื่นโดยอัตโนมัติ (Fallback Cascade: Gemini 4 Argon &rarr; Gemini 3.7 Flash &rarr; 2.5 Flash &rarr; 2.0 Flash)
                        </span>
                    </div>

                    <div className="flex justify-end pt-1">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={handleSaveSettings}
                            className="px-5 py-2 bg-[var(--brand-plum)] hover:bg-[var(--brand-plum)] text-[var(--color-paper)] rounded-lg tabular-nums font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <Save size={14} />
                            <span>บันทึก Gemini API Key</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Corporate Customer Directory (สมุดรายชื่อลูกค้าภาษี/บริษัทคู่ค้า) */}
            <div className="bg-[var(--color-paper)] border border-[#D1D1CD] rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-paper-3)] pb-3">
                    <div className="flex items-center gap-2">
                        <Users size={18} className="text-[var(--color-muted)]" />
                        <div>
                            <h3 className="tabular-nums font-bold text-sm text-[var(--color-ink)]  ">
                                สมุดรายชื่อลูกค้าประจำสำหรับออกบิล
                            </h3>
                            <p className="text-[13px] text-[var(--color-neutral)] tabular-nums">
                                บันทึกข้อมูลบริษัทคู่ค้า / ลูกค้าประจำ เพื่อเลือกดึงข้อมูลมาออกเอกสารได้ใน 1 คลิก
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-neutral)]" />
                            <input
                                type="text"
                                placeholder="ค้นหาชื่อบริษัท / Tax ID..."
                                value={customerSearch}
                                onChange={(e) => setCustomerSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 border border-[var(--color-rule)] rounded-lg text-xs tabular-nums w-44 sm:w-56 focus:border-zinc-900 focus:outline-none"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setEditingCustomer(null);
                                setShowCustomerModal(true);
                            }}
                            className="px-3 py-1.5 bg-[var(--color-ink)] hover:bg-[var(--color-ink)] text-[var(--color-paper)] rounded-lg tabular-nums font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <Plus size={14} />
                            <span>เพิ่มลูกค้า</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[13px]">
                        <thead>
                            <tr className="bg-[var(--color-paper-2)] border-b border-[var(--color-rule)] tabular-nums text-xs text-[var(--color-muted)]">
                                <th className="p-3">ชื่อบริษัท / ลูกค้า</th>
                                <th className="p-3 w-36">เลขประจำตัวผู้เสียภาษี</th>
                                <th className="p-3 w-32">สาขา</th>
                                <th className="p-3">ที่อยู่จดทะเบียน</th>
                                <th className="p-3 w-28">เบอร์โทร</th>
                                <th className="p-3 text-center w-20">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-paper-3)]">
                            {filteredCustomers.map((c, idx) => (
                                <tr key={c.id || idx} className="hover:bg-[var(--color-paper)] transition-colors">
                                    <td className="p-3 font-semibold text-[var(--color-ink)]">{c.company_name}</td>
                                    <td className="p-3 tabular-nums">{formatTaxId(c.tax_id)}</td>
                                    <td className="p-3 tabular-nums">{formatBranch(c.branch_type, c.branch_code)}</td>
                                    <td className="p-3 text-[var(--color-muted)] max-w-xs truncate" title={c.address}>{c.address}</td>
                                    <td className="p-3 tabular-nums">{c.phone || '-'}</td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditingCustomer(c);
                                                    setShowCustomerModal(true);
                                                }}
                                                className="p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                                                title="แก้ไข"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCustomer(c.id, c.company_name)}
                                                className="p-1 text-[var(--color-neutral)] hover:text-red-600 transition-colors cursor-pointer"
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
                                    <td colSpan={6} className="p-8 text-center text-[var(--color-neutral)] tabular-nums">
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
                        <div className="bg-[#1A1A1A] text-[var(--color-paper)] p-4 flex items-center justify-between">
                            <h3 className="tabular-nums font-bold text-sm ">
                                {editingCustomer ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่ในสมุดรายชื่อ'}
                            </h3>
                            <button onClick={() => setShowCustomerModal(false)} className="p-1 text-[var(--color-paper)] hover:bg-white/10 rounded cursor-pointer">
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5 bg-[var(--color-paper)]">
                            <div>
                                <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                    ประเภทลูกค้า
                                </label>
                                <select name="customer_type" defaultValue={editingCustomer?.customer_type || 'company'} className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs">
                                    <option value="company">นิติบุคคล (บริษัท / หจก.)</option>
                                    <option value="individual">บุคคลธรรมดา</option>
                                </select>
                            </div>

                            <div>
                                <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                    ชื่อบริษัท / ลูกค้า *
                                </label>
                                <input
                                    type="text"
                                    name="company_name"
                                    defaultValue={editingCustomer?.company_name || ''}
                                    placeholder="เช่น บริษัท ทดสอบ จำกัด"
                                    required
                                    className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs font-semibold"
                                />
                            </div>

                            <div>
                                <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                    เลขประจำตัวผู้เสียภาษี 13 หลัก
                                </label>
                                <input
                                    type="text"
                                    name="tax_id"
                                    defaultValue={editingCustomer?.tax_id || ''}
                                    placeholder="01055xxxxxxxx"
                                    maxLength={13}
                                    className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                        สถานประกอบการ
                                    </label>
                                    <select name="branch_type" defaultValue={editingCustomer?.branch_type || 'head_office'} className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs">
                                        <option value="head_office">สำนักงานใหญ่</option>
                                        <option value="branch">สาขา</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                        รหัสสาขา
                                    </label>
                                    <input
                                        type="text"
                                        name="branch_code"
                                        defaultValue={editingCustomer?.branch_code || '00000'}
                                        placeholder="00000"
                                        maxLength={5}
                                        className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs text-center"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                    ที่อยู่จดทะเบียนตาม ภ.พ.20
                                </label>
                                <textarea
                                    name="address"
                                    defaultValue={editingCustomer?.address || ''}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                        เบอร์โทรศัพท์
                                    </label>
                                    <input
                                        type="text"
                                        name="phone"
                                        defaultValue={editingCustomer?.phone || ''}
                                        className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="tabular-nums font-bold text-xs text-[var(--color-neutral)] block mb-1">
                                        อีเมล
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        defaultValue={editingCustomer?.email || ''}
                                        className="w-full px-3 py-2 border border-[var(--color-rule)] rounded-lg tabular-nums text-xs"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCustomerModal(false)}
                                    className="px-4 py-2 border border-[var(--color-rule)] text-[var(--color-muted)] rounded-lg tabular-nums font-bold text-xs"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-[#1A1A1A] hover:bg-[var(--color-ink)] text-[var(--color-paper)] rounded-lg tabular-nums font-bold text-xs"
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
