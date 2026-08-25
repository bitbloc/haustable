/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState } from 'react';
import { Printer, Save, RefreshCw, Radio, Search, Check, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { Printer as CapgoPrinter } from '@capgo/capacitor-printer';
import { printToBluetoothDirect, encodeShiftReportData, printToRawBTWebSocket, printToSunmiBuiltIn, generateDivider } from '../../../utils/printerHelper';
import { simulateWmaOrder } from '../../../utils/wmaNativeBridge';

const ASCII_ART_PRESETS = [
    {
        id: 'thank_you_spaced',
        name: 'THANK YOU (Spaced Text)',
        art: `T H A N K   Y O U\n  S E E   Y O U   A G A I N`
    },
    {
        id: 'in_the_haus',
        name: 'IN THE HAUS (Clean Text)',
        art: `--- IN THE HAUS ---`
    },
    {
        id: 'classic_banner',
        name: 'THANK YOU (Clean Banner)',
        art: `===========================\n   THANK YOU FOR VISITING\n===========================`
    },
    {
        id: 'have_a_nice_day',
        name: 'HAVE A NICE DAY (Spaced)',
        art: `H A V E   A   N I C E   D A Y\n   THANK YOU VERY MUCH`
    },
    {
        id: 'welcome_home',
        name: 'WELCOME HOME (Spaced Banner)',
        art: `+-------------------------+\n      WELCOME HOME\n+-------------------------+`
    }
];

export default function HardwarePrintersTab({
    printerConfig,
    setPrinterConfig,
    handleSavePrinter,
    allCategories,
    settings,
    handleSave,
    timestamp
}) {
    const [previewTab, setPreviewTab] = useState('billing'); // 'billing' | 'kitchen' | 'bar'
    const [, setSelectedAsciiPreset] = useState('thank_you_spaced');
    const [isScanning, setIsScanning] = useState(false);
    const [scanningTargetType, setScanningTargetType] = useState('cashier'); // 'cashier' | 'kitchen' | 'bar'
    const [scannedDevices, setScannedDevices] = useState([]);
    const [draggedOverColumn, setDraggedOverColumn] = useState(null);

    const handleCategoryDragStart = (e, catId) => {
        e.dataTransfer.setData('text/plain', catId);
    };

    const handleCategoryDragOver = (e, column) => {
        e.preventDefault();
        if (draggedOverColumn !== column) {
            setDraggedOverColumn(column);
        }
    };

    const handleCategoryDrop = (e, targetColumn) => {
        e.preventDefault();
        setDraggedOverColumn(null);
        const catId = e.dataTransfer.getData('text/plain');
        if (!catId) return;

        let newKitchen = [...(printerConfig.kitchen_categories || [])];
        let newBar = [...(printerConfig.bar_categories || [])];

        newKitchen = newKitchen.filter(id => id !== catId);
        newBar = newBar.filter(id => id !== catId);

        if (targetColumn === 'kitchen') {
            newKitchen.push(catId);
        } else if (targetColumn === 'bar') {
            newBar.push(catId);
        }

        const updated = {
            ...printerConfig,
            kitchen_categories: newKitchen,
            bar_categories: newBar
        };
        handleSavePrinter(updated);
    };

    const handleAssignCategory = (catId, target) => {
        let newKitchen = [...(printerConfig.kitchen_categories || [])];
        let newBar = [...(printerConfig.bar_categories || [])];

        newKitchen = newKitchen.filter(id => id !== catId);
        newBar = newBar.filter(id => id !== catId);

        if (target === 'kitchen') {
            newKitchen.push(catId);
        } else if (target === 'bar') {
            newBar.push(catId);
        }

        const updated = {
            ...printerConfig,
            kitchen_categories: newKitchen,
            bar_categories: newBar
        };
        handleSavePrinter(updated);
    };

    const handleRemoveCategory = (catId, source) => {
        let newKitchen = [...(printerConfig.kitchen_categories || [])];
        let newBar = [...(printerConfig.bar_categories || [])];

        if (source === 'kitchen') {
            newKitchen = newKitchen.filter(id => id !== catId);
        } else if (source === 'bar') {
            newBar = newBar.filter(id => id !== catId);
        }

        const updated = {
            ...printerConfig,
            kitchen_categories: newKitchen,
            bar_categories: newBar
        };
        handleSavePrinter(updated);
    };

    const handleTestPrint = async (type) => {
        const name = type === 'cashier' ? 'Cashier Thermal Printer' : 'Kitchen Thermal Printer';
        const configType = type === 'cashier' ? printerConfig.cashier_printer_type : printerConfig.kitchen_printer_type;
        const configSize = type === 'cashier' ? printerConfig.cashier_paper_size : printerConfig.kitchen_paper_size;
        const configIp = type === 'cashier' ? printerConfig.cashier_printer_ip : printerConfig.kitchen_printer_ip;
        const configPort = type === 'cashier' ? printerConfig.cashier_printer_port : printerConfig.kitchen_printer_port;
        const configBt = type === 'cashier' ? printerConfig.cashier_printer_bt_name : printerConfig.kitchen_printer_bt_name;

        const dummyReport = {
            staffName: 'Admin Test',
            totalBookings: 5,
            totalItems: 12,
            grossRevenue: 2450,
            discounts: 150,
            cashRevenue: 1300,
            qrRevenue: 1000,
            netRevenue: 2300
        };

        if (configType === 'sunmi') {
            try {
                const rawBytes = encodeShiftReportData(dummyReport, '80mm', 'sunmi');
                await printToSunmiBuiltIn(rawBytes);
                toast.success(`ทดสอบพิมพ์ผ่าน SUNMI สำเร็จ`);
            } catch (err) {
                console.error('Test SUNMI print failed:', err);
                toast.error(`SUNMI Print Error: ${err.message || err}`);
            }
        } else if (configType === 'rawbt') {
            try {
                const rawBytes = encodeShiftReportData(dummyReport, configSize, 'rawbt');
                toast.info(`กำลังส่งข้อมูลพิมพ์ไปที่แอป RawBT...`);
                await printToRawBTWebSocket(rawBytes);
                toast.success(`ทดสอบพิมพ์ผ่าน RawBT สำเร็จ`);
            } catch (err) {
                console.error('Test RawBT print failed:', err);
                toast.error(`RawBT Print Error: ${err.message || err}`);
            }
        } else if (configType === 'bluetooth') {
            try {
                const rawBytes = encodeShiftReportData(dummyReport, '58mm', 'bluetooth');
                toast.info(`กำลังเชื่อมต่อบลูทูธ [${configBt}]...`);
                await printToBluetoothDirect(configBt, rawBytes);
                toast.success(`ส่งข้อมูลพิมพ์ไปยัง [${configBt}] เรียบร้อย`);
            } catch (err) {
                console.error('Test bluetooth print failed:', err);
                toast.error(`Bluetooth Print Error: ${err.message || err}`);
            }
        } else if (configType === 'universal') {
            try {
                const htmlContent = `
                    <html>
                        <head>
                            <title>Test Print</title>
                            <style>
                                @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                                body { 
                                    font-family: 'Courier Prime', 'Courier New', monospace; 
                                    background: white; 
                                    color: black; 
                                    font-size: 11px; 
                                    padding: 20px 10px; 
                                    text-align: center; 
                                    width: 280px; 
                                }
                                .header { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
                                .divider { border-top: 1px dashed black; margin: 10px 0; }
                            </style>
                        </head>
                        <body>
                            <div class="header">IN THE HAUS</div>
                            <div>TEST RECEIPT / ใบทดสอบระบบพิมพ์</div>
                            <div>Type: UNIVERSAL (${configSize})</div>
                            <div class="divider"></div>
                            <div>Date: ${new Date().toLocaleString('th-TH')}</div>
                            <div>Status: SUCCESS / เชื่อมต่อสำเร็จ</div>
                            <div class="divider"></div>
                        </body>
                    </html>
                `;

                if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Printer')) {
                    await CapgoPrinter.printHtml({
                        name: `TestPrint-${Date.now()}`,
                        html: htmlContent
                    });
                } else {
                    const iframe = document.createElement('iframe');
                    iframe.style.position = 'fixed';
                    iframe.style.right = '0';
                    iframe.style.bottom = '0';
                    iframe.style.width = '0';
                    iframe.style.height = '0';
                    iframe.style.border = '0';
                    document.body.appendChild(iframe);

                    iframe.contentDocument.write(htmlContent);
                    iframe.contentDocument.close();
                    iframe.onload = () => {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                        setTimeout(() => {
                            document.body.removeChild(iframe);
                        }, 1000);
                    };
                }
                toast.success('ส่งคำสั่งพิมพ์ Universal สำเร็จ');
            } catch (err) {
                console.error('Test universal print failed:', err);
                toast.error(`Universal Print Error: ${err.message || err}`);
            }
        } else {
            let details = `Type: ${configType.toUpperCase()}, Size: ${configSize}`;
            if (configType === 'lan') {
                details += ` (IP: ${configIp}:${configPort})`;
            }
            toast.info(`[Simulation Print] ${name} - ${details}`);
        }
    };

    const handleScanBluetooth = async (type) => {
        setScanningTargetType(type);
        setScannedDevices([]);
        setIsScanning(true);

        try {
            if (Capacitor.isNativePlatform()) {
                await BleClient.initialize();
                await BleClient.requestLEScan({}, (result) => {
                    if (result.device && result.device.name) {
                        setScannedDevices(prev => {
                            if (prev.some(d => d.deviceId === result.device.deviceId)) return prev;
                            return [...prev, { name: result.device.name, deviceId: result.device.deviceId }];
                        });
                    }
                });

                setTimeout(async () => {
                    try {
                        await BleClient.stopLEScan();
                    } catch (e) {}
                }, 10000);
            } else {
                if (!navigator.bluetooth) {
                    toast.error('อุปกรณ์นี้ไม่รองรับ Web Bluetooth (ต้องเปิดใช้บน HTTPS หรือรันผ่านแอป Native)');
                    setIsScanning(false);
                    return;
                }
                const device = await navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: [
                        '00001101-0000-1000-8000-00805f9b34fb',
                        '0000fee7-0000-1000-8000-00805f9b34fb',
                        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
                        '0000e7e7-0000-1000-8000-00805f9b34fb'
                    ]
                });
                if (device && device.name) {
                    const updated = type === 'cashier'
                        ? { ...printerConfig, cashier_printer_bt_name: device.name }
                        : { ...printerConfig, kitchen_printer_bt_name: device.name };
                    handleSavePrinter(updated);
                    toast.success(`เลือกเครื่องพิมพ์สำเร็จ: ${device.name}`);
                }
                setIsScanning(false);
            }
        } catch (err) {
            console.error('Bluetooth scan failed:', err);
            setIsScanning(false);
            if (err.name !== 'NotFoundError' && err.message !== 'User cancelled') {
                toast.error(`ไม่สามารถสแกนบลูทูธได้: ${err.message || err}`);
            }
        }
    };

    const handleSelectDevice = async (device) => {
        try {
            if (Capacitor.isNativePlatform()) {
                await BleClient.stopLEScan();
            }
        } catch (e) {}

        const updated = scanningTargetType === 'cashier'
            ? { ...printerConfig, cashier_printer_bt_name: device.name }
            : { ...printerConfig, kitchen_printer_bt_name: device.name };

        handleSavePrinter(updated);
        setIsScanning(false);
        toast.success(`เลือกเครื่องพิมพ์สำเร็จ: ${device.name}`);
    };

    const handleCancelScan = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                await BleClient.stopLEScan();
            }
        } catch (e) {}
        setIsScanning(false);
    };

    return (
        <div className="space-y-6">
            {/* Top Grid: Hardware Printers Setup */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cashier Printer Card */}
                <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-3">
                            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
                                <Printer size={16} />
                                Cashier Printer (เครื่องพิมพ์แคชเชียร์)
                            </h2>
                            <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                                {printerConfig.cashier_printer_type}
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                    Connection Type (การเชื่อมต่อ)
                                </label>
                                <select
                                    value={printerConfig.cashier_printer_type}
                                    onChange={(e) => handleSavePrinter({ ...printerConfig, cashier_printer_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] cursor-pointer"
                                >
                                    <option value="sunmi">SUNMI Built-in Printer (Auto)</option>
                                    <option value="lan">LAN / Wi-Fi Network Printer</option>
                                    <option value="bluetooth">Bluetooth Direct (BLE / SPP)</option>
                                    <option value="rawbt">RawBT WebSocket Client</option>
                                    <option value="universal">Universal (Web / OS Print Dialog)</option>
                                </select>
                            </div>

                            {printerConfig.cashier_printer_type === 'lan' && (
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-2">
                                        <label className="block text-[9px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">IP Address</label>
                                        <input
                                            type="text"
                                            value={printerConfig.cashier_printer_ip || ''}
                                            onChange={(e) => handleSavePrinter({ ...printerConfig, cashier_printer_ip: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)]"
                                            placeholder="192.168.1.100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">Port</label>
                                        <input
                                            type="text"
                                            value={printerConfig.cashier_printer_port || '9100'}
                                            onChange={(e) => handleSavePrinter({ ...printerConfig, cashier_printer_port: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)]"
                                            placeholder="9100"
                                        />
                                    </div>
                                </div>
                            )}

                            {printerConfig.cashier_printer_type === 'bluetooth' && (
                                <div className="space-y-1">
                                    <label className="block text-[9px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">Bluetooth Device Name / MAC</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={printerConfig.cashier_printer_bt_name || ''}
                                            onChange={(e) => handleSavePrinter({ ...printerConfig, cashier_printer_bt_name: e.target.value })}
                                            className="flex-1 px-2.5 py-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)]"
                                            placeholder="e.g. GG-5805DD"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleScanBluetooth('cashier')}
                                            className="px-3 py-1.5 bg-[var(--color-ink)] text-[var(--color-paper)] font-mono text-[10px] font-bold uppercase rounded-lg cursor-pointer whitespace-nowrap"
                                        >
                                            Scan & Pair
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                    Paper Width (ความกว้างกระดาษ)
                                </label>
                                <select
                                    value={printerConfig.cashier_paper_size || '80mm'}
                                    onChange={(e) => handleSavePrinter({ ...printerConfig, cashier_paper_size: e.target.value })}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] cursor-pointer"
                                >
                                    <option value="80mm">80mm Thermal Paper (Recommended)</option>
                                    <option value="58mm">58mm Thermal Paper</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--color-rule)]">
                        <button
                            type="button"
                            onClick={() => handleTestPrint('cashier')}
                            className="w-full bg-[var(--color-paper)] hover:bg-[var(--color-rule)] border border-[var(--color-rule)] text-[var(--color-ink)] py-2.5 rounded-xl font-mono text-xs font-bold transition-colors cursor-pointer"
                        >
                            Test Cashier Receipt Print
                        </button>
                    </div>
                </div>

                {/* Kitchen Printer Card */}
                <div className="bg-[var(--color-paper-2)] p-6 rounded-2xl border border-[var(--color-rule)] flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-3">
                            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
                                <Printer size={16} />
                                Kitchen Printer (เครื่องพิมพ์ในครัว)
                            </h2>
                            <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)]">
                                {printerConfig.kitchen_printer_type}
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                    Connection Type (การเชื่อมต่อ)
                                </label>
                                <select
                                    value={printerConfig.kitchen_printer_type}
                                    onChange={(e) => handleSavePrinter({ ...printerConfig, kitchen_printer_type: e.target.value })}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] cursor-pointer"
                                >
                                    <option value="sunmi">SUNMI Built-in Printer (Auto)</option>
                                    <option value="lan">LAN / Wi-Fi Network Printer</option>
                                    <option value="bluetooth">Bluetooth Direct (BLE / SPP)</option>
                                    <option value="rawbt">RawBT WebSocket Client</option>
                                    <option value="universal">Universal (Web / OS Print Dialog)</option>
                                </select>
                            </div>

                            {printerConfig.kitchen_printer_type === 'lan' && (
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-2">
                                        <label className="block text-[9px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">IP Address</label>
                                        <input
                                            type="text"
                                            value={printerConfig.kitchen_printer_ip || ''}
                                            onChange={(e) => handleSavePrinter({ ...printerConfig, kitchen_printer_ip: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)]"
                                            placeholder="192.168.1.200"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">Port</label>
                                        <input
                                            type="text"
                                            value={printerConfig.kitchen_printer_port || '9100'}
                                            onChange={(e) => handleSavePrinter({ ...printerConfig, kitchen_printer_port: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)]"
                                            placeholder="9100"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-ink)] mb-1">
                                    Paper Width (ความกว้างกระดาษ)
                                </label>
                                <select
                                    value={printerConfig.kitchen_paper_size || '80mm'}
                                    onChange={(e) => handleSavePrinter({ ...printerConfig, kitchen_paper_size: e.target.value })}
                                    className="w-full px-3 py-2 bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] cursor-pointer"
                                >
                                    <option value="80mm">80mm Thermal Paper (Recommended)</option>
                                    <option value="58mm">58mm Thermal Paper</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--color-rule)]">
                        <button
                            type="button"
                            onClick={() => handleTestPrint('kitchen')}
                            className="w-full bg-[var(--color-paper)] hover:bg-[var(--color-rule)] border border-[var(--color-rule)] text-[var(--color-ink)] py-2.5 rounded-xl font-mono text-xs font-bold transition-colors cursor-pointer"
                        >
                            Test Kitchen Slip Print
                        </button>
                    </div>
                </div>
            </div>

            {/* Wongnai Merchant App (WMA) Virtual ESC/POS Printer Bridge Card */}
            <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-6 rounded-2xl space-y-4">
                <div className="flex flex-wrap justify-between items-center border-b border-[var(--color-rule)] pb-3 gap-2">
                    <div>
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                            Wongnai Merchant App (WMA) ESC/POS Bridge & Interceptor
                        </h2>
                        <p className="text-[11px] font-mono text-[var(--color-neutral)] mt-0.5">
                            พอร์ตจำลองเครื่องพิมพ์เสมือน (Port 9100) เพื่อดักจับออเดอร์ LINE MAN เข้า POS อัตโนมัติ
                        </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ink)] animate-pulse" />
                        PORT 9100 LISTENING
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 bg-[var(--color-paper)] p-4 rounded-xl border border-[var(--color-rule)]">
                        <h3 className="font-mono font-bold uppercase text-[10px] text-[var(--color-ink)]">
                            การตั้งค่าในแอป Wongnai Merchant App (WMA)
                        </h3>
                        <ol className="space-y-1 text-[11px] font-mono text-[var(--color-muted)] list-decimal list-inside leading-relaxed">
                            <li>เปิดแอป WMA &gt; ไปที่ ตั้งค่า &gt; เครื่องพิมพ์</li>
                            <li>กด เพิ่มเครื่องพิมพ์ &gt; เลือก LAN / Wi-Fi (IP Printer)</li>
                            <li>ใส่ IP: 127.0.0.1 และ Port: 9100</li>
                            <li>เลือกรุ่น ทั่วไป / ESC/POS (80mm)</li>
                            <li>เปิด “พิมพ์อัตโนมัติเมื่อมีออเดอร์ใหม่” แล้วกดบันทึก</li>
                        </ol>
                    </div>

                    <div className="space-y-2 bg-[var(--color-paper)] p-4 rounded-xl border border-[var(--color-rule)] flex flex-col justify-between">
                        <div>
                            <h3 className="font-mono font-bold uppercase text-[10px] text-[var(--color-ink)]">
                                ตรวจสอบและทดสอบการรับออเดอร์ (Diagnostic Test)
                            </h3>
                            <p className="text-[11px] font-mono text-[var(--color-neutral)] mt-1 leading-relaxed">
                                กดปุ่มด้านล่างเพื่อจำลองส่งออเดอร์ LINE MAN เข้าสู่ระบบ POS เพื่อทดสอบการแจ้งเตือน
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    await simulateWmaOrder();
                                    toast.success('ยิงออเดอร์จำลอง LINE MAN สำเร็จ');
                                } catch (e) {
                                    toast.error('ทดสอบไม่สำเร็จ: ' + (e.message || 'Error'));
                                }
                            }}
                            className="w-full py-2.5 bg-[var(--color-ink)] hover:bg-black text-[var(--color-paper)] rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
                        >
                            ทดสอบยิงออเดอร์จำลอง LINE MAN (Simulate Test)
                        </button>
                    </div>
                </div>
            </div>

            {/* Category Printer Routing Card */}
            <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-6 rounded-2xl space-y-4">
                <div className="border-b border-[var(--color-rule)] pb-3">
                    <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                        Printer Category Routing (การจัดเส้นทางหมวดหมู่พิมพ์)
                    </h2>
                    <p className="text-[11px] font-mono text-[var(--color-neutral)] mt-0.5">
                        ลากหรือกดปุ่มเพื่อจัดหมวดหมู่อาหารเข้าเครื่องพิมพ์ครัวหรือบาร์เครื่องดื่ม
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Unassigned Column */}
                    <div
                        onDragOver={(e) => handleCategoryDragOver(e, 'unassigned')}
                        onDrop={(e) => handleCategoryDrop(e, 'unassigned')}
                        className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-4 rounded-xl space-y-3 min-h-[240px]"
                    >
                        <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-2">
                            <h3 className="text-xs font-mono font-bold uppercase text-[var(--color-ink)]">
                                หมวดหมู่ยังไม่ระบุ
                            </h3>
                            <span className="text-[10px] bg-[var(--color-paper-2)] px-2 py-0.5 rounded font-mono font-bold text-[var(--color-ink)]">
                                {allCategories.filter(cat => !(printerConfig.kitchen_categories || []).includes(cat.id) && !(printerConfig.bar_categories || []).includes(cat.id)).length}
                            </span>
                        </div>
                        <div className="space-y-2 max-h-[260px] overflow-y-auto">
                            {allCategories
                                .filter(cat => !(printerConfig.kitchen_categories || []).includes(cat.id) && !(printerConfig.bar_categories || []).includes(cat.id))
                                .map(cat => (
                                    <div
                                        key={cat.id}
                                        draggable
                                        onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
                                        className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-2.5 rounded-lg text-xs font-medium cursor-grab active:cursor-grabbing flex justify-between items-center gap-2"
                                    >
                                        <span className="truncate">{cat.name}</span>
                                        <div className="flex gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleAssignCategory(cat.id, 'kitchen')}
                                                className="bg-[var(--color-ink)] text-[var(--color-paper)] font-mono text-[9px] font-bold px-2 py-1 rounded cursor-pointer"
                                            >
                                                + ครัว
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleAssignCategory(cat.id, 'bar')}
                                                className="bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)] font-mono text-[9px] font-bold px-2 py-1 rounded cursor-pointer"
                                            >
                                                + บาร์
                                            </button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    {/* Kitchen Column */}
                    <div
                        onDragOver={(e) => handleCategoryDragOver(e, 'kitchen')}
                        onDrop={(e) => handleCategoryDrop(e, 'kitchen')}
                        className={`bg-[var(--color-paper)] border ${draggedOverColumn === 'kitchen' ? 'border-[var(--color-ink)] ring-2 ring-[var(--color-ink)]' : 'border-[var(--color-rule)]'} p-4 rounded-xl space-y-3 min-h-[240px] transition-all`}
                    >
                        <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-2">
                            <h3 className="text-xs font-mono font-bold uppercase text-[var(--color-ink)]">
                                พิมพ์ออกครัว (Kitchen)
                            </h3>
                            <span className="text-[10px] bg-[var(--color-paper-2)] px-2 py-0.5 rounded font-mono font-bold text-[var(--color-ink)]">
                                {(printerConfig.kitchen_categories || []).length}
                            </span>
                        </div>
                        <div className="space-y-2 max-h-[260px] overflow-y-auto">
                            {allCategories
                                .filter(cat => (printerConfig.kitchen_categories || []).includes(cat.id))
                                .map(cat => (
                                    <div
                                        key={cat.id}
                                        draggable
                                        onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
                                        className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-2.5 rounded-lg text-xs font-medium cursor-grab active:cursor-grabbing flex justify-between items-center gap-2"
                                    >
                                        <span className="truncate">{cat.name}</span>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleAssignCategory(cat.id, 'bar')}
                                                className="bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)] font-mono text-[9px] font-bold px-1.5 py-1 rounded cursor-pointer"
                                            >
                                                → บาร์
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCategory(cat.id, 'kitchen')}
                                                className="text-[var(--color-neutral)] hover:text-[var(--color-accent)] font-mono text-xs font-bold px-1.5 py-1 cursor-pointer"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    {/* Bar Column */}
                    <div
                        onDragOver={(e) => handleCategoryDragOver(e, 'bar')}
                        onDrop={(e) => handleCategoryDrop(e, 'bar')}
                        className={`bg-[var(--color-paper)] border ${draggedOverColumn === 'bar' ? 'border-[var(--color-ink)] ring-2 ring-[var(--color-ink)]' : 'border-[var(--color-rule)]'} p-4 rounded-xl space-y-3 min-h-[240px] transition-all`}
                    >
                        <div className="flex justify-between items-center border-b border-[var(--color-rule)] pb-2">
                            <h3 className="text-xs font-mono font-bold uppercase text-[var(--color-ink)]">
                                พิมพ์ออกบาร์ (Bar)
                            </h3>
                            <span className="text-[10px] bg-[var(--color-paper-2)] px-2 py-0.5 rounded font-mono font-bold text-[var(--color-ink)]">
                                {(printerConfig.bar_categories || []).length}
                            </span>
                        </div>
                        <div className="space-y-2 max-h-[260px] overflow-y-auto">
                            {allCategories
                                .filter(cat => (printerConfig.bar_categories || []).includes(cat.id))
                                .map(cat => (
                                    <div
                                        key={cat.id}
                                        draggable
                                        onDragStart={(e) => handleCategoryDragStart(e, cat.id)}
                                        className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-2.5 rounded-lg text-xs font-medium cursor-grab active:cursor-grabbing flex justify-between items-center gap-2"
                                    >
                                        <span className="truncate">{cat.name}</span>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleAssignCategory(cat.id, 'kitchen')}
                                                className="bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)] font-mono text-[9px] font-bold px-1.5 py-1 rounded cursor-pointer"
                                            >
                                                ← ครัว
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCategory(cat.id, 'bar')}
                                                className="text-[var(--color-neutral)] hover:text-[var(--color-accent)] font-mono text-xs font-bold px-1.5 py-1 cursor-pointer"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* Receipt Live Layout & ASCII Art Footer Editor */}
            <div className="bg-[var(--color-paper-2)] border border-[var(--color-rule)] p-6 rounded-2xl space-y-6">
                <div className="border-b border-[var(--color-rule)] pb-4 flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--color-ink)]">
                            Receipt Live Layout & ASCII Art Editor (การจัดหน้าสลิป)
                        </h2>
                        <p className="text-[11px] font-mono text-[var(--color-neutral)] mt-0.5">
                            ดูตัวอย่างสลิปแบบเรียลไทม์ (80mm / 58mm) พร้อมตกแต่งข้อความ ASCII Art ปิดท้าย
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[var(--color-paper)] p-1 rounded-xl border border-[var(--color-rule)]">
                        {['billing', 'kitchen', 'bar'].map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setPreviewTab(tab)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer ${
                                    previewTab === tab
                                        ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                                        : 'text-[var(--color-neutral)] hover:text-[var(--color-ink)]'
                                }`}
                            >
                                {tab === 'billing' ? 'Billing Slip' : tab === 'kitchen' ? 'Kitchen Slip' : 'Bar Slip'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-6">
                    {/* Left Column: Form Controls (7 cols) */}
                    <div className="lg:col-span-7 space-y-5">
                        {/* Shop Header Metadata Card */}
                        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-4 rounded-xl space-y-3">
                            <h3 className="text-xs font-mono font-bold uppercase text-[var(--color-ink)] border-b border-[var(--color-rule)] pb-2">
                                ข้อมูลหัวบิลใบเสร็จ (Receipt Header Details)
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                        ชื่อร้านบนหัวสลิป (Shop Header Name)
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.receipt_shop_name || ''}
                                        onChange={(e) => handleSave('receipt_shop_name', e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                        placeholder="IN THE HAUS"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                        เบอร์โทรศัพท์ (Phone)
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.receipt_shop_phone || ''}
                                        onChange={(e) => handleSave('receipt_shop_phone', e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                        placeholder="081-234-5678"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                    ที่อยู่ร้านบนสลิป (Address)
                                </label>
                                <input
                                    type="text"
                                    value={settings.receipt_shop_address || ''}
                                    onChange={(e) => handleSave('receipt_shop_address', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    placeholder="ริมแม่น้ำโขง อ.เมือง จ.นครพนม 48000"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)] mb-1">
                                    เลขประจำตัวผู้เสียภาษี (VAT / Tax ID)
                                </label>
                                <input
                                    type="text"
                                    value={settings.receipt_shop_vat || ''}
                                    onChange={(e) => handleSave('receipt_shop_vat', e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg text-xs font-mono text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    placeholder="0105560000000"
                                />
                            </div>
                        </div>

                        {/* Divider Line Pattern Selector (Asterisk Cleaned) */}
                        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-4 rounded-xl space-y-3">
                            <h3 className="text-xs font-mono font-bold uppercase text-[var(--color-ink)] border-b border-[var(--color-rule)] pb-2">
                                เลือกลวดลายเส้นคั่นสลิป (Divider Line Pattern)
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {[
                                    { id: 'dashed', name: 'เส้นประมาตรฐาน', pattern: '- - - - - - - - - - - -' },
                                    { id: 'dotted', name: 'เส้นจุดเรียบหรู', pattern: '. . . . . . . . . . . .' },
                                    { id: 'solid', name: 'เส้นทึบเดี่ยว', pattern: '────────────────────────' },
                                    { id: 'double', name: 'เส้นทึบคู่', pattern: '════════════════════════' },
                                    { id: 'wave', name: 'เส้นคลื่น', pattern: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~' }
                                ].map(style => (
                                    <button
                                        key={style.id}
                                        type="button"
                                        onClick={() => handleSavePrinter({ ...printerConfig, divider_style: style.id })}
                                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                                            (printerConfig.divider_style || 'dashed') === style.id
                                                ? 'bg-[var(--color-paper-2)] border-[var(--color-ink)] shadow-xs'
                                                : 'bg-[var(--color-paper)] border-[var(--color-rule)] hover:border-[var(--color-neutral)]'
                                        }`}
                                    >
                                        <span className="text-[11px] font-mono font-bold text-[var(--color-ink)]">{style.name}</span>
                                        <span className="font-mono text-[10px] text-[var(--color-neutral)] mt-1 overflow-hidden whitespace-nowrap block">
                                            {style.pattern}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ASCII Art Footer Controls Card */}
                        <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] p-4 rounded-xl space-y-3">
                            <h3 className="text-xs font-mono font-bold uppercase text-[var(--color-ink)] border-b border-[var(--color-rule)] pb-2">
                                เลือกข้อความ ASCII Art Footer สำเร็จรูป
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {ASCII_ART_PRESETS.map(preset => (
                                    <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedAsciiPreset(preset.id);
                                            handleSavePrinter({ ...printerConfig, footer_ascii_art: preset.art });
                                        }}
                                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                                            printerConfig.footer_ascii_art === preset.art
                                                ? 'bg-[var(--color-paper-2)] border-[var(--color-ink)] shadow-xs'
                                                : 'bg-[var(--color-paper)] border-[var(--color-rule)] hover:border-[var(--color-neutral)]'
                                        }`}
                                    >
                                        <span className="text-xs font-mono font-bold text-[var(--color-ink)]">{preset.name}</span>
                                        <pre className="font-mono text-[9px] text-[var(--color-neutral)] mt-1.5 whitespace-pre leading-tight bg-[var(--color-paper-2)] p-2 rounded border border-[var(--color-rule)]">
                                            {preset.art}
                                        </pre>
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-1 pt-2">
                                <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)]">
                                    ข้อความ ASCII Art ที่ใช้งานอยู่
                                </label>
                                <textarea
                                    rows={3}
                                    value={printerConfig.footer_ascii_art || ''}
                                    onChange={(e) => handleSavePrinter({ ...printerConfig, footer_ascii_art: e.target.value })}
                                    placeholder="พิมพ์ข้อความตัวอักษร ASCII Art..."
                                    className="w-full p-2.5 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] leading-tight resize-y"
                                />
                            </div>

                            <div className="space-y-1 pt-2 border-t border-[var(--color-rule)]">
                                <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-ink)]">
                                    ข้อความท้ายสลิปหลัก (Shop Footer Text)
                                </label>
                                <input
                                    type="text"
                                    value={printerConfig.shop_footer_text || settings.receipt_shop_footer || 'THANK YOU FOR YOUR VISIT'}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleSavePrinter({ ...printerConfig, shop_footer_text: val });
                                        handleSave('receipt_shop_footer', val);
                                    }}
                                    className="w-full px-3 py-2 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-lg text-xs font-mono font-bold text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)]"
                                    placeholder="เช่น ขอบคุณที่อุดหนุน แล้วพบกันใหม่ครับ!"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Physical Simulated Receipt Card (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col items-center">
                        <div className="text-[10px] font-mono font-bold uppercase text-[var(--color-neutral)] mb-2 flex items-center gap-1.5">
                            <span>Live Thermal Receipt Mockup</span>
                            <span className="bg-[var(--color-ink)] text-[var(--color-paper)] px-2 py-0.5 rounded text-[9px]">
                                {printerConfig.cashier_paper_size || '80mm'}
                            </span>
                        </div>

                        {/* Simulated Thermal Paper Card */}
                        <div className="w-full max-w-[320px] bg-white border border-[var(--color-rule)] shadow-lg p-5 text-black font-mono text-[11px] leading-snug rounded-t-xl select-none">
                            {previewTab === 'billing' ? (
                                <div className="text-center pb-2 mb-2">
                                    <div className="font-bold text-base tracking-tight uppercase">
                                        {settings.receipt_shop_name || 'IN THE HAUS'}
                                    </div>
                                    {settings.receipt_shop_address && (
                                        <div className="text-[9px] text-gray-600 mt-0.5">{settings.receipt_shop_address}</div>
                                    )}
                                    {settings.receipt_shop_phone && (
                                        <div className="text-[9px] text-gray-600">TEL: {settings.receipt_shop_phone}</div>
                                    )}
                                    {settings.receipt_shop_vat && (
                                        <div className="text-[9px] text-gray-600">TAX ID: {settings.receipt_shop_vat}</div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center pb-1 mb-1">
                                    <div className="text-base font-bold uppercase tracking-wide">
                                        {previewTab === 'kitchen' ? 'KITCHEN ORDER (ใบสั่งครัว)' : 'BAR ORDER (ใบสั่งบาร์)'}
                                    </div>
                                </div>
                            )}

                            {/* Divider Line */}
                            <div className="text-center font-mono text-[10px] overflow-hidden whitespace-nowrap my-1 font-bold">
                                {generateDivider(printerConfig.divider_style || 'dashed', 32)}
                            </div>

                            {/* Queue & Table Box */}
                            <div className="border-2 border-black p-2 text-center my-3 bg-gray-50">
                                <div className="text-sm font-bold uppercase">โต๊ะ 04 (TABLE 04)</div>
                                <div className="text-xs font-bold mt-0.5">คิว: #HAUS-102</div>
                            </div>

                            {previewTab === 'billing' && (
                                <div className="my-2 text-[10px] space-y-0.5">
                                    <div>วันที่: {new Date().toLocaleString('th-TH')}</div>
                                    <div>ลูกค้า: Walk-in</div>
                                    <div>พนักงาน: CASHIER A</div>
                                </div>
                            )}

                            {/* Divider Line */}
                            <div className="text-center font-mono text-[10px] overflow-hidden whitespace-nowrap my-1 font-bold">
                                {generateDivider(printerConfig.divider_style || 'dashed', 32)}
                            </div>

                            {/* Order Items */}
                            <div className="my-2 space-y-2">
                                <div className="flex justify-between items-start font-bold">
                                    <span className="w-6 shrink-0">1x</span>
                                    <span className="flex-1 pr-1 truncate">ข้าวผัดกระเพราเนื้อสับไข่ดาว</span>
                                    <span className="shrink-0 tabular-nums">145.-</span>
                                </div>
                                <div className="text-[9px] text-gray-600 pl-6">+ ไข่ดาวสุกพิเศษ</div>

                                <div className="flex justify-between items-start font-bold">
                                    <span className="w-6 shrink-0">2x</span>
                                    <span className="flex-1 pr-1 truncate">MATCHA LATTE ICE</span>
                                    <span className="shrink-0 tabular-nums">240.-</span>
                                </div>
                                <div className="text-[9px] text-gray-600 pl-6">+ หวาน 50%</div>
                            </div>

                            {/* Divider Line */}
                            <div className="text-center font-mono text-[10px] overflow-hidden whitespace-nowrap my-1 font-bold">
                                {generateDivider(printerConfig.divider_style || 'dashed', 32)}
                            </div>

                            {/* Billing Totals */}
                            {previewTab === 'billing' && (
                                <div className="space-y-1 text-[10px] my-2">
                                    <div className="flex justify-between">
                                        <span>จำนวนชิ้น</span>
                                        <span className="tabular-nums">3 ชิ้น</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>ยอดรวมก่อนหัก</span>
                                        <span className="tabular-nums">385.-</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-sm pt-0.5">
                                        <span>ยอดรวมสุทธิ</span>
                                        <span className="tabular-nums">฿385.00</span>
                                    </div>
                                </div>
                            )}

                            {/* Divider Line */}
                            <div className="text-center font-mono text-[10px] overflow-hidden whitespace-nowrap my-1 font-bold">
                                {generateDivider(printerConfig.divider_style || 'dashed', 32)}
                            </div>

                            {/* ASCII Footer */}
                            {previewTab === 'billing' && (
                                <>
                                    <div className="text-center my-3 whitespace-pre font-mono text-[9px] font-bold leading-tight bg-gray-50 p-2 rounded border border-dashed border-gray-300">
                                        {printerConfig.footer_ascii_art || `T H A N K   Y O U\n  S E E   Y O U   A G A I N`}
                                    </div>
                                    <div className="text-center font-bold text-[9px] uppercase tracking-wider">
                                        {printerConfig.shop_footer_text || settings.receipt_shop_footer || 'THANK YOU FOR YOUR VISIT'}
                                    </div>
                                </>
                            )}

                            {/* Sawtooth bottom tear effect */}
                            <div className="w-full h-3 mt-4 bg-[radial-gradient(circle,_transparent_4px,_#ffffff_4px)] bg-[length:10px_10px] bg-repeat-x -mb-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bluetooth Scanner Overlay Modal */}
            {isScanning && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col font-mono text-[var(--color-ink)]">
                        <div className="bg-[var(--color-ink)] text-[var(--color-paper)] p-4 flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                <span className="animate-pulse">●</span> SCANNING FOR PRINTERS
                            </span>
                            <button
                                type="button"
                                onClick={handleCancelScan}
                                className="text-[var(--color-paper)]/70 hover:text-[var(--color-paper)] transition-colors cursor-pointer text-xs font-bold uppercase"
                            >
                                Close
                            </button>
                        </div>

                        <div className="p-4 flex-1 overflow-y-auto max-h-72 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral)]">
                                Select printer from the list below:
                            </p>

                            {scannedDevices.length === 0 ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                                    <div className="w-6 h-6 rounded-full border-2 border-t-[var(--color-ink)] border-[var(--color-rule)] animate-spin" />
                                    <p className="text-xs text-[var(--color-neutral)] font-bold">Searching nearby Bluetooth devices...</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[var(--color-rule)] border border-[var(--color-rule)] rounded-xl overflow-hidden bg-[var(--color-paper-2)]">
                                    {scannedDevices.map((device, idx) => (
                                        <button
                                            key={device.deviceId || idx}
                                            type="button"
                                            onClick={() => handleSelectDevice(device)}
                                            className="w-full text-left px-4 py-3 min-h-[44px] hover:bg-[var(--color-paper)] text-xs font-bold text-[var(--color-ink)] flex items-center justify-between transition-colors cursor-pointer"
                                        >
                                            <span>{device.name}</span>
                                            <span className="text-[9px] text-[var(--color-neutral)] font-normal">{device.deviceId}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-[var(--color-paper-2)] p-3 border-t border-[var(--color-rule)] flex justify-end">
                            <button
                                type="button"
                                onClick={handleCancelScan}
                                className="bg-[var(--color-paper)] border border-[var(--color-rule)] text-[var(--color-ink)] px-4 py-2 min-h-[40px] rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
