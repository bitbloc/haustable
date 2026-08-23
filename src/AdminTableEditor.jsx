/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import PageTransition from './components/PageTransition';
import { DndContext, useDraggable, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { QRCodeSVG } from 'qrcode.react';
import { getAppOrigin, safeTimestampUrl, safeCssUrl } from './utils/urlHelper';
import { toast } from 'sonner';

// Draggable Table Unit Component
const DraggableTable = ({ table, onSelect, isSelected }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: table.id.toString(),
        data: { ...table }
    });

    const rotation = table.rotation || 0;

    const style = {
        transform: transform
            ? `${CSS.Translate.toString(transform)} rotate(${rotation}deg)`
            : `rotate(${rotation}deg)`,
        position: 'absolute',
        left: `${table.pos_x}%`,
        top: `${table.pos_y}%`,
        width: `${table.width}%`,
        height: `${table.height}%`,
        zIndex: isDragging ? 50 : (isSelected ? 40 : 20),
        touchAction: 'none'
    };

    const bgColor = table.table_color || '#1A1A1A';
    const isDark = ['#1A1A1A', '#333333', '#7F1D1D', '#14532D', '#1E3A8A', '#581C87', 'oklch(18% 0.012 28)', 'oklch(52% 0.16 28)'].includes(bgColor);
    const textColor = isDark ? 'white' : 'black';

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(table);
            }}
            className={`dnd-draggable group cursor-move flex items-center justify-center border transition-all ${
                table.shape === 'circle' ? 'rounded-full' : 'rounded-sm'
            } ${
                isSelected
                    ? 'ring-2 ring-[oklch(52%_0.16_28)] border-black scale-102 z-40 shadow-md'
                    : 'border-black/20 hover:border-black/50 shadow-xs'
            }`}
        >
            <div
                className={`absolute inset-0 w-full h-full opacity-90 ${table.shape === 'circle' ? 'rounded-full' : 'rounded-sm'}`}
                style={{ backgroundColor: bgColor }}
            />
            {/* Upright Monospace Label */}
            <div 
                className="relative z-10 flex flex-col items-center pointer-events-none select-none p-1 overflow-hidden w-full text-center" 
                style={{ transform: `rotate(${-rotation}deg)` }}
            >
                <span className="font-mono font-bold text-[11px] truncate max-w-[90%] leading-tight" style={{ color: textColor }}>
                    {table.table_name}
                </span>
                <span className="font-mono text-[8px] opacity-75 uppercase leading-none mt-0.5" style={{ color: textColor }}>
                    {table.capacity}p
                </span>
            </div>
        </div>
    );
};

// Thai Modern OKLCH Palette presets for tables
const COLOR_PRESETS = [
    { name: 'Ink Dark', value: 'oklch(18% 0.012 28)' },
    { name: 'Terracotta', value: 'oklch(52% 0.16 28)' },
    { name: 'Banana Olive', value: 'oklch(45% 0.08 140)' },
    { name: 'Warm Cream', value: 'oklch(94% 0.010 28)' },
    { name: 'Teak Sand', value: 'oklch(75% 0.05 60)' },
    { name: 'Deep Indigo', value: 'oklch(35% 0.12 260)' },
];

// Quick Size Presets for restaurant tables
const SIZE_PRESETS = [
    { name: '2-Top (Small)', w: 8, h: 8, cap: 2, shape: 'rect' },
    { name: '4-Top (Standard)', w: 12, h: 10, cap: 4, shape: 'rect' },
    { name: '6-Top (Large)', w: 16, h: 10, cap: 6, shape: 'rect' },
    { name: '8-Top (Long)', w: 22, h: 12, cap: 8, shape: 'rect' },
    { name: 'Round Booth', w: 12, h: 12, cap: 4, shape: 'circle' },
    { name: 'Bar Stool', w: 6, h: 6, cap: 1, shape: 'circle' },
];

