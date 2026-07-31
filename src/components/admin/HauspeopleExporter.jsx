import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { X, Download, Loader2, Ratio, Shuffle, Upload } from 'lucide-react';
import { getThaiDate } from '../../utils/timeUtils';

export default function HauspeopleExporter({ checkins, onClose }) {
    const exportRef = useRef(null);
    const [exporting, setExporting] = useState(false);
    const [ratio, setRatio] = useState('4:5'); // '1:1' or '4:5'
    const [styleMode, setStyleMode] = useState('swiss'); // 'swiss' | 'brutalist'
    const [logoScale, setLogoScale] = useState(1.0);
    const [items, setItems] = useState(checkins.slice(0, 6));
    const [customLogo, setCustomLogo] = useState(null);

    const isPortrait = ratio === '4:5';
    const canvasWidth = 1080;
    const canvasHeight = isPortrait ? 1350 : 1080;

    const handleExport = async () => {
        if (!exportRef.current) return;
        setExporting(true);
        
        try {
            await new Promise(r => setTimeout(r, 500));

            const dataUrl = await toPng(exportRef.current, {
                quality: 1.0,
                pixelRatio: 2, 
                cacheBust: true,
                style: {
                    transform: 'scale(1)',
                    transformOrigin: 'top left',
                    width: `${canvasWidth}px`,
                    height: `${canvasHeight}px`,
                }
            });

            const link = document.createElement('a');
            link.download = `hauspeople-${getThaiDate()}.png`;
            link.href = dataUrl;
            link.click();
            
        } catch (error) {
            console.error('Failed to export image', error);
            alert('Failed to export image: ' + error.message);
        } finally {
            setExporting(false);
        }
    };

    const getExportImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('/') || url.startsWith('data:')) return url;
        return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&output=webp&q=85`;
    };

    const handleShuffle = () => {
        setItems(prev => [...prev].sort(() => Math.random() - 0.5));
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => setCustomLogo(event.target.result);
            reader.readAsDataURL(file);
        }
    };

    const renderBrutalistGrid = () => {
        if (items.length === 6) {
            return (
                <div className="grid grid-cols-3 grid-rows-2 w-full flex-1 border-b-[4px] border-[#23201D]">
                    {items.map((item, i) => (
                        <div key={item.id || i} className="relative border-r-[4px] border-b-[4px] border-[#23201D] [&:nth-child(3n)]:border-r-0 [&:nth-child(n+4)]:border-b-0 w-full h-full overflow-hidden bg-[#F4F1EA]">
                            <img src={getExportImageUrl(item.image_url)} alt="Hausperson" crossOrigin="anonymous" className="w-full h-full object-cover grayscale-[15%] contrast-125" />
                        </div>
                    ))}
                </div>
            );
        } else if (items.length === 5) {
            return (
                <div className="grid grid-cols-6 grid-rows-2 w-full flex-1 border-b-[4px] border-[#23201D]">
                    {items.map((item, i) => {
                        let colSpan = i < 2 ? 'col-span-3' : 'col-span-2';
                        let isRightEdge = i === 1 || i === 4;
                        let isBottomEdge = i >= 2;
                        return (
                            <div key={item.id || i} className={`${colSpan} relative ${!isRightEdge ? 'border-r-[4px]' : ''} ${!isBottomEdge ? 'border-b-[4px]' : ''} border-[#23201D] w-full h-full overflow-hidden bg-[#F4F1EA]`}>
                                <img src={getExportImageUrl(item.image_url)} alt="Hausperson" crossOrigin="anonymous" className="w-full h-full object-cover grayscale-[15%] contrast-125" />
                            </div>
                        );
                    })}
                </div>
            );
        } else {
            return (
                <div className="grid grid-cols-2 grid-rows-2 w-full flex-1 border-b-[4px] border-[#23201D]">
                    {items.map((item, i) => (
                        <div key={item.id || i} className={`relative border-r-[4px] border-b-[4px] border-[#23201D] ${(i+1)%2===0 ? 'border-r-0' : ''} ${i>=2 ? 'border-b-0' : ''} w-full h-full overflow-hidden bg-[#F4F1EA]`}>
                            <img src={getExportImageUrl(item.image_url)} alt="Hausperson" crossOrigin="anonymous" className="w-full h-full object-cover grayscale-[15%] contrast-125" />
                        </div>
                    ))}
                </div>
            );
        }
    };
    
    // Absolute layout coordinates for Swiss minimalist style
    const LAYOUT_4_5 = [
        { top: '120px', left: '720px', width: '260px', height: '340px' }, // 01: Top Right
        { top: '350px', left: '100px', width: '320px', height: '320px' }, // 02: Mid-Top Left
        { top: '480px', left: '550px', width: '240px', height: '280px' }, // 03: Center Right
        { top: '740px', left: '320px', width: '280px', height: '340px' }, // 04: Center
        { top: '1020px', left: '100px', width: '220px', height: '220px' },// 05: Bottom Left
        { top: '940px', left: '680px', width: '300px', height: '240px' }, // 06: Bottom Right
    ];

    const LAYOUT_1_1 = [
        { top: '80px', left: '750px', width: '220px', height: '280px' },  // 01
        { top: '250px', left: '80px', width: '280px', height: '280px' },   // 02
        { top: '380px', left: '460px', width: '200px', height: '200px' },  // 03
        { top: '620px', left: '260px', width: '280px', height: '280px' },  // 04
        { top: '820px', left: '80px', width: '180px', height: '180px' },   // 05
        { top: '750px', left: '650px', width: '280px', height: '200px' },  // 06
    ];

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#FBF9F5] font-sans">
            {/* Toolbar */}
            <div className="h-16 border-b border-[#E2DDD3] flex items-center justify-between px-6 bg-white shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-lg text-[#23201D]">Collage Exporter</h2>
                    
                    <div className="flex bg-gray-100 rounded-lg p-1 ml-2">
                        <button 
                            onClick={() => setStyleMode('swiss')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${styleMode === 'swiss' ? 'bg-white shadow-sm text-[#23201D]' : 'text-gray-500 hover:text-[#23201D]'}`}
                        >
                            Swiss Mag
                        </button>
                        <button 
                            onClick={() => setStyleMode('brutalist')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${styleMode === 'brutalist' ? 'bg-white shadow-sm text-[#23201D]' : 'text-gray-500 hover:text-[#23201D]'}`}
                        >
                            Brutalist Grid
                        </button>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Logo Size</span>
                        <input 
                            type="range" 
                            min="0.5" max="2" step="0.1" 
                            value={logoScale} 
                            onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                            className="w-20 accent-[#23201D]"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 rounded-lg p-1 mr-2">
                        <button 
                            onClick={() => setRatio('1:1')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${ratio === '1:1' ? 'bg-white shadow-sm text-[#23201D]' : 'text-gray-500 hover:text-[#23201D] cursor-pointer'}`}
                        >
                            1:1 (Square)
                        </button>
                        <button 
                            onClick={() => setRatio('4:5')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${ratio === '4:5' ? 'bg-white shadow-sm text-[#23201D]' : 'text-gray-500 hover:text-[#23201D] cursor-pointer'}`}
                        >
                            4:5 (Portrait)
                        </button>
                    </div>

                    <button 
                        onClick={handleShuffle}
                        className="flex items-center gap-1.5 bg-gray-100 text-[#23201D] px-4 py-2 font-sans font-bold uppercase tracking-wider text-sm hover:bg-gray-200 transition-colors rounded-lg cursor-pointer mr-2"
                    >
                        <Shuffle size={14} /> Shuffle
                    </button>

                    <button 
                        onClick={handleExport}
                        disabled={exporting || items.length === 0}
                        className="flex items-center gap-2 bg-[#23201D] text-white px-6 py-2 font-sans font-bold uppercase tracking-wider text-sm hover:bg-black transition-colors rounded-lg cursor-pointer disabled:opacity-50"
                    >
                        {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        Export PNG
                    </button>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Canvas Preview Area */}
            <div className="flex-1 overflow-auto bg-[#ECECE9] p-8 flex justify-center items-start">
                <div style={{ transform: 'scale(0.55)', transformOrigin: 'top center', marginBottom: '100px' }} className="shadow-2xl">
                    
                    {/* THE EXPORT NODE */}
                    {styleMode === 'swiss' ? (
                        <div 
                            ref={exportRef} 
                            id="hauspeople-collage"
                            className="relative overflow-hidden font-sans"
                            style={{ 
                                width: `${canvasWidth}px`, 
                                height: `${canvasHeight}px`,
                                backgroundColor: '#F4F1EA',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E")`
                            }}
                        >
                            {/* Huge Title & Logo (Swiss Grotesk Style) */}
                            <div className="absolute top-[70px] left-[80px] flex flex-col items-start gap-4 z-10">
                                <label className="cursor-pointer group relative block" title="คลิกเพื่ออัปโหลดโลโก้ใหม่ (PNG)">
                                    <div style={{ transform: `scale(${logoScale})`, transformOrigin: 'top left' }} className="transition-transform">
                                        <img src={customLogo || "/receipt-logo.png"} alt="IN THE HAUS" className="h-10 object-contain mix-blend-multiply opacity-90" crossOrigin={customLogo ? undefined : "anonymous"} />
                                    </div>
                                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                                        <Upload size={16} className="text-[#1A1A1A]" />
                                    </div>
                                    <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handleLogoUpload} />
                                </label>
                                <div className="text-[42px] font-mono font-bold tracking-tighter text-[#1A1A1A] leading-[1]">
                                    people in<br/>the haus.
                                </div>
                            </div>
                            
                            <div className="absolute top-[85px] left-[480px] text-2xl font-medium tracking-tight text-[#1A1A1A]">
                                {new Date().getFullYear()}
                            </div>

                            {/* Render Images in Absolute Positions */}
                            {items.map((item, i) => {
                                const config = isPortrait ? LAYOUT_4_5[i] : LAYOUT_1_1[i];
                                if (!config) return null;
                                
                                return (
                                    <div key={item.id || i} className="absolute flex" style={{ top: config.top, left: config.left }}>
                                        <span className="absolute -left-12 top-0 font-sans text-2xl font-medium tracking-tighter text-[#1A1A1A]">
                                            0{i+1}
                                        </span>
                                        <div 
                                            className="overflow-hidden bg-gray-200"
                                            style={{ width: config.width, height: config.height }}
                                        >
                                            <img 
                                                src={getExportImageUrl(item.image_url)} 
                                                crossOrigin="anonymous" 
                                                className="w-full h-full object-cover grayscale-[15%] contrast-110 sepia-[5%]" 
                                                alt={`Img ${i+1}`}
                                            />
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Bottom Footer Text */}
                            <div className="absolute bottom-[70px] w-full px-[80px] flex justify-between font-sans text-sm font-bold tracking-widest uppercase text-[#1A1A1A] opacity-80 z-10">
                                <span contentEditable suppressContentEditableWarning className="outline-none border-b border-transparent focus:border-gray-400 hover:border-gray-300 transition-colors cursor-text">NOTICING DETAILS</span>
                                <span contentEditable suppressContentEditableWarning className="outline-none border-b border-transparent focus:border-gray-400 hover:border-gray-300 transition-colors cursor-text">CAPTURING MOMENTS</span>
                                <span contentEditable suppressContentEditableWarning className="outline-none border-b border-transparent focus:border-gray-400 hover:border-gray-300 transition-colors cursor-text">IN THE HAUS</span>
                            </div>
                        </div>
                    ) : (
                        <div 
                            ref={exportRef} 
                            id="hauspeople-collage"
                            className="bg-[#FBF9F5] border-[4px] border-[#23201D] flex flex-col relative font-sans"
                            style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
                        >
                            {/* HEADER (h: 120px) */}
                            <div className="h-[120px] border-b-[4px] border-[#23201D] flex w-full bg-[#E9F344] shrink-0">
                                <div className="w-[300px] border-r-[4px] border-[#23201D] flex items-center justify-center bg-white relative">
                                    <label className="cursor-pointer group relative block" title="คลิกเพื่ออัปโหลดโลโก้ใหม่ (PNG)">
                                        <div style={{ transform: `scale(${logoScale})`, transformOrigin: 'center' }} className="transition-transform">
                                            <img src={customLogo || "/receipt-logo.png"} alt="IN THE HAUS" className="h-10 object-contain mix-blend-multiply opacity-90" crossOrigin={customLogo ? undefined : "anonymous"} />
                                        </div>
                                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                                            <Upload size={16} className="text-[#1A1A1A]" />
                                        </div>
                                        <input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handleLogoUpload} />
                                    </label>
                                </div>
                                <div className="flex-1 flex flex-col justify-center px-10">
                                    <h1 className="font-mono text-[42px] leading-none font-black tracking-tighter text-[#23201D] uppercase">
                                        HAUSPEOPLE OF THE WEEK
                                    </h1>
                                    <p className="font-mono text-xl font-bold tracking-widest text-[#23201D] uppercase mt-2">
                                        VOL. {getThaiDate().replace(/-/g, '.')}
                                    </p>
                                </div>
                            </div>

                            {/* PHOTO GRID */}
                            {renderBrutalistGrid()}

                            {/* FOOTER (h: 60px) */}
                            <div className="h-[60px] flex items-center justify-between px-8 bg-[#23201D] text-white shrink-0">
                                <span contentEditable suppressContentEditableWarning className="font-mono text-sm font-bold tracking-widest uppercase outline-none focus:border-b border-gray-400">
                                    © {new Date().getFullYear()} IN THE HAUS, NAKHON PHANOM
                                </span>
                                <span contentEditable suppressContentEditableWarning className="font-mono text-sm font-bold tracking-widest uppercase text-[#E9F344] outline-none focus:border-b border-gray-400">
                                    @INTHEHAUS
                                </span>
                            </div>
                        </div>
                    )}
                    {/* END NODE */}
                </div>
            </div>
        </div>
    );
}
