/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · app style: achromatic ledger (shared with the staff home) */
import { useNavigate } from 'react-router-dom';
import useBarSOP from '../../hooks/useBarSOP';
import SOPRecipeCard from './SOPRecipeCard';
import '../../StaffDashboard.css';

/**
 * BarSOPPage — the bar's recipes for staff, read on a phone or a small tablet during service.
 * The screen's question: how do I make this drink? Search is always open; categories are one row.
 */
export default function BarSOPPage() {
    const navigate = useNavigate();

    const {
        recipes,
        categories,
        glassSizes,
        loading,
        activeCategory,
        setActiveCategory,
        searchQuery,
        setSearchQuery,
        scaleIngredients,
        refresh
    } = useBarSOP({ department: 'bar', staffMode: true });

    const query = searchQuery.trim();

    return (
        <div className="staff-dash">
            <header className="sd-top">
                <div className="sd-top__bar">
                    <div className="sd-wrap sd-top__row">
                        <div className="sd-brand">
                            <button type="button" className="sd-quiet sd-top__back" onClick={() => navigate('/staff')}>กลับ</button>
                            <h1 className="sd-top__title">สูตรบาร์</h1>
                        </div>
                        <button type="button" className="sd-quiet sd-top__end" onClick={refresh} disabled={loading}>
                            {loading ? 'กำลังโหลด' : 'รีเฟรช'}
                        </button>
                    </div>
                </div>
                <div className="sd-wrap sd-tools">
                    <label className="sd-search">
                        <span className="sd-search__label">ค้นหาเมนู</span>
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="ชื่อเมนู เช่น ลาเต้"
                            autoComplete="off"
                        />
                    </label>
                    <div className="sd-tabs" role="tablist" aria-label="หมวดสูตร">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeCategory === null}
                            className={`sd-tab ${activeCategory === null ? 'is-active' : ''}`}
                            onClick={() => setActiveCategory(null)}
                        >
                            ทั้งหมด
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                role="tab"
                                aria-selected={activeCategory === cat.id}
                                className={`sd-tab ${activeCategory === cat.id ? 'is-active' : ''}`}
                                onClick={() => setActiveCategory(cat.id)}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="sd-wrap sd-main">
                {loading ? (
                    <div className="sd-recipes" aria-hidden="true">
                        {[0, 1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="sd-recipe-skeleton">
                                <span className="sd-bar sd-bar--line" />
                                <span className="sd-bar sd-bar--sub" />
                            </div>
                        ))}
                    </div>
                ) : recipes.length === 0 ? (
                    <p className="sd-note sd-note--block">
                        {query
                            ? `ไม่พบเมนูที่ตรงกับ "${query}"`
                            : 'ยังไม่มีสูตรในหมวดนี้ เพิ่มได้ที่ Backoffice › Menu & Lab'}
                        {query && (
                            <>
                                {' '}
                                <button type="button" className="sd-link" onClick={() => setSearchQuery('')}>ล้างคำค้น</button>
                            </>
                        )}
                    </p>
                ) : (
                    <>
                        <p className="sd-count">
                            {recipes.length.toLocaleString('th-TH')} สูตร{query ? ` ที่ตรงกับ "${query}"` : ''}
                        </p>
                        <div className="sd-recipes">
                            {recipes.map(recipe => (
                                <SOPRecipeCard
                                    key={recipe.id}
                                    recipe={recipe}
                                    glassSizes={glassSizes}
                                    scaleIngredients={scaleIngredients}
                                    darkMode={false}
                                />
                            ))}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