export default function AdminTableEditor() {
    const [tables, setTables] = useState([]);
    const [floorplanUrl, setFloorplanUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    
    // Grid Snap & Settings
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [gridStep, setGridStep] = useState(1); // 1% or 5%
    const [bgOpacity, setBgOpacity] = useState(100);
    const [uploadingBg, setUploadingBg] = useState(false);

    // Modals
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [batchQrModalOpen, setBatchQrModalOpen] = useState(false);
    const [selectedBatchTableIds, setSelectedBatchTableIds] = useState([]);

    // New Table State
    const [newTable, setNewTable] = useState({
        name: '',
        capacity: 4,
        shape: 'rect',
        width: 12,
        height: 10,
        color: 'oklch(18% 0.012 28)',
        rotation: 0
    });

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
    );

    useEffect(() => {
        fetchData(true);

        let debounceTimer = null;
        const debouncedFetch = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                // Don't disturb active saving or modal editing
                if (!saving && !qrModalOpen && !batchQrModalOpen) {
                    fetchData(false);
                }
            }, 400);
        };

        const channel = supabase
            .channel('admin-table-editor-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tables_layout' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, debouncedFetch)
            .subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [saving, qrModalOpen, batchQrModalOpen]);

    const fetchData = async (showLoadingState = false) => {
        if (showLoadingState) setLoading(true);
        try {
            // 1. Fetch tables
            const { data: tablesData, error: tErr } = await supabase
                .from('tables_layout')
                .select('*')
                .order('id');
            if (tErr) throw tErr;
            setTables(tablesData || []);
            setSelectedBatchTableIds((tablesData || []).map(t => t.id));

            // 2. Fetch floorplan schematic image
            const { data: settingsData } = await supabase
                .from('app_settings')
                .select('key, value')
                .in('key', ['floorplan_url', 'floorplan_image_url']);

            const floorSetting = settingsData?.find(s => s.key === 'floorplan_url')?.value 
                              || settingsData?.find(s => s.key === 'floorplan_image_url')?.value;

            if (floorSetting) {
                setFloorplanUrl(safeTimestampUrl(floorSetting));
            } else {
                setFloorplanUrl(null);
            }
        } catch (err) {
            console.error('Fetch error:', err);
            if (showLoadingState) toast.error('Failed to load table layout: ' + err.message);
        } finally {
            if (showLoadingState) setLoading(false);
        }
    };

    // Drag End Handler
    const handleDragEnd = (event) => {
        const { delta, active } = event;
        const canvasElement = document.getElementById('editor-canvas-area');
        if (!canvasElement) return;

        const rect = canvasElement.getBoundingClientRect();
        let percentX = (delta.x / rect.width) * 100;
        let percentY = (delta.y / rect.height) * 100;

        setTables(prev => prev.map(t => {
            if (t.id.toString() === active.id) {
                let newX = t.pos_x + percentX;
                let newY = t.pos_y + percentY;

                if (snapToGrid) {
                    const step = gridStep || 1;
                    newX = Math.round(newX / step) * step;
                    newY = Math.round(newY / step) * step;
                }

                newX = Math.max(0, Math.min(100 - t.width, newX));
                newY = Math.max(0, Math.min(100 - t.height, newY));

                if (selectedTable?.id === t.id) {
                    setSelectedTable(curr => ({ ...curr, pos_x: newX, pos_y: newY }));
                }
                return { ...t, pos_x: newX, pos_y: newY };
            }
            return t;
        }));
    };

    // Save Table Positions & Geometries
    const handleSavePositions = async () => {
        setSaving(true);
        try {
            const updates = tables.map(t => ({
                id: t.id,
                table_name: t.table_name,
                capacity: Number(t.capacity) || 2,
                shape: t.shape || 'rect',
                pos_x: Number(t.pos_x) || 0,
                pos_y: Number(t.pos_y) || 0,
                width: Number(t.width) || 10,
                height: Number(t.height) || 10,
                table_color: t.table_color || 'oklch(18% 0.012 28)',
                rotation: Number(t.rotation) || 0,
                image_url: t.image_url || null
            }));

            const { error } = await supabase.from('tables_layout').upsert(updates);
            if (error) throw error;

            toast.success('Floorplan saved successfully', {
                description: `Updated geometry for ${tables.length} table units`
            });
        } catch (error) {
            console.error('Save Error:', error);
            toast.error('Save failed: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Duplicate Selected Table
    const handleDuplicate = async () => {
        if (!selectedTable) return;
        try {
            const dupName = `${selectedTable.table_name} (Copy)`;
            const dup = {
                table_name: dupName,
                capacity: selectedTable.capacity,
                shape: selectedTable.shape,
                width: selectedTable.width,
                height: selectedTable.height,
                table_color: selectedTable.table_color,
                rotation: selectedTable.rotation,
                pos_x: Math.min(90, (selectedTable.pos_x || 0) + 3),
                pos_y: Math.min(90, (selectedTable.pos_y || 0) + 3)
            };
            const { data, error } = await supabase.from('tables_layout').insert(dup).select().single();
            if (error) throw error;

            setTables([...tables, data]);
            setSelectedTable(data);
            toast.success(`Duplicated ${selectedTable.table_name} to ${dupName}`);
        } catch (error) {
            toast.error('Duplicate Failed: ' + error.message);
        }
    };

    // Add New Table Unit
    const handleAddTable = async () => {
        if (!newTable.name.trim()) {
            toast.error('Please enter a table name');
            return;
        }
        try {
            const { data, error } = await supabase.from('tables_layout').insert({
                table_name: newTable.name.trim(),
                capacity: Number(newTable.capacity) || 4,
                shape: newTable.shape || 'rect',
                width: Number(newTable.width) || 12,
                height: Number(newTable.height) || 10,
                table_color: newTable.color,
                rotation: Number(newTable.rotation) || 0,
                pos_x: 50 - (newTable.width / 2),
                pos_y: 50 - (newTable.height / 2)
            }).select().single();

            if (error) throw error;

            setTables([...tables, data]);
            setSelectedTable(data);
            setNewTable({ ...newTable, name: '' });
            toast.success(`Created table unit: ${data.table_name}`);
        } catch (error) {
            toast.error('Create Failed: ' + error.message);
        }
    };

    // Optimistic Update Field
    const handleUpdateTable = async (id, field, value) => {
        setTables(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
        if (selectedTable?.id === id) {
            setSelectedTable(prev => ({ ...prev, [field]: value }));
        }
        try {
            const { error } = await supabase.from('tables_layout').update({ [field]: value }).eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Update Error:', error.message);
        }
    };

    // Upload Table Real Photo
    const handleUploadTableImage = async (file) => {
        if (!file || !selectedTable) return;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `table-images/${selectedTable.id}-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName);
            handleUpdateTable(selectedTable.id, 'image_url', publicUrl);
            toast.success('Table photo uploaded');
        } catch (error) {
            toast.error('Upload Failed: ' + error.message);
        }
    };

    // Upload / Replace Floorplan Schematic Background Image
    const handleUploadFloorplanBg = async (file) => {
        if (!file) return;
        setUploadingBg(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `floorplans/floorplan-schematic-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('public-assets')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('public-assets').getPublicUrl(fileName);
            
            // Save to app_settings
            const { error: setErr } = await supabase
                .from('app_settings')
                .upsert({ key: 'floorplan_url', value: publicUrl, updated_at: new Date().toISOString() });
            
            if (setErr) throw setErr;

            setFloorplanUrl(safeTimestampUrl(publicUrl));
            toast.success('Floorplan schematic image updated');
        } catch (err) {
            toast.error('Floorplan upload failed: ' + err.message);
        } finally {
            setUploadingBg(false);
        }
    };

    // Clear Floorplan Background
    const handleClearFloorplanBg = async () => {
        try {
            await supabase.from('app_settings').upsert({ key: 'floorplan_url', value: '', updated_at: new Date().toISOString() });
            setFloorplanUrl(null);
            toast.success('Floorplan background removed');
        } catch (err) {
            toast.error('Failed to clear floorplan: ' + err.message);
        }
    };

    // Delete Table
    const handleDeleteTable = async (id, tableName) => {
        if (!confirm(`Delete table unit "${tableName}"?`)) return;
        setTables(prev => prev.filter(t => t.id !== id));
        setSelectedTable(null);
        try {
            const { error } = await supabase.from('tables_layout').delete().eq('id', id);
            if (error) throw error;
            toast.success(`Deleted ${tableName}`);
        } catch (err) {
            toast.error('Failed to delete: ' + err.message);
        }
    };

    // Batch Print Function
    const handlePrintBatchSheet = (selectedTablesToPrint) => {
        const printWindow = window.open('', '_blank', 'width=900,height=1000');
        if (!printWindow) {
            toast.error('Pop-up blocked. Please allow pop-ups to print QR sheet.');
            return;
        }

        const appOrigin = getAppOrigin();

        const cardsHtml = selectedTablesToPrint.map(table => {
            const tableIdentifier = encodeURIComponent(table.table_name || table.id);
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(appOrigin + '/table/' + tableIdentifier)}`;
            return `
                <div class="qr-card">
                    <div class="header">
                        <div class="brand">IN THE HAUS</div>
                        <div class="sub">SCAN TO ORDER • สแกนสั่งอาหาร</div>
                    </div>
                    <div class="table-box">
                        <div class="table-label">TABLE</div>
                        <div class="table-num">${table.table_name}</div>
                    </div>
                    <div class="qr-wrapper">
                        <img src="${qrUrl}" alt="QR ${table.table_name}" class="qr-img" />
                    </div>
                    <div class="instructions">
                        1. เปิดกล้องมือถือสแกน QR Code<br/>
                        2. ตรวจสอบเมนูและส่งออเดอร์ได้ทันที
                    </div>
                </div>
            `;
        }).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>IN THE HAUS - Table QR Ordering Cards</title>
                    <meta charset="utf-8" />
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&family=Space+Grotesk:wght@700;800&family=Space+Mono:wght@700&display=swap');
                        @page {
                            size: A4 portrait;
                            margin: 10mm;
                        }
                        * { box-sizing: border-box; }
                        body {
                            font-family: 'Space Grotesk', 'IBM Plex Sans Thai', sans-serif;
                            margin: 0;
                            padding: 10px;
                            background: white;
                            color: black;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .grid-container {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 15px;
                            page-break-inside: auto;
                        }
                        .qr-card {
                            border: 2px solid #000;
                            padding: 20px;
                            border-radius: 8px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            text-align: center;
                            background: white;
                            page-break-inside: avoid;
                        }
                        .brand {
                            font-size: 16px;
                            font-weight: 900;
                            letter-spacing: 2px;
                            text-transform: uppercase;
                            line-height: 1;
                        }
                        .sub {
                            font-size: 8px;
                            font-weight: 700;
                            font-family: 'Space Mono', monospace;
                            color: #555;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            margin-top: 4px;
                            margin-bottom: 12px;
                        }
                        .table-box {
                            border-top: 1px solid #ccc;
                            border-bottom: 1px solid #ccc;
                            width: 100%;
                            padding: 6px 0;
                            margin-bottom: 12px;
                        }
                        .table-label {
                            font-size: 9px;
                            font-weight: 700;
                            color: #777;
                            font-family: 'Space Mono', monospace;
                            letter-spacing: 2px;
                        }
                        .table-num {
                            font-size: 32px;
                            font-weight: 900;
                            line-height: 1.1;
                            margin: 2px 0;
                        }
                        .qr-wrapper {
                            padding: 8px;
                            background: white;
                            border: 1px solid #000;
                            margin-bottom: 12px;
                        }
                        .qr-img {
                            width: 140px;
                            height: 140px;
                            display: block;
                        }
                        .instructions {
                            font-size: 9px;
                            font-weight: 600;
                            line-height: 1.4;
                            color: #333;
                            font-family: 'IBM Plex Sans Thai', sans-serif;
                        }
                    </style>
                </head>
                <body>
                    <div class="grid-container">
                        ${cardsHtml}
                    </div>
                    <script>
                        window.onload = function() {
                            setTimeout(function() { window.print(); }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] bg-[oklch(97%_0.008_28)] font-mono text-xs text-[oklch(55%_0.010_28)] gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-[oklch(85%_0.012_28)] border-t-[oklch(18%_0.012_28)] animate-spin" />
                <span>LOADING STUDIO WORKBENCH...</span>
            </div>
        );
    }

    return (
        <PageTransition>
            <div className="p-4 flex flex-col gap-4 text-[oklch(18%_0.012_28)] font-sans select-none bg-[oklch(97%_0.008_28)]">
                
                {/* --- Workbench Toolbar --- */}
                <div className="flex flex-wrap items-center justify-between bg-[oklch(98%_0.006_28)] p-3 rounded-sm border border-[oklch(85%_0.012_28)] shadow-xs gap-3">
                    
                    {/* Left: Tool Toggles */}
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider text-[oklch(42%_0.010_28)] cursor-pointer bg-[oklch(94%_0.010_28)] px-3 py-2 rounded-sm border border-[oklch(85%_0.012_28)]">
                            <input
                                type="checkbox"
                                checked={snapToGrid}
                                onChange={e => setSnapToGrid(e.target.checked)}
                                className="accent-[oklch(52%_0.16_28)] w-3.5 h-3.5"
                            />
                            SNAP GRID ({gridStep}%)
                        </label>

                        {/* Grid Resolution */}
                        {snapToGrid && (
                            <div className="flex bg-[oklch(94%_0.010_28)] p-0.5 rounded-sm border border-[oklch(85%_0.012_28)] font-mono text-[9px] font-bold uppercase">
                                <button
                                    type="button"
                                    onClick={() => setGridStep(1)}
                                    className={`px-2 py-1 rounded-xs cursor-pointer ${gridStep === 1 ? 'bg-[oklch(18%_0.012_28)] text-white' : 'text-[oklch(42%_0.010_28)]'}`}
                                >
                                    1% FINE
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGridStep(5)}
                                    className={`px-2 py-1 rounded-xs cursor-pointer ${gridStep === 5 ? 'bg-[oklch(18%_0.012_28)] text-white' : 'text-[oklch(42%_0.010_28)]'}`}
                                >
                                    5% COARSE
                                </button>
                            </div>
                        )}

                        {/* Floorplan Background schematic controls */}
                        <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold">
                            <label className="bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] px-3 py-2 rounded-sm cursor-pointer uppercase flex items-center gap-1">
                                <span>{uploadingBg ? 'UPLOADING...' : floorplanUrl ? 'CHANGE SCHEMATIC' : 'UPLOAD SCHEMATIC'}</span>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    disabled={uploadingBg}
                                    onChange={e => handleUploadFloorplanBg(e.target.files[0])}
                                />
                            </label>
                            {floorplanUrl && (
                                <button
                                    type="button"
                                    onClick={handleClearFloorplanBg}
                                    className="px-2 py-2 bg-[oklch(94%_0.010_28)] hover:bg-red-50 text-red-600 border border-[oklch(85%_0.012_28)] rounded-sm cursor-pointer uppercase"
                                    title="Remove Background Image"
                                >
                                    CLEAR BG
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setBatchQrModalOpen(true)}
                            className="bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] px-4 py-2.5 rounded-sm font-mono font-bold text-xs uppercase tracking-wider cursor-pointer"
                        >
                            BATCH QR FLYERS ({tables.length})
                        </button>

                        <button
                            type="button"
                            disabled={saving}
                            onClick={handleSavePositions}
                            className="bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white px-5 py-2.5 rounded-sm font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                        >
                            {saving ? 'SAVING...' : 'SAVE LAYOUT CHANGES'}
                        </button>
                    </div>
                </div>

                {/* --- Editor Workspace (Canvas + Inspector) --- */}
                <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[600px] h-auto lg:h-[calc(100vh-250px)]">
                    
                    {/* Canvas Area */}
                    <div className="flex-1 w-full lg:w-auto h-[500px] lg:h-auto relative overflow-hidden rounded-sm border border-[oklch(85%_0.012_28)] bg-[oklch(94%_0.010_28)] flex flex-col shadow-inner">
                        <TransformWrapper
                            initialScale={0.85}
                            minScale={0.2}
                            maxScale={4}
                            centerOnInit={true}
                            limitToBounds={false}
                            panning={{ excluded: ["dnd-draggable"] }}
                            doubleClick={{ disabled: true }}
                        >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <>
                                    {/* Zoom controls */}
                                    <div className="absolute top-4 right-4 z-50 flex gap-1 bg-[oklch(98%_0.006_28)]/95 border border-[oklch(85%_0.012_28)] p-1 rounded-sm shadow-xs backdrop-blur-xs font-mono text-xs font-bold">
                                        <button onClick={() => zoomIn()} className="px-2.5 py-1 hover:bg-[oklch(90%_0.012_28)] rounded-sm cursor-pointer" title="Zoom In">+</button>
                                        <button onClick={() => zoomOut()} className="px-2.5 py-1 hover:bg-[oklch(90%_0.012_28)] rounded-sm cursor-pointer" title="Zoom Out">-</button>
                                        <button onClick={() => resetTransform()} className="px-2.5 py-1 hover:bg-[oklch(90%_0.012_28)] rounded-sm cursor-pointer uppercase" title="Reset View">RESET</button>
                                    </div>

                                    <TransformComponent wrapperClass="w-full h-full cursor-grab active:cursor-grabbing" contentClass="w-full h-full flex items-center justify-center p-20">
                                        <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
                                            <div
                                                id="editor-canvas-area"
                                                className="relative bg-[oklch(98%_0.006_28)] shadow-sm transition-transform origin-center border border-[oklch(85%_0.012_28)] rounded-sm overflow-hidden"
                                                style={{
                                                    width: '1000px',
                                                    height: '750px',
                                                    backgroundImage: safeCssUrl(floorplanUrl),
                                                    backgroundSize: '100% 100%',
                                                    backgroundRepeat: 'no-repeat',
                                                    opacity: bgOpacity / 100
                                                }}
                                                onClick={() => setSelectedTable(null)}
                                            >
                                                {!floorplanUrl && (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[oklch(55%_0.010_28)] font-mono font-bold text-xs uppercase tracking-widest opacity-40 pointer-events-none select-none">
                                                        <span>NO SCHEMATIC BACKGROUND IMAGE</span>
                                                        <span className="text-[9px] mt-1">CLICK 'UPLOAD SCHEMATIC' ABOVE</span>
                                                    </div>
                                                )}

                                                {tables.map(table => (
                                                    <DraggableTable
                                                        key={table.id}
                                                        table={table}
                                                        onSelect={setSelectedTable}
                                                        isSelected={selectedTable?.id === table.id}
                                                    />
                                                ))}
                                            </div>
                                        </DndContext>
                                    </TransformComponent>
                                </>
                            )}
                        </TransformWrapper>
                    </div>

                    {/* --- Sidebar Inspector --- */}
                    <div className="lg:w-96 bg-[oklch(98%_0.006_28)] p-5 rounded-sm border border-[oklch(85%_0.012_28)] h-full flex flex-col shadow-xs overflow-y-auto">
                        {selectedTable ? (
                            // Edit Mode
                            <div className="space-y-4 flex-1 flex flex-col">
                                <div className="flex justify-between items-center border-b border-[oklch(85%_0.012_28)] pb-3 shrink-0">
                                    <div>
                                        <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                                            UNIT INSPECTOR
                                        </span>
                                        <h2 className="font-mono text-base font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                                            {selectedTable.table_name}
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTable(null)}
                                        className="text-[oklch(42%_0.010_28)] hover:text-black font-mono text-xs font-bold p-1 cursor-pointer"
                                    >
                                        ✕ CLOSE
                                    </button>
                                </div>

                                <div className="space-y-3.5 flex-1 font-mono text-xs">
                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] mb-1 block">
                                            TABLE NAME (ชื่อโต๊ะ)
                                        </label>
                                        <input
                                            type="text"
                                            value={selectedTable.table_name}
                                            onChange={(e) => handleUpdateTable(selectedTable.id, 'table_name', e.target.value)}
                                            className="w-full px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm outline-none focus:border-[oklch(52%_0.16_28)] font-bold"
                                        />
                                    </div>

                                    {/* Shape & Capacity */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] mb-1 block">
                                                SEATS (ที่นั่ง)
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="40"
                                                value={selectedTable.capacity}
                                                onChange={(e) => handleUpdateTable(selectedTable.id, 'capacity', parseInt(e.target.value) || 1)}
                                                className="w-full px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm outline-none focus:border-[oklch(52%_0.16_28)] font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] mb-1 block">
                                                SHAPE (ทรง)
                                            </label>
                                            <select
                                                value={selectedTable.shape}
                                                onChange={(e) => handleUpdateTable(selectedTable.id, 'shape', e.target.value)}
                                                className="w-full px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm outline-none focus:border-[oklch(52%_0.16_28)] font-bold cursor-pointer"
                                            >
                                                <option value="rect">Rectangle</option>
                                                <option value="circle">Circle</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Quick Size Presets */}
                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] mb-1 block">
                                            QUICK SIZE PRESETS
                                        </label>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {SIZE_PRESETS.map(preset => (
                                                <button
                                                    key={preset.name}
                                                    type="button"
                                                    onClick={() => {
                                                        handleUpdateTable(selectedTable.id, 'width', preset.w);
                                                        handleUpdateTable(selectedTable.id, 'height', preset.h);
                                                        handleUpdateTable(selectedTable.id, 'shape', preset.shape);
                                                        handleUpdateTable(selectedTable.id, 'capacity', preset.cap);
                                                    }}
                                                    className="px-2 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-[9px] font-bold text-center cursor-pointer"
                                                >
                                                    {preset.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Width & Height Sliders */}
                                    <div className="space-y-2 pt-1 border-t border-[oklch(85%_0.012_28)]">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[9px] font-bold text-[oklch(55%_0.010_28)] w-10">WIDTH</span>
                                            <input
                                                type="range"
                                                min="2"
                                                max="40"
                                                value={selectedTable.width}
                                                onChange={(e) => handleUpdateTable(selectedTable.id, 'width', parseInt(e.target.value))}
                                                className="flex-1 accent-[oklch(52%_0.16_28)] h-1 bg-gray-200 rounded-sm appearance-none cursor-pointer"
                                            />
                                            <span className="text-[10px] font-bold w-8 text-right">{selectedTable.width}%</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[9px] font-bold text-[oklch(55%_0.010_28)] w-10">HEIGHT</span>
                                            <input
                                                type="range"
                                                min="2"
                                                max="40"
                                                value={selectedTable.height}
                                                onChange={(e) => handleUpdateTable(selectedTable.id, 'height', parseInt(e.target.value))}
                                                className="flex-1 accent-[oklch(52%_0.16_28)] h-1 bg-gray-200 rounded-sm appearance-none cursor-pointer"
                                            />
                                            <span className="text-[10px] font-bold w-8 text-right">{selectedTable.height}%</span>
                                        </div>
                                    </div>

                                    {/* Rotation */}
                                    <div className="pt-2 border-t border-[oklch(85%_0.012_28)]">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)]">
                                                ROTATION ({selectedTable.rotation || 0}°)
                                            </label>
                                            <div className="flex gap-1">
                                                {[0, 90, 180, 270].map(deg => (
                                                    <button
                                                        key={deg}
                                                        type="button"
                                                        onClick={() => handleUpdateTable(selectedTable.id, 'rotation', deg)}
                                                        className={`px-1.5 py-0.5 text-[8px] font-bold rounded-xs border cursor-pointer ${
                                                            selectedTable.rotation === deg
                                                                ? 'bg-[oklch(18%_0.012_28)] text-white border-black'
                                                                : 'bg-[oklch(94%_0.010_28)] border-[oklch(85%_0.012_28)] text-[oklch(42%_0.010_28)]'
                                                        }`}
                                                    >
                                                        {deg}°
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="360"
                                            step="5"
                                            value={selectedTable.rotation || 0}
                                            onChange={(e) => handleUpdateTable(selectedTable.id, 'rotation', parseInt(e.target.value))}
                                            className="w-full accent-[oklch(52%_0.16_28)] h-1 bg-gray-200 rounded-sm appearance-none cursor-pointer"
                                        />
                                    </div>

                                    {/* Color Theme */}
                                    <div className="pt-2 border-t border-[oklch(85%_0.012_28)]">
                                        <label className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] mb-1.5 block">
                                            COLOR PALETTE
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {COLOR_PRESETS.map(c => (
                                                <button
                                                    key={c.name}
                                                    type="button"
                                                    onClick={() => handleUpdateTable(selectedTable.id, 'table_color', c.value)}
                                                    className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                                                        selectedTable.table_color === c.value ? 'ring-2 ring-[oklch(52%_0.16_28)] scale-110 shadow-xs' : 'opacity-80'
                                                    }`}
                                                    style={{ backgroundColor: c.value }}
                                                    title={c.name}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="pt-3 border-t border-[oklch(85%_0.012_28)] flex flex-col gap-2 font-mono text-[9px] font-bold uppercase tracking-wider">
                                        <button
                                            type="button"
                                            onClick={() => setQrModalOpen(true)}
                                            className="w-full py-2.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] rounded-sm cursor-pointer"
                                        >
                                            PRINT QR ORDER FLYER
                                        </button>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={handleDuplicate}
                                                className="py-2 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] rounded-sm cursor-pointer"
                                            >
                                                DUPLICATE
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteTable(selectedTable.id, selectedTable.table_name)}
                                                className="py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-sm cursor-pointer"
                                            >
                                                DELETE
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Add New Table Mode
                            <div className="space-y-4 flex flex-col h-full font-mono text-xs">
                                <div className="border-b border-[oklch(85%_0.012_28)] pb-3 shrink-0">
                                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                                        ADD NEW ELEMENT
                                    </span>
                                    <h2 className="font-mono text-base font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                                        NEW TABLE UNIT
                                    </h2>
                                </div>

                                <div className="space-y-3 flex-1">
                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] mb-1 block">
                                            TABLE NAME (ชื่อโต๊ะ)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. A1, VIP-1, T4"
                                            value={newTable.name}
                                            onChange={e => setNewTable({ ...newTable, name: e.target.value })}
                                            className="w-full px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm outline-none focus:border-[oklch(52%_0.16_28)] font-bold"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] mb-1 block">
                                                SEATS (คน)
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={newTable.capacity}
                                                onChange={e => setNewTable({ ...newTable, capacity: parseInt(e.target.value) || 1 })}
                                                className="w-full px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm outline-none focus:border-[oklch(52%_0.16_28)] font-bold"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] mb-1 block">
                                                SHAPE
                                            </label>
                                            <select
                                                value={newTable.shape}
                                                onChange={e => setNewTable({ ...newTable, shape: e.target.value })}
                                                className="w-full px-3 py-2 bg-[oklch(94%_0.010_28)] border border-[oklch(85%_0.012_28)] rounded-sm outline-none focus:border-[oklch(52%_0.16_28)] font-bold cursor-pointer"
                                            >
                                                <option value="rect">Rectangle</option>
                                                <option value="circle">Circle</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Presets */}
                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] mb-1 block">
                                            SIZE PRESET
                                        </label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {SIZE_PRESETS.slice(0, 4).map(preset => (
                                                <button
                                                    key={preset.name}
                                                    type="button"
                                                    onClick={() => setNewTable({ ...newTable, width: preset.w, height: preset.h, shape: preset.shape, capacity: preset.cap })}
                                                    className="px-2 py-1.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] rounded-sm text-[9px] font-bold text-center cursor-pointer"
                                                >
                                                    {preset.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold uppercase tracking-wider text-[oklch(55%_0.010_28)] mb-1 block">
                                            COLOR THEME
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {COLOR_PRESETS.map(c => (
                                                <button
                                                    key={c.name}
                                                    type="button"
                                                    onClick={() => setNewTable({ ...newTable, color: c.value })}
                                                    className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                                                        newTable.color === c.value ? 'ring-2 ring-[oklch(52%_0.16_28)] scale-110 shadow-xs' : 'opacity-80'
                                                    }`}
                                                    style={{ backgroundColor: c.value }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleAddTable}
                                        className="w-full py-3 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white rounded-sm font-mono font-bold text-xs uppercase tracking-wider transition-colors mt-4 cursor-pointer"
                                    >
                                        + CREATE TABLE UNIT
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- SINGLE QR ORDERING FLYER MODAL --- */}
                {qrModalOpen && selectedTable && (
                    <div
                        className="fixed inset-0 bg-black/75 z-[100] flex items-center justify-center p-4 backdrop-blur-xs"
                        onClick={() => setQrModalOpen(false)}
                    >
                        <div
                            className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center gap-4"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="w-full flex justify-between items-center pb-2 border-b border-[oklch(85%_0.012_28)]">
                                <span className="font-mono font-bold text-xs uppercase tracking-wider text-[oklch(42%_0.010_28)]">
                                    QR ORDERING FLYER
                                </span>
                                <button onClick={() => setQrModalOpen(false)} className="font-mono text-xs font-bold text-[oklch(42%_0.010_28)] hover:text-black">
                                    ✕
                                </button>
                            </div>

                            {/* Flyer Card Preview */}
                            <div className="bg-white text-black p-6 rounded-sm border-2 border-black flex flex-col items-center w-full max-w-[280px] shadow-sm font-sans">
                                <span className="font-mono font-black text-base tracking-widest uppercase">IN THE HAUS</span>
                                <span className="font-mono text-[8px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">SCAN TO ORDER / สแกนสั่งอาหาร</span>
                                
                                <div className="border-t border-b border-gray-300 w-full py-2 my-3 text-center">
                                    <span className="font-mono text-[9px] font-bold text-gray-500 uppercase tracking-widest block">TABLE</span>
                                    <span className="font-mono text-4xl font-black leading-none block">{selectedTable.table_name}</span>
                                </div>

                                <div className="p-2 border border-black bg-white my-1">
                                    <QRCodeSVG
                                        value={`${getAppOrigin()}/table/${encodeURIComponent(selectedTable.table_name || selectedTable.id)}`}
                                        size={150}
                                        level="H"
                                    />
                                </div>

                                <div className="text-[8px] font-medium text-gray-600 leading-tight mt-3 text-center">
                                    1. เปิดกล้องสแกนคิวอาร์โค้ด<br/>
                                    2. เลือกเมนูและส่งเข้าห้องครัวได้ทันที
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 w-full font-mono text-[10px] font-bold uppercase tracking-wider">
                                <button
                                    type="button"
                                    onClick={() => handlePrintBatchSheet([selectedTable])}
                                    className="flex-1 py-2.5 bg-[oklch(18%_0.012_28)] text-white rounded-sm hover:bg-black cursor-pointer"
                                >
                                    PRINT FLYER
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQrModalOpen(false)}
                                    className="px-4 py-2.5 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] rounded-sm cursor-pointer"
                                >
                                    CLOSE
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- BATCH QR CODE FLYERS STUDIO MODAL --- */}
                {batchQrModalOpen && (
                    <div
                        className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-xs"
                        onClick={() => setBatchQrModalOpen(false)}
                    >
                        <div
                            className="bg-[oklch(98%_0.006_28)] border border-[oklch(85%_0.012_28)] rounded-sm p-6 max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center pb-3 border-b border-[oklch(85%_0.012_28)] shrink-0">
                                <div>
                                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[oklch(52%_0.16_28)]">
                                        BATCH QR STUDIO
                                    </span>
                                    <h3 className="font-mono text-xl font-bold uppercase tracking-tight text-[oklch(18%_0.012_28)]">
                                        Print All Store QR Flyers
                                    </h3>
                                </div>
                                <button onClick={() => setBatchQrModalOpen(false)} className="font-mono text-xs font-bold text-[oklch(42%_0.010_28)] hover:text-black">
                                    ✕
                                </button>
                            </div>

                            {/* Table Checkbox Selection */}
                            <div className="my-4 flex-1 overflow-y-auto pr-1 space-y-3 font-mono text-xs">
                                <div className="flex justify-between items-center text-[10px] text-[oklch(55%_0.010_28)] uppercase font-bold">
                                    <span>SELECT TABLES TO PRINT ({selectedBatchTableIds.length}/{tables.length})</span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedBatchTableIds(tables.map(t => t.id))}
                                            className="text-[oklch(52%_0.16_28)] hover:underline cursor-pointer"
                                        >
                                            SELECT ALL
                                        </button>
                                        <span>•</span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedBatchTableIds([])}
                                            className="hover:underline cursor-pointer"
                                        >
                                            CLEAR
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {tables.map(t => {
                                        const isChecked = selectedBatchTableIds.includes(t.id);
                                        return (
                                            <label
                                                key={t.id}
                                                className={`p-2.5 rounded-sm border flex items-center gap-2 cursor-pointer transition-all ${
                                                    isChecked
                                                        ? 'bg-[oklch(94%_0.010_28)] border-[oklch(52%_0.16_28)] text-[oklch(18%_0.012_28)] font-bold'
                                                        : 'bg-[oklch(98%_0.006_28)] border-[oklch(85%_0.012_28)] opacity-60'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            setSelectedBatchTableIds([...selectedBatchTableIds, t.id]);
                                                        } else {
                                                            setSelectedBatchTableIds(selectedBatchTableIds.filter(id => id !== t.id));
                                                        }
                                                    }}
                                                    className="accent-[oklch(52%_0.16_28)]"
                                                />
                                                <span className="truncate">{t.table_name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Batch Print Actions */}
                            <div className="pt-3 border-t border-[oklch(85%_0.012_28)] flex gap-2 font-mono text-[10px] font-bold uppercase tracking-wider shrink-0">
                                <button
                                    type="button"
                                    disabled={selectedBatchTableIds.length === 0}
                                    onClick={() => {
                                        const tablesToPrint = tables.filter(t => selectedBatchTableIds.includes(t.id));
                                        handlePrintBatchSheet(tablesToPrint);
                                    }}
                                    className="flex-1 py-3 bg-[oklch(52%_0.16_28)] hover:bg-[oklch(45%_0.16_28)] text-white rounded-sm cursor-pointer disabled:opacity-40"
                                >
                                    PRINT {selectedBatchTableIds.length} QR CARDS (A4 GRID SHEET)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBatchQrModalOpen(false)}
                                    className="px-5 py-3 bg-[oklch(94%_0.010_28)] hover:bg-[oklch(90%_0.012_28)] border border-[oklch(85%_0.012_28)] text-[oklch(18%_0.012_28)] rounded-sm cursor-pointer"
                                >
                                    CANCEL
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
}