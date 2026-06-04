// src/AdminTableEditor.jsx
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import PageTransition from './components/PageTransition';
import { DndContext, useDraggable, useSensor, useSensors, MouseSensor, TouchSensor } from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Save, Plus, Trash2, Edit, X, ZoomIn, ZoomOut, Maximize, RotateCw, Upload, QrCode, Printer } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Component โต๊ะที่ลากได้
const DraggableTable = ({ table, onSelect, isSelected }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: table.id.toString(),
        data: { ...table }
    });

    const rotation = table.rotation || 0;

    const style = {
        // Apply Translation from DnD + Rotation from State
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

    const bgColor = table.table_color || '#333333';
    const isDark = ['#333333', '#7F1D1D', '#14532D', '#1E3A8A', '#581C87'].includes(bgColor);
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
            className={`dnd-draggable group cursor-move flex items-center justify-center shadow-lg transition-all
        ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'}
        ${isSelected
                    ? 'ring-4 ring-primary ring-opacity-100 z-50 scale-105'
                    : 'hover:ring-2 hover:ring-white/50 hover:scale-105'
                }
      `}
        >
            <div
                className={`absolute inset-0 w-full h-full opacity-90 shadow-sm ${table.shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}
                style={{ backgroundColor: bgColor }}
            />
            {/* Counter-rotate text for better readability (optional, can remove style if unwanted) */}
            <div className="relative z-10 flex flex-col items-center pointer-events-none select-none p-1 overflow-hidden w-full" style={{ transform: `rotate(${-rotation}deg)` }}>
                <span className="font-bold text-[10px] sm:text-xs truncate max-w-[90%] leading-tight" style={{ color: textColor }}>{table.table_name}</span>
                <span className="text-[8px] sm:text-[10px] opacity-80 leading-tight" style={{ color: textColor }}>{table.capacity}p</span>
            </div>
        </div>
    );
};

const COLOR_PRESETS = [
    { name: 'Default', value: '#333333' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Green', value: '#22C55E' },
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Purple', value: '#A855F7' },
    { name: 'Gold', value: '#EAB308' },
];

export default function AdminTableEditor() {
    const [tables, setTables] = useState([]);
    const [floorplanUrl, setFloorplanUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedTable, setSelectedTable] = useState(null);
    const [newTable, setNewTable] = useState({
        name: '',
        capacity: 4,
        shape: 'rect',
        width: 10,
        height: 10,
        color: '#333333',
        rotation: 0
    });
    const [snapToGrid, setSnapToGrid] = useState(true);
    const [qrModalOpen, setQrModalOpen] = useState(false);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    useEffect(() => {
        fetchData();
        // Warning: keydown listeners removed for stability in this version
    }, []);

    const fetchData = async () => {
        setLoading(true);
        // Ensure we fetch ALL columns. If table_color/rotation missing in DB, this might still work or return nulls.
        const { data: tablesData, error } = await supabase.from('tables_layout').select('*').order('id');
        if (error) console.error("Fetch error:", error);

        setTables(tablesData || []);

        const { data: settingsData } = await supabase.from('app_settings').select('value').eq('key', 'floorplan_url').single();
        if (settingsData?.value) {
            setFloorplanUrl(`${settingsData.value}?t=${new Date().getTime()}`);
        }
        setLoading(false);
    };

    const handleDragEnd = (event) => {
        const { delta, active } = event;
        const canvasElement = document.getElementById('canvas-area');
        if (!canvasElement) return;

        const rect = canvasElement.getBoundingClientRect();
        // Calculate movement as percentage of current view
        let percentX = (delta.x / rect.width) * 100;
        let percentY = (delta.y / rect.height) * 100;

        setTables(prev => prev.map(t => {
            if (t.id.toString() === active.id) {
                let newX = t.pos_x + percentX;
                let newY = t.pos_y + percentY;

                if (snapToGrid) {
                    newX = Math.round(newX);
                    newY = Math.round(newY);
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

    const handleSavePositions = async () => {
        try {
            // *** CRITICAL FIX: Include ALL columns in upsert to prevent "null value in column table_name" error ***
            const updates = tables.map(t => ({
                id: t.id,
                table_name: t.table_name, // Must be included!
                capacity: t.capacity,     // Must be included!
                shape: t.shape,           // Must be included!
                pos_x: t.pos_x,
                pos_y: t.pos_y,
                width: t.width,
                height: t.height,
                table_color: t.table_color,
                rotation: t.rotation
            }));

            const { error } = await supabase.from('tables_layout').upsert(updates);
            if (error) throw error;

            alert('บันทึกข้อมูลเรียบร้อย (Saved Successfully)!');
        } catch (error) {
            console.error('Save Error:', error);
            alert(`Save Failed: ${error.message}\n\n(Tip: Ensure you have run the DB SQL to add 'table_color' and 'rotation' columns)`);
        }
    };

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
                pos_x: Math.min(90, selectedTable.pos_x + 2),
                pos_y: Math.min(90, selectedTable.pos_y + 2)
            };
            const { data, error } = await supabase.from('tables_layout').insert(dup).select().single();
            if (error) throw error;
            setTables([...tables, data]);
            setSelectedTable(data);
        } catch (error) {
            alert('Duplicate Failed: ' + error.message);
        }
    };

    const handleAddTable = async () => {
        if (!newTable.name) return alert('กรุณาใส่ชื่อโต๊ะ');
        try {
            const { error } = await supabase.from('tables_layout').insert({
                table_name: newTable.name,
                capacity: newTable.capacity,
                shape: newTable.shape,
                width: newTable.width,
                height: newTable.height,
                table_color: newTable.color,
                rotation: newTable.rotation,
                pos_x: 50 - (newTable.width / 2),
                pos_y: 50 - (newTable.height / 2)
            });
            if (error) throw error;
            fetchData();
            setNewTable({ ...newTable, name: '' }); // Reset form
        } catch (error) {
            alert('Create Failed: ' + error.message);
        }
    };

    const handleUpdateTable = async (id, field, value) => {
        // Optimistic UI Update
        setTables(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
        if (selectedTable?.id === id) {
            setSelectedTable(prev => ({ ...prev, [field]: value }));
        }
        // Background DB Update
        try {
            const { error } = await supabase.from('tables_layout').update({ [field]: value }).eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Update Error:', error.message);
        }
    };

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
            alert('Image Uploaded!');
        } catch (error) {
            console.error('Upload Error:', error);
            alert('Upload Failed: ' + error.message);
        }
    };

    const handleDeleteTable = async (id) => {
        if (!confirm('ยืนยันที่จะลบโต๊ะนี้?')) return;
        setTables(prev => prev.filter(t => t.id !== id));
        setSelectedTable(null);
        await supabase.from('tables_layout').delete().eq('id', id);
    };

    if (loading) return <div className="p-6 text-white flex justify-center items-center h-screen">Loading editor...</div>;

    return (
        <PageTransition>
            <div className="p-0 flex flex-col gap-6 text-ink">

                {/* --- Toolbar --- */}
                <div className="flex flex-col md:flex-row justify-between items-center bg-paper p-4 rounded-2xl border border-gray-100 shadow-sm z-10 sticky top-2">
                    <h1 className="text-xl sm:text-2xl font-bold text-ink mb-4 md:mb-0">Floor Plan Editor</h1>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs text-subInk cursor-pointer bg-canvas p-2.5 rounded-xl border border-gray-100 select-none transition-colors">
                            <input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)} className="accent-black w-4 h-4" />
                            Snap Grid (1%)
                        </label>
                        <button onClick={handleSavePositions} className="bg-black text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-md active:scale-95">
                            <Save size={20} /> Save Changes
                        </button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-[500px] lg:min-h-[600px] h-auto lg:h-[80vh]">

                    {/* --- Main Editor Area (Unlimited Workspace) --- */}
                    <div className="flex-1 w-full lg:w-auto h-[50vh] lg:h-auto relative overflow-hidden rounded-3xl border border-gray-100 bg-[#0f0f0f] shadow-inner flex flex-col order-1 lg:order-1">
                        <TransformWrapper
                            initialScale={0.8}
                            minScale={0.2}
                            maxScale={4}
                            centerOnInit={true}
                            limitToBounds={false}
                            panning={{ excluded: ["dnd-draggable"] }}
                            doubleClick={{ disabled: true }}
                        >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <>
                                    <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 bg-paper/90 backdrop-blur p-2 rounded-xl border border-gray-200 shadow-md">
                                        <button onClick={() => zoomIn()} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-ink" title="Zoom In"><ZoomIn size={20} /></button>
                                        <button onClick={() => zoomOut()} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-ink" title="Zoom Out"><ZoomOut size={20} /></button>
                                        <button onClick={() => resetTransform()} className="p-2 text-black hover:bg-zinc-100 rounded-lg transition-colors" title="Reset View"><Maximize size={20} /></button>
                                    </div>
                                    <TransformComponent wrapperClass="w-full h-full cursor-grab active:cursor-grabbing" contentClass="w-full h-full flex items-center justify-center p-20">
                                        <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
                                            <div
                                                id="canvas-area"
                                                className="relative bg-white shadow-2xl transition-transform origin-center"
                                                style={{
                                                    width: '1000px', // Fixed Reference Dimensions
                                                    height: '750px',
                                                    backgroundImage: floorplanUrl ? `url(${floorplanUrl})` : undefined,
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center',
                                                    backgroundColor: '#1a1a1a',
                                                    borderColor: '#ddd',
                                                    borderWidth: '1px',
                                                }}
                                                onClick={() => setSelectedTable(null)}
                                            >
                                                {!floorplanUrl && (
                                                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-bold text-xl opacity-50 pointer-events-none select-none flex-col gap-2">
                                                        <Maximize size={48} className="opacity-20" />
                                                        <span>No Floor Plan Image</span>
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

                    {/* --- Sidebar --- */}
                    <div className="lg:w-96 bg-paper p-6 rounded-3xl border border-gray-100 h-full flex flex-col shadow-sm">
                        {selectedTable ? (
                            // --- Edit Mode ---
                            <div className="space-y-6 flex-1 flex flex-col animate-fade-in custom-scrollbar overflow-y-auto">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                                    <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                                        <Edit size={22} className="text-black" /> Edit Table <span className="text-gray-400 text-sm font-normal ml-2">(แก้ไข)</span>
                                    </h2>
                                    <button onClick={() => setSelectedTable(null)} className="text-gray-400 hover:text-black transition-colors rounded-full p-1 hover:bg-zinc-100">
                                        <X size={24} />
                                    </button>
                                </div>
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-sm text-subInk mb-1 block font-semibold">Name (ชื่อโต๊ะ)</label>
                                        <input type="text" value={selectedTable.table_name} onChange={(e) => handleUpdateTable(selectedTable.id, 'table_name', e.target.value)} className="w-full p-3 bg-canvas border border-gray-200 rounded-xl focus:border-zinc-500 outline-none text-ink transition-colors" />
                                    </div>

                                    <div>
                                        <label className="text-sm text-subInk mb-2 block font-semibold">Color Theme (สี)</label>
                                        <div className="flex flex-wrap gap-2">
                                            {COLOR_PRESETS.map(c => (
                                                <button
                                                    key={c.name}
                                                    onClick={() => handleUpdateTable(selectedTable.id, 'table_color', c.value)}
                                                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${selectedTable.table_color === c.value ? 'border-zinc-400 scale-110 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                                    style={{ backgroundColor: c.value }}
                                                    title={c.name}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm text-subInk mb-2 block font-semibold flex items-center gap-2">
                                            <RotateCw size={14} /> Rotation: {selectedTable.rotation || 0}°
                                        </label>
                                        <input type="range" min="0" max="360" step="15" value={selectedTable.rotation || 0} onChange={(e) => handleUpdateTable(selectedTable.id, 'rotation', parseInt(e.target.value))} className="w-full accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                        <div className="flex justify-between text-xs text-gray-400 mt-1 font-mono">
                                            <span>0°</span>
                                            <span>90°</span>
                                            <span>180°</span>
                                            <span>270°</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="text-sm text-subInk mb-1 block font-semibold">Seats (ที่นั่ง)</label>
                                            <input type="number" min="1" value={selectedTable.capacity} onChange={(e) => handleUpdateTable(selectedTable.id, 'capacity', parseInt(e.target.value) || 1)} className="w-full p-3 bg-canvas border border-gray-200 rounded-xl focus:border-zinc-500 outline-none text-ink" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-sm text-subInk mb-1 block font-semibold">Shape (รูปร่าง)</label>
                                            <select value={selectedTable.shape} onChange={(e) => handleUpdateTable(selectedTable.id, 'shape', e.target.value)} className="w-full p-3 bg-canvas border border-gray-200 rounded-xl focus:border-zinc-500 outline-none text-ink appearance-none">
                                                <option value="rect">Rectangle</option>
                                                <option value="circle">Circle</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-gray-100">
                                        <label className="text-sm text-subInk mb-3 block font-semibold">Size (ขนาด %)</label>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-subInk w-8">Width</span>
                                                <input type="range" min="2" max="50" value={selectedTable.width} onChange={(e) => handleUpdateTable(selectedTable.id, 'width', parseInt(e.target.value))} className="flex-1 accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                                <span className="text-xs font-mono w-8 text-right">{selectedTable.width}%</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-subInk w-8">Height</span>
                                                <input type="range" min="2" max="50" value={selectedTable.height} onChange={(e) => handleUpdateTable(selectedTable.id, 'height', parseInt(e.target.value))} className="flex-1 accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                                <span className="text-xs font-mono w-8 text-right">{selectedTable.height}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-gray-100">
                                        <label className="text-sm text-subInk mb-3 block font-semibold">Real Table Image (รูปจริง)</label>
                                        <div className="flex flex-col gap-3">
                                            {selectedTable.image_url ? (
                                                <div className="relative group rounded-xl overflow-hidden aspect-video border border-gray-200">
                                                    <img src={selectedTable.image_url} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <label className="cursor-pointer bg-white text-black px-3 py-1.5 rounded-full text-xs font-bold shadow-md">
                                                            Change
                                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadTableImage(e.target.files[0])} />
                                                        </label>
                                                    </div>
                                                </div>
                                            ) : (
                                                <label className="cursor-pointer bg-canvas border border-dashed border-gray-200 hover:border-black rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all group">
                                                    <Upload size={20} className="text-gray-400 group-hover:text-black" />
                                                    <span className="text-xs text-gray-500 group-hover:text-black">Upload Photo</span>
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleUploadTableImage(e.target.files[0])} />
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-4 flex flex-col gap-3 mt-auto">
                                        <button 
                                            onClick={() => setQrModalOpen(true)} 
                                            className="w-full bg-black text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 hover:bg-zinc-800 shadow-md active:scale-95"
                                        >
                                            <QrCode size={18} /> QR Ordering Flyer
                                        </button>
                                        <button onClick={handleDuplicate} className="w-full bg-zinc-100 hover:bg-zinc-200 text-black py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-gray-200 active:scale-95">
                                            Copy / Duplicate
                                        </button>
                                        <button onClick={() => handleDeleteTable(selectedTable.id)} className="w-full bg-red-50 text-red-600 hover:bg-red-100 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95">
                                            <Trash2 size={20} /> Delete Table
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // --- Add New Mode ---
                            <div className="space-y-6 animate-fade-in">
                                <h2 className="text-xl font-bold mb-4 text-ink flex items-center gap-2"><Plus className="text-black" size={24} /> New Table</h2>
                                <p className="text-xs text-subInk -mt-4 mb-4">Create a new table element and drag it to position.</p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm text-subInk mb-1 block font-semibold">Name (ชื่อโต๊ะ)</label>
                                        <input type="text" placeholder="e.g. A1, VIP1" value={newTable.name} onChange={e => setNewTable({ ...newTable, name: e.target.value })} className="w-full p-3 bg-canvas border border-gray-200 rounded-xl focus:border-zinc-500 outline-none text-ink" />
                                    </div>

                                    <div>
                                        <label className="text-xs text-subInk mb-2 block font-semibold">Color (สีเริ่มต้น)</label>
                                        <div className="flex gap-2">
                                            {COLOR_PRESETS.slice(0, 5).map(c => (
                                                <button
                                                    key={c.name}
                                                    onClick={() => setNewTable({ ...newTable, color: c.value })}
                                                    className={`w-6 h-6 rounded-full border transition-all ${newTable.color === c.value ? 'border-zinc-400 scale-110 shadow-sm' : 'border-transparent opacity-60'}`}
                                                    style={{ backgroundColor: c.value }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="w-1/2">
                                            <label className="text-xs text-subInk mb-1 block font-semibold">Seats (คน)</label>
                                            <input type="number" min="1" placeholder="4" value={newTable.capacity} onChange={e => setNewTable({ ...newTable, capacity: parseInt(e.target.value) || 1 })} className="w-full p-3 bg-canvas border border-gray-200 rounded-xl focus:border-zinc-500 outline-none text-ink" />
                                        </div>
                                        <div className="w-1/2">
                                            <label className="text-xs text-subInk mb-1 block font-semibold">Shape</label>
                                            <select value={newTable.shape} onChange={e => setNewTable({ ...newTable, shape: e.target.value })} className="w-full p-3 bg-canvas border border-gray-200 rounded-xl focus:border-zinc-500 outline-none text-ink appearance-none">
                                                <option value="rect">Rect</option>
                                                <option value="circle">Circle</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-gray-100">
                                        <label className="text-sm text-subInk mb-3 block font-semibold">Initial Size (ขนาด %)</label>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-subInk w-8">W %</span>
                                                <input type="range" min="2" max="50" value={newTable.width} onChange={e => setNewTable({ ...newTable, width: parseInt(e.target.value) })} className="flex-1 accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                                <span className="text-xs font-mono w-8 text-right">{newTable.width}%</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-subInk w-8">H %</span>
                                                <input type="range" min="2" max="50" value={newTable.height} onChange={e => setNewTable({ ...newTable, height: parseInt(e.target.value) })} className="flex-1 accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                                <span className="text-xs font-mono w-8 text-right">{newTable.height}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button onClick={handleAddTable} className="w-full bg-black text-white py-4 rounded-xl font-bold transition-all mt-4 shadow-lg hover:bg-zinc-800 active:scale-95 flex items-center justify-center gap-2">
                                        <Plus size={20} /> Create Table
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* QR Code Flyer Modal */}
                {qrModalOpen && selectedTable && (
                    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setQrModalOpen(false)}>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center text-center gap-6" onClick={(e) => e.stopPropagation()}>
                            <div className="w-full flex justify-between items-center pb-2 border-b border-zinc-800">
                                <h3 className="font-bold text-sm text-zinc-400 tracking-wider">QR ORDERING TICKET</h3>
                                <button onClick={() => setQrModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">✕</button>
                            </div>

                            {/* Flyer Preview Card */}
                            <div className="bg-white text-black p-8 rounded-2xl border-4 border-double border-black flex flex-col items-center w-full max-w-[280px] shadow-lg">
                                <span className="font-black text-lg tracking-tight uppercase leading-none">IN THE HAUS</span>
                                <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest mt-1 block">Scan to Order / สแกนสั่งอาหาร</span>
                                
                                <span className="text-xs text-zinc-500 font-bold uppercase mt-6">Table</span>
                                <span className="text-5xl font-black leading-none block mb-4 mt-1">{selectedTable.table_name}</span>
                                
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '/table/' + selectedTable.id)}`} 
                                    alt="Table QR Code"
                                    className="w-40 h-40 object-contain mb-4 border border-zinc-100 p-1"
                                />

                                <div className="text-[8px] font-bold text-zinc-600 leading-normal max-w-[200px]">
                                    1. เปิดกล้องสแกน QR Code<br/>
                                    2. กดยืนยัน GPS เพื่อเช็คอินในร้าน<br/>
                                    3. เลือกเมนูและส่งเข้าห้องครัวได้ทันที
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex gap-3 w-full">
                                <button 
                                    onClick={() => {
                                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/table/' + selectedTable.id)}`;
                                        const printWindow = window.open('', '_blank', 'width=600,height=800');
                                        printWindow.document.write(`
                                            <html>
                                                <head>
                                                    <title>Table ${selectedTable.table_name} QR Code</title>
                                                    <style>
                                                        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;700&family=Inter:wght@700;900&display=swap');
                                                        body {
                                                            font-family: 'Inter', 'IBM Plex Sans Thai', sans-serif;
                                                            display: flex;
                                                            flex-direction: column;
                                                            align-items: center;
                                                            justify-content: center;
                                                            height: 100vh;
                                                            margin: 0;
                                                            text-align: center;
                                                            background: white;
                                                            color: black;
                                                        }
                                                        .container {
                                                            border: 8px double black;
                                                            padding: 40px;
                                                            width: 350px;
                                                            border-radius: 20px;
                                                            display: flex;
                                                            flex-direction: column;
                                                            align-items: center;
                                                        }
                                                        .logo {
                                                            font-size: 28px;
                                                            font-weight: 900;
                                                            letter-spacing: -1px;
                                                            margin-bottom: 5px;
                                                            text-transform: uppercase;
                                                        }
                                                        .tagline {
                                                            font-size: 10px;
                                                            text-transform: uppercase;
                                                            letter-spacing: 2px;
                                                            color: #666;
                                                            margin-bottom: 30px;
                                                            font-weight: bold;
                                                        }
                                                        .table-title {
                                                            font-size: 14px;
                                                            color: #555;
                                                            font-weight: bold;
                                                            text-transform: uppercase;
                                                            margin-bottom: 5px;
                                                        }
                                                        .table-name {
                                                            font-size: 72px;
                                                            font-weight: 900;
                                                            margin: 0 0 20px 0;
                                                            line-height: 1;
                                                        }
                                                        .qr-code {
                                                            width: 220px;
                                                            height: 220px;
                                                            margin-bottom: 30px;
                                                        }
                                                        .instructions {
                                                            font-size: 11px;
                                                            font-weight: bold;
                                                            line-height: 1.6;
                                                            color: #333;
                                                            max-width: 300px;
                                                        }
                                                    </style>
                                                </head>
                                                <body>
                                                    <div class="container">
                                                        <div class="logo">IN THE HAUS</div>
                                                        <div class="tagline">Scan to Order / สแกนเพื่อสั่งอาหาร</div>
                                                        <div class="table-title">Table</div>
                                                        <div class="table-name">${selectedTable.table_name}</div>
                                                        <img class="qr-code" src="${qrUrl}" alt="QR Code" />
                                                        <div class="instructions">
                                                            1. เปิดกล้องมือถือสแกนคิวอาร์โค้ด<br/>
                                                            2. ยืนยันพิกัด GPS เพื่อเริ่มการสั่งอาหาร<br/>
                                                            3. ออเดอร์ของคุณจะส่งไปยังพนักงานทันที
                                                        </div>
                                                    </div>
                                                    <script>
                                                        window.onload = function() { window.print(); }
                                                    </script>
                                                </body>
                                            </html>
                                        `);
                                        printWindow.document.close();
                                    }}
                                    className="flex-grow bg-white text-black py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-zinc-200 transition-colors"
                                >
                                    <Printer size={14} /> Print Flyer
                                </button>
                                <button 
                                    onClick={() => setQrModalOpen(false)}
                                    className="flex-grow bg-zinc-800 text-white py-3 rounded-xl font-bold text-xs hover:bg-zinc-700 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageTransition>
    );
}