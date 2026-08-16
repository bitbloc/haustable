/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect } from 'react';
import { 
    X, 
    Check, 
    AlertCircle, 
    Plus, 
    Trash2, 
    Building2, 
    User, 
    Printer, 
    Save, 
    Search, 
    Calculator,
    CheckCircle2,
    Receipt,
    Link2,
    Unlink
} from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { 
    thaiBahtText, 
    validateThaiTaxId, 
    formatTaxId, 
    formatBranch, 
    calculateDocumentTotals 
} from '../../../utils/thaiTaxHelper';
import { getShortBookingId } from '../../../utils/printerHelper';
import ReceiptPickerModal from './ReceiptPickerModal';
import { toast } from 'sonner';

export default function TaxInvoiceModal({ 
    booking = null, 
    existingInvoice = null, 
    companySettings = {}, 
    onClose, 
    onSaveSuccess 
}) {
    const isCompanyVatRegistered = companySettings?.tax_is_vat_registered === 'true' || companySettings?.tax_is_vat_registered === true;
    
    // Receipt Linking State
    const [linkedBooking, setLinkedBooking] = useState(booking);
    const [showReceiptPicker, setShowReceiptPicker] = useState(false);

    // Form State
    const [docType, setDocType] = useState(
        existingInvoice?.doc_type || 
        (isCompanyVatRegistered ? 'tax_invoice' : 'receipt')
    );
    const [customerType, setCustomerType] = useState(existingInvoice?.customer_type || 'company'); // 'company' | 'individual'
    const [customerName, setCustomerName] = useState(existingInvoice?.customer_name || booking?.pickup_contact_name || booking?.guest_name || booking?.profiles?.display_name || '');
    const [customerTaxId, setCustomerTaxId] = useState(existingInvoice?.customer_tax_id || '');
    const [customerBranchType, setCustomerBranchType] = useState(existingInvoice?.customer_branch_type || 'head_office');
    const [customerBranchCode, setCustomerBranchCode] = useState(existingInvoice?.customer_branch_code || '00000');
    const [customerAddress, setCustomerAddress] = useState(existingInvoice?.customer_address || booking?.shipping_address || '');
    const [customerPhone, setCustomerPhone] = useState(existingInvoice?.customer_phone || booking?.pickup_contact_phone || booking?.phone_number || booking?.profiles?.phone_number || '');
    const [customerEmail, setCustomerEmail] = useState(existingInvoice?.customer_email || '');
    const [saveCustomerToDirectory, setSaveCustomerToDirectory] = useState(true);

    const mapBookingOrderItems = (b) => {
        if (b?.order_items && Array.isArray(b.order_items) && b.order_items.length > 0) {
            return b.order_items.map(item => {
                const menuItem = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
                return {
                    name: item.item_name || menuItem?.name || 'รายการสินค้า',
                    quantity: Number(item.quantity || 1),
                    price: Number(item.price_at_time !== undefined && item.price_at_time !== null ? item.price_at_time : (item.price || menuItem?.price || 0)),
                    selected_options: typeof item.selected_options === 'string' ? item.selected_options : ''
                };
            });
        }
        return [
            { name: 'อาหารและเครื่องดื่ม (Food & Beverage)', quantity: 1, price: Number(b?.total_amount || 0), selected_options: '' }
        ];
    };

    const detectBookingPaymentMethod = (b) => {
        if (!b) return 'CASH';
        const remark = (b.staff_remark || '').toLowerCase();
        if (remark.includes('credit') || remark.includes('บัตรเครดิต')) return 'CREDIT';
        if (b.payment_slip_url || remark.includes('qr') || remark.includes('transfer') || remark.includes('โอน') || remark.includes('promptpay')) return 'QR';
        return 'CASH';
    };

    // Items List
    const [items, setItems] = useState(() => {
        if (existingInvoice?.items && Array.isArray(existingInvoice.items) && existingInvoice.items.length > 0) {
            return existingInvoice.items;
        }
        if (booking) {
            return mapBookingOrderItems(booking);
        }
        return [
            { name: 'อาหารและเครื่องดื่ม (Food & Beverage)', quantity: 1, price: 0, selected_options: '' }
        ];
    });

    const [discountAmount, setDiscountAmount] = useState(
        existingInvoice?.discount_amount || 
        (Number(booking?.discount_amount || 0) + Number(booking?.xhaus_discount || 0))
    );
    const [whtRate, setWhtRate] = useState(existingInvoice?.wht_rate || 0); // 0, 1, 2, 3, 5
    const [paymentMethod, setPaymentMethod] = useState(
        existingInvoice?.payment_method || 
        (booking ? detectBookingPaymentMethod(booking) : 'CASH')
    );
    const [notes, setNotes] = useState(existingInvoice?.notes || '');
    const [saving, setSaving] = useState(false);

    // Handler when user selects a receipt from picker
    const handleSelectReceipt = (selectedBooking) => {
        setLinkedBooking(selectedBooking);
        const mappedItems = mapBookingOrderItems(selectedBooking);
        setItems(mappedItems);
        setDiscountAmount(Number(selectedBooking?.discount_amount || 0) + Number(selectedBooking?.xhaus_discount || 0));
        setPaymentMethod(detectBookingPaymentMethod(selectedBooking));

        // Auto-fill customer info if available
        const bName = selectedBooking?.pickup_contact_name || selectedBooking?.guest_name || selectedBooking?.profiles?.display_name || '';
        const bPhone = selectedBooking?.pickup_contact_phone || selectedBooking?.phone_number || selectedBooking?.profiles?.phone_number || '';
        const bAddress = selectedBooking?.shipping_address || '';

        if (bName && (!customerName || customerName === '')) setCustomerName(bName);
        if (bPhone && (!customerPhone || customerPhone === '')) setCustomerPhone(bPhone);
        if (bAddress && (!customerAddress || customerAddress === '')) setCustomerAddress(bAddress);

        const shortId = getShortBookingId(selectedBooking);
        const tableName = selectedBooking?.tables_layout?.table_name || (selectedBooking?.booking_type === 'pickup' ? 'PICKUP' : 'WALK-IN');
        if (!notes) {
            setNotes(`บิล POS #${shortId} (โต๊ะ ${tableName})`);
        }

        setShowReceiptPicker(false);
        toast.success(`ดึงข้อมูลจากบิล #${shortId} (${mappedItems.length} รายการ) สำเร็จ!`);
    };

    const handleUnlinkReceipt = () => {
        setLinkedBooking(null);
        toast.info('ยกเลิกการเชื่อมโยงบิล POS แล้ว (รายการสินค้ายังคงอยู่)');
    };

    // Saved Customer Directory autocomplete
    const [savedProfiles, setSavedProfiles] = useState([]);
    const [searchCustomerQuery, setSearchCustomerQuery] = useState('');
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);

    useEffect(() => {
        fetchSavedProfiles();
    }, []);

    const fetchSavedProfiles = async () => {
        try {
            const { data, error } = await supabase
                .from('tax_customer_profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) {
                setSavedProfiles(data);
            } else {
                // Fallback to localStorage
                const local = localStorage.getItem('onhaus_tax_customer_profiles');
                if (local) setSavedProfiles(JSON.parse(local));
            }
        } catch {
            const local = localStorage.getItem('onhaus_tax_customer_profiles');
            if (local) setSavedProfiles(JSON.parse(local));
        }
    };

    const handleSelectSavedProfile = (profile) => {
        setCustomerType(profile.customer_type || 'company');
        setCustomerName(profile.company_name || '');
        setCustomerTaxId(profile.tax_id || '');
        setCustomerBranchType(profile.branch_type || 'head_office');
        setCustomerBranchCode(profile.branch_code || '00000');
        setCustomerAddress(profile.address || '');
        setCustomerPhone(profile.phone || '');
        setCustomerEmail(profile.email || '');
        setShowProfileDropdown(false);
        toast.info(`เลือกข้อมูล: ${profile.company_name}`);
    };

    // Calculate dynamic totals
    const isDocVat = docType === 'tax_invoice';
    const totals = calculateDocumentTotals({
        items,
        discountAmount,
        isVatRegistered: isDocVat,
        vatModel: companySettings?.tax_vat_model || 'inclusive',
        vatRate: Number(companySettings?.tax_vat_rate || 7),
        whtRate
    });

    const isTaxIdValid = validateThaiTaxId(customerTaxId);
    const bahtWords = thaiBahtText(totals.totalAmount);

    // Item actions
    const handleAddItem = () => {
        setItems([...items, { name: '', quantity: 1, price: 0, selected_options: '' }]);
    };

    const handleUpdateItem = (index, field, value) => {
        const updated = [...items];
        updated[index] = { ...updated[index], [field]: value };
        setItems(updated);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) {
            toast.error('ต้องมีรายการสินค้าอย่างน้อย 1 รายการ');
            return;
        }
        setItems(items.filter((_, i) => i !== index));
    };

    // Submit / Save
    const handleSaveInvoice = async (printImmediately = false) => {
        if (!customerName.trim()) {
            toast.error('กรุณากรอกชื่อผู้ซื้อ / ชื่อบริษัท');
            return;
        }
        if (customerTaxId && customerTaxId.replace(/\D/g, '').length !== 13) {
            toast.warning('เลขประจำตัวผู้เสียภาษีควรมี 13 หลัก');
        }
        if (!customerAddress.trim()) {
            toast.error('กรุณากรอกที่อยู่จดทะเบียนผู้ซื้อ');
            return;
        }

        setSaving(true);
        try {
            // Generate sequence number if new
            let invoiceNumber = existingInvoice?.invoice_number;
            if (!invoiceNumber) {
                const prefix = isDocVat 
                    ? (companySettings?.tax_invoice_prefix || 'INV')
                    : (companySettings?.tax_receipt_prefix || 'REC');
                const ym = new Date().toISOString().slice(0, 7).replace('-', '');
                const randomSeq = Math.floor(Math.random() * 9000) + 1000;
                invoiceNumber = `${prefix}-${ym}-${randomSeq}`;
            }

            const invoicePayload = {
                invoice_number: invoiceNumber,
                booking_id: linkedBooking?.id || booking?.id || existingInvoice?.booking_id || null,
                doc_type: docType,
                customer_type: customerType,
                customer_name: customerName.trim(),
                customer_tax_id: customerTaxId.replace(/\D/g, ''),
                customer_branch_type: customerBranchType,
                customer_branch_code: customerBranchType === 'head_office' ? '00000' : customerBranchCode,
                customer_address: customerAddress.trim(),
                customer_phone: customerPhone.trim(),
                customer_email: customerEmail.trim(),
                subtotal: totals.subtotal,
                discount_amount: totals.discountAmount,
                pre_vat_amount: totals.preVatAmount,
                vat_rate: totals.vatRate,
                vat_amount: totals.vatAmount,
                total_amount: totals.totalAmount,
                wht_rate: totals.whtRate,
                wht_amount: totals.whtAmount,
                net_payable: totals.netPayable,
                payment_method: paymentMethod,
                items,
                issuer_name: companySettings?.tax_company_name || 'ร้านในบ้าน นครพนม',
                issuer_tax_id: companySettings?.tax_id || '1120100144907',
                issuer_branch: companySettings?.tax_branch_code || '00000',
                issuer_address: companySettings?.tax_address || '788/1, สุนทรวิจิตร ซ.พนมพนารักษ์ ในเมือง เมืองนครพนม นครพนม 48000',
                issuer_phone: companySettings?.tax_phone || '',
                status: existingInvoice?.status || 'issued',
                notes: notes.trim(),
                issued_at: existingInvoice?.issued_at || new Date().toISOString()
            };

            // 1. Try writing to Supabase
            let savedRecord = { ...invoicePayload, id: existingInvoice?.id || `local_${Date.now()}` };
            try {
                if (existingInvoice?.id && !String(existingInvoice.id).startsWith('local_')) {
                    const { data, error } = await supabase
                        .from('tax_invoices')
                        .update(invoicePayload)
                        .eq('id', existingInvoice.id)
                        .select()
                        .single();
                    if (!error && data) savedRecord = data;
                } else {
                    const { data, error } = await supabase
                        .from('tax_invoices')
                        .insert([invoicePayload])
                        .select()
                        .single();
                    if (!error && data) savedRecord = data;
                }
            } catch (dbErr) {
                console.warn('Supabase tax_invoices fallback to local store:', dbErr);
            }

            // 2. LocalStorage Persistence Sync
            const localInvoices = JSON.parse(localStorage.getItem('onhaus_tax_invoices') || '[]');
            const existingIdx = localInvoices.findIndex(inv => inv.invoice_number === invoiceNumber);
            if (existingIdx >= 0) {
                localInvoices[existingIdx] = savedRecord;
            } else {
                localInvoices.unshift(savedRecord);
            }
            localStorage.setItem('onhaus_tax_invoices', JSON.stringify(localInvoices));

            // 3. Save customer profile to Directory if opted
            if (saveCustomerToDirectory && customerName.trim()) {
                const customerProfilePayload = {
                    customer_type: customerType,
                    company_name: customerName.trim(),
                    tax_id: customerTaxId.replace(/\D/g, ''),
                    branch_type: customerBranchType,
                    branch_code: customerBranchType === 'head_office' ? '00000' : customerBranchCode,
                    address: customerAddress.trim(),
                    phone: customerPhone.trim(),
                    email: customerEmail.trim()
                };

                try {
                    await supabase.from('tax_customer_profiles').upsert([customerProfilePayload]);
                } catch {
                    // Fallback to local
                }

                const localProfiles = JSON.parse(localStorage.getItem('onhaus_tax_customer_profiles') || '[]');
                const pIdx = localProfiles.findIndex(p => p.tax_id === customerProfilePayload.tax_id || p.company_name === customerProfilePayload.company_name);
                if (pIdx >= 0) {
                    localProfiles[pIdx] = customerProfilePayload;
                } else {
                    localProfiles.unshift(customerProfilePayload);
                }
                localStorage.setItem('onhaus_tax_customer_profiles', JSON.stringify(localProfiles));
            }

            toast.success(`ออกเอกสาร ${invoiceNumber} เรียบร้อยแล้ว!`);
            if (onSaveSuccess) onSaveSuccess(savedRecord, printImmediately);
        } catch (err) {
            console.error('Error saving tax invoice:', err);
            toast.error('เกิดข้อผิดพลาดในการบันทึกเอกสาร: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const filteredSavedProfiles = savedProfiles.filter(p => 
        (p.company_name || '').toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
        (p.tax_id || '').includes(searchCustomerQuery)
    );

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto font-sans">
            <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-none shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden text-[var(--color-ink)]">
                
                {/* Header */}
                <div className="bg-[var(--color-ink)] text-[var(--color-paper)] px-4 py-3 sm:px-6 flex items-center justify-between border-b border-[var(--color-rule)] shrink-0 font-mono">
                    <div className="flex items-center gap-3">
                        <div className="text-xs font-bold px-2 py-0.5 bg-[var(--color-accent)] text-white">
                            DOC//TAX
                        </div>
                        <div>
                            <h2 className="font-bold text-sm sm:text-base tracking-wider uppercase">
                                {existingInvoice ? 'EDIT DOCUMENT // TAX INVOICE' : 'ISSUE RECEIPT & TAX INVOICE'}
                            </h2>
                            <p className="text-[10px] text-[var(--color-paper)]/70">
                                {isCompanyVatRegistered 
                                    ? '[STATUS: VAT 7% COMPLIANT (SEC 86/4)]' 
                                    : '[STATUS: NON-VAT OFFICIAL RECEIPT (SEC 105)]'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-[var(--color-paper)]/70 hover:text-white transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs bg-[var(--color-paper)]">
                    
                    {/* Document Type Selector Banner */}
                    <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
                        <div>
                            <span className="text-[9px] font-bold text-[var(--color-neutral)] uppercase tracking-wider block">
                                DOCUMENT TYPE CLASSIFICATION
                            </span>
                            <span className="font-bold text-xs text-[var(--color-ink)] mt-0.5 block">
                                {docType === 'tax_invoice' ? 'FULL TAX INVOICE / RECEIPT (ใบเสร็จรับเงิน / ใบกำกับภาษีเต็มรูป)' : 'OFFICIAL RECEIPT (ใบเสร็จรับเงิน)'}
                            </span>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setDocType('receipt')}
                                className={`px-3 py-1.5 font-bold text-xs transition-all cursor-pointer border ${docType === 'receipt' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]' : 'bg-[var(--color-paper)] text-[var(--color-neutral)] border-[var(--color-rule)] hover:text-[var(--color-ink)]'}`}
                            >
                                OFFICIAL RECEIPT
                            </button>
                            <button
                                type="button"
                                onClick={() => setDocType('tax_invoice')}
                                className={`px-3 py-1.5 font-bold text-xs transition-all cursor-pointer border ${docType === 'tax_invoice' ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)]' : 'bg-[var(--color-paper)] text-[var(--color-neutral)] border-[var(--color-rule)] hover:text-[var(--color-ink)]'}`}
                            >
                                TAX INVOICE (VAT 7%)
                            </button>
                        </div>
                    </div>

                    {/* Receipt Linking Section (Dieter Rams Brutalist Container) */}
                    {linkedBooking ? (
                        <div className="bg-[var(--color-paper-2)] border-2 border-[var(--color-ink)] p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[var(--color-ink)] text-[var(--color-paper)] shrink-0">
                                    <Receipt size={18} />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-xs text-[var(--color-ink)] uppercase tracking-wide">
                                            เชื่อมโยงกับบิล POS #{getShortBookingId(linkedBooking)}
                                        </span>
                                        <span className="px-1.5 py-0.5 bg-[var(--color-accent)] text-white text-[10px] font-bold">
                                            โต๊ะ {linkedBooking.tables_layout?.table_name || (linkedBooking.booking_type === 'pickup' ? 'PICKUP' : 'WALK-IN')}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-[var(--color-neutral)] mt-0.5">
                                        นำเข้ารายการสินค้า {items.length} รายการ • ยอดสุทธิ ฿{Number(linkedBooking.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowReceiptPicker(true)}
                                    className="px-3 py-1.5 bg-[var(--color-paper)] hover:bg-white text-[var(--color-ink)] border border-[var(--color-rule)] font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                                >
                                    <Receipt size={13} />
                                    <span>เปลี่ยนบิล (CHANGE)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUnlinkReceipt}
                                    className="px-3 py-1.5 bg-transparent hover:bg-red-50 text-red-600 border border-red-200 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                                    title="ยกเลิกการเชื่อมโยงแต่คงข้อมูลรายการไว้"
                                >
                                    <Unlink size={13} />
                                    <span>ยกเลิกเชื่อมโยง</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50/60 border border-amber-300 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-amber-200/80 text-amber-900 shrink-0">
                                    <Receipt size={16} />
                                </div>
                                <div>
                                    <span className="font-bold text-xs text-amber-950 block">
                                        ดึงข้อมูลจากบิล / ใบเสร็จ POS (ไม่ต้องกรอกเอง)
                                    </span>
                                    <span className="text-[11px] text-amber-800 block">
                                        เลือกจากบิลที่คิดเงินแล้ว เพื่อนำเข้ารายการสินค้า ยอดเงิน ส่วนลด และข้อมูลลูกค้าเข้าสู่หน้านี้ทันที
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowReceiptPicker(true)}
                                className="px-3.5 py-2 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
                            >
                                <Receipt size={13} />
                                <span>เลือกจากใบเสร็จ (SELECT RECEIPT)</span>
                            </button>
                        </div>
                    )}

                    {/* Customer Info Section */}
                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3">
                            <div className="flex items-center gap-2">
                                <Building2 size={16} className="text-[oklch(52%_0.16_28)]" />
                                <span className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-800">
                                    ข้อมูลผู้ซื้อ / ผู้รับบริการ (Customer Info)
                                </span>
                            </div>

                            {/* Saved Profile & Receipt Quick Pickers */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowReceiptPicker(true)}
                                    className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded font-mono text-[11px] font-bold flex items-center gap-1.5 border border-amber-300 transition-colors cursor-pointer"
                                >
                                    <Receipt size={12} />
                                    <span>เลือกจากบิล POS</span>
                                </button>

                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                                        className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded font-mono text-[11px] font-bold flex items-center gap-1.5 border border-zinc-300 transition-colors cursor-pointer"
                                    >
                                        <Search size={12} />
                                        <span>ดึงข้อมูลลูกค้าประจำ ({savedProfiles.length})</span>
                                    </button>

                                    {showProfileDropdown && (
                                        <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-zinc-400 rounded-xl shadow-2xl p-2 z-50">
                                            <input
                                                type="text"
                                                placeholder="ค้นหาชื่อบริษัท / เลขประจำตัว..."
                                                value={searchCustomerQuery}
                                                onChange={(e) => setSearchCustomerQuery(e.target.value)}
                                                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded text-xs mb-2 font-mono"
                                                autoFocus
                                            />
                                            <div className="max-h-48 overflow-y-auto divide-y divide-zinc-100">
                                                {filteredSavedProfiles.map((p, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => handleSelectSavedProfile(p)}
                                                        className="w-full text-left p-2 hover:bg-zinc-100 rounded text-xs transition-colors block cursor-pointer"
                                                    >
                                                        <div className="font-bold text-zinc-900">{p.company_name}</div>
                                                        <div className="font-mono text-[10px] text-zinc-500">
                                                            Tax ID: {formatTaxId(p.tax_id)} • {formatBranch(p.branch_type, p.branch_code)}
                                                        </div>
                                                    </button>
                                                ))}
                                                {filteredSavedProfiles.length === 0 && (
                                                    <div className="p-3 text-center text-zinc-400 text-[11px]">
                                                        ไม่พบบริษัทที่บันทึกไว้
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Customer Type Radio */}
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="customerType"
                                    checked={customerType === 'company'}
                                    onChange={() => setCustomerType('company')}
                                    className="accent-[oklch(52%_0.16_28)]"
                                />
                                <span className="font-bold text-zinc-800">นิติบุคคล (บริษัท / หจก. / องค์กร)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="customerType"
                                    checked={customerType === 'individual'}
                                    onChange={() => setCustomerType('individual')}
                                    className="accent-[oklch(52%_0.16_28)]"
                                />
                                <span className="font-bold text-zinc-800">บุคคลธรรมดา (Individual)</span>
                            </label>
                        </div>

                        {/* Form Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Company / Customer Name */}
                            <div className="sm:col-span-2">
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    ชื่อผู้ซื้อ / ชื่อบริษัทที่จดทะเบียน *
                                </label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    placeholder="เช่น บริษัท เอสซีจี จำกัด (มหาชน)"
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-semibold focus:border-zinc-900 focus:outline-none bg-white"
                                />
                            </div>

                            {/* Tax ID 13 Digits */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase">
                                        เลขประจำตัวผู้เสียภาษี 13 หลัก
                                    </label>
                                    {customerTaxId && (
                                        <span className={`font-mono text-[9px] font-bold flex items-center gap-1 ${isTaxIdValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {isTaxIdValid ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                                            {isTaxIdValid ? 'เลขถูกต้อง (Mod 11 Pass)' : 'ตรวจรูปแบบ 13 หลัก'}
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={customerTaxId}
                                    onChange={(e) => setCustomerTaxId(e.target.value)}
                                    placeholder="01055xxxxxxxx หรือ 13 หลัก"
                                    maxLength={17}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs focus:border-zinc-900 focus:outline-none bg-white"
                                />
                            </div>

                            {/* Branch Selection */}
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                        สถานประกอบการ
                                    </label>
                                    <select
                                        value={customerBranchType}
                                        onChange={(e) => setCustomerBranchType(e.target.value)}
                                        className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-medium focus:border-zinc-900 focus:outline-none bg-white"
                                    >
                                        <option value="head_office">สำนักงานใหญ่ (Head Office)</option>
                                        <option value="branch">สาขา (Branch Code)</option>
                                    </select>
                                </div>
                                {customerBranchType === 'branch' && (
                                    <div className="w-28">
                                        <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                            รหัสสาขา 5 หลัก
                                        </label>
                                        <input
                                            type="text"
                                            value={customerBranchCode}
                                            onChange={(e) => setCustomerBranchCode(e.target.value)}
                                            placeholder="00001"
                                            maxLength={5}
                                            className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs text-center focus:border-zinc-900 focus:outline-none bg-white"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Registered Address */}
                            <div className="sm:col-span-2">
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    ที่อยู่จดทะเบียนตาม ภ.พ.20 / ทะเบียนพาณิชย์ *
                                </label>
                                <textarea
                                    value={customerAddress}
                                    onChange={(e) => setCustomerAddress(e.target.value)}
                                    placeholder="เลขที่ อาคาร ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                                    rows={2}
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs leading-relaxed focus:border-zinc-900 focus:outline-none bg-white"
                                />
                            </div>

                            {/* Phone & Email */}
                            <div>
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    เบอร์โทรศัพท์
                                </label>
                                <input
                                    type="text"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    placeholder="08X-XXX-XXXX"
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs focus:border-zinc-900 focus:outline-none bg-white"
                                />
                            </div>
                            <div>
                                <label className="font-mono font-bold text-[10px] text-zinc-500 uppercase block mb-1">
                                    อีเมลสำหรับส่ง e-Tax / ใบเสร็จ
                                </label>
                                <input
                                    type="email"
                                    value={customerEmail}
                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                    placeholder="accounting@company.com"
                                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg font-mono text-xs focus:border-zinc-900 focus:outline-none bg-white"
                                />
                            </div>
                        </div>

                        {/* Save to Directory checkbox */}
                        <label className="flex items-center gap-2 text-[11px] text-zinc-700 pt-1 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={saveCustomerToDirectory}
                                onChange={(e) => setSaveCustomerToDirectory(e.target.checked)}
                                className="accent-[oklch(52%_0.16_28)]"
                            />
                            <span>บันทึกข้อมูลลูกค้านี้ไว้ในสมุดรายชื่อสำหรับออกบิลครั้งถัดไป</span>
                        </label>
                    </div>

                    {/* Order Items Table Editor */}
                    <div className="bg-white border border-[#D1D1CD] rounded-xl p-4 sm:p-5 space-y-3 shadow-sm">
                        <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
                            <span className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-800">
                                รายการสินค้าและบริการ (Line Items)
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowReceiptPicker(true)}
                                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded font-mono text-[11px] font-bold flex items-center gap-1 border border-amber-300 transition-colors cursor-pointer"
                                >
                                    <Receipt size={12} />
                                    <span>ดึงจากใบเสร็จ POS</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded font-mono text-[11px] font-bold flex items-center gap-1 border border-zinc-300 transition-colors cursor-pointer"
                                >
                                    <Plus size={13} />
                                    <span>เพิ่มรายการ</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                                    <span className="font-mono font-bold text-[10px] text-zinc-400 w-5 text-center">
                                        {idx + 1}
                                    </span>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                                            placeholder="ชื่อสินค้า / รายการอาหาร"
                                            className="w-full px-2.5 py-1.5 border border-zinc-300 rounded text-xs font-semibold focus:border-zinc-900 focus:outline-none bg-white"
                                        />
                                    </div>
                                    <div className="w-16">
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                                            placeholder="จำนวน"
                                            className="w-full px-2 py-1.5 border border-zinc-300 rounded text-xs font-mono text-center focus:border-zinc-900 focus:outline-none bg-white"
                                        />
                                    </div>
                                    <div className="w-24">
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={item.price}
                                            onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                                            placeholder="ราคา/หน่วย"
                                            className="w-full px-2.5 py-1.5 border border-zinc-300 rounded text-xs font-mono text-right focus:border-zinc-900 focus:outline-none bg-white"
                                        />
                                    </div>
                                    <div className="w-24 text-right font-mono font-bold text-xs text-zinc-900 pr-1">
                                        ฿{(Number(item.quantity || 1) * Number(item.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(idx)}
                                        className="p-1 text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
                                        title="ลบรายการ"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Calculations & WHT Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Adjustments & WHT */}
                        <div className="bg-white border border-[#D1D1CD] rounded-xl p-4 space-y-3 shadow-sm">
                            <span className="font-mono font-bold text-xs uppercase tracking-wider text-zinc-800 block border-b border-zinc-200 pb-2">
                                ส่วนลด & ภาษีหัก ณ ที่จ่าย
                            </span>

                            <div className="flex justify-between items-center">
                                <label className="font-mono text-xs text-zinc-600">หักส่วนลด (Discount THB):</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={discountAmount}
                                    onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                                    className="w-28 px-2.5 py-1 border border-zinc-300 rounded text-xs font-mono text-right focus:border-zinc-900 focus:outline-none"
                                />
                            </div>

                            <div className="flex justify-between items-center">
                                <div>
                                    <label className="font-mono text-xs text-zinc-600 block">ภาษีหัก ณ ที่จ่าย (WHT):</label>
                                    <span className="text-[10px] text-zinc-400 font-mono">(กรณีนิติบุคคลหัก ณ ที่จ่าย)</span>
                                </div>
                                <select
                                    value={whtRate}
                                    onChange={(e) => setWhtRate(Number(e.target.value) || 0)}
                                    className="w-28 px-2 py-1 border border-zinc-300 rounded text-xs font-mono text-right focus:border-zinc-900 focus:outline-none bg-white"
                                >
                                    <option value="0">0% (ไม่หัก)</option>
                                    <option value="1">1% (ขนส่ง)</option>
                                    <option value="2">2% (โฆษณา)</option>
                                    <option value="3">3% (บริการ)</option>
                                    <option value="5">5% (ค่าเช่า)</option>
                                </select>
                            </div>

                            <div className="flex justify-between items-center">
                                <label className="font-mono text-xs text-zinc-600">ช่องทางชำระเงิน:</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-36 px-2 py-1 border border-zinc-300 rounded text-xs font-mono focus:border-zinc-900 focus:outline-none bg-white"
                                >
                                    <option value="CASH">เงินสด (CASH)</option>
                                    <option value="QR">โอนเงิน QR Transfer</option>
                                    <option value="CREDIT">บัตรเครดิต (CREDIT)</option>
                                </select>
                            </div>

                            <div>
                                <label className="font-mono text-[10px] text-zinc-500 uppercase block mb-1">
                                    หมายเหตุท้ายเอกสาร (Remarks):
                                </label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="เช่น งานเลี้ยงสังสรรค์บริษัท / โต๊ะ T-04"
                                    className="w-full px-2.5 py-1 border border-zinc-300 rounded text-xs focus:border-zinc-900 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Live Summary Box */}
                        <div className="bg-[#1A1A1A] text-white rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm font-mono">
                            <div className="space-y-2 border-b border-zinc-700 pb-3 text-xs">
                                <div className="flex justify-between text-zinc-400">
                                    <span>ยอดรวมสินค้า (Subtotal):</span>
                                    <span>฿{totals.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {totals.discountAmount > 0 && (
                                    <div className="flex justify-between text-amber-400">
                                        <span>ส่วนลด (Discount):</span>
                                        <span>-฿{totals.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                {isDocVat && (
                                    <>
                                        <div className="flex justify-between text-zinc-400">
                                            <span>มูลค่าก่อนภาษี (Pre-VAT):</span>
                                            <span>฿{totals.preVatAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between text-emerald-400 font-bold">
                                            <span>ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                                            <span>฿{totals.vatAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </>
                                )}
                                <div className="flex justify-between text-sm font-bold text-white pt-1">
                                    <span>ยอดรวมทั้งสิ้น (Grand Total):</span>
                                    <span className="text-emerald-400 font-black">
                                        ฿{totals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                {totals.whtAmount > 0 && (
                                    <div className="flex justify-between text-xs text-amber-300">
                                        <span>หัก ณ ที่จ่าย {totals.whtRate}%:</span>
                                        <span>-฿{totals.whtAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-3">
                                <span className="text-[9px] text-zinc-400 block uppercase">
                                    จำนวนเงินตัวอักษร:
                                </span>
                                <div className="text-xs text-amber-200 font-bold mt-0.5 leading-snug">
                                    ({bahtWords})
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Toolbar */}
                <div className="p-4 bg-white border-t border-[#D1D1CD] flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 border border-zinc-300 hover:bg-zinc-100 text-zinc-700 rounded-lg font-mono font-bold text-xs transition-colors cursor-pointer"
                    >
                        ยกเลิก (CANCEL)
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleSaveInvoice(true)}
                            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-mono font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                        >
                            <Printer size={15} />
                            <span>บันทึกและพิมพ์เอกสาร (Save & Print)</span>
                        </button>

                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleSaveInvoice(false)}
                            className="px-5 py-2.5 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-mono font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                        >
                            <Save size={15} />
                            <span>{saving ? 'กำลังบันทึก...' : 'บันทึกเอกสาร (SAVE)'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Sub-modal: Select from POS Receipts */}
            {showReceiptPicker && (
                <ReceiptPickerModal
                    currentSelectedId={linkedBooking?.id}
                    onSelectReceipt={handleSelectReceipt}
                    onClose={() => setShowReceiptPicker(false)}
                />
            )}
        </div>
    );
}
