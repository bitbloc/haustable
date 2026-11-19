/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · quiet card, accent only on what needs a look */
import React from 'react';
import { stockStatus, stockQtyParts, STOCK_STATUS_LABEL } from '../../utils/stockUtils';
import OpenPackMeter from './OpenPackMeter';
import { optimizeImageUrl } from '../../utils/urlHelper';

export default function StockCard({ item, onClick, onRecipe, searchActive = false, categories = [] }) {
    const status = stockStatus(item);
    const { main, unit, open, openPercent, totalValue, totalUnit, single } = stockQtyParts(item);
    const categoryLabel = searchActive ? categories?.find(c => c.id === item.category)?.label : '';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onClick(item)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(item); } }}
            className={`sc-card sc-card--${status}`}
        >
            {/* The picture fills the top of the card; the recipe chip and the status sit on its corners */}
            <div className="sc-media">
                {item.image_url
                    ? <img src={optimizeImageUrl(item.image_url, 400, 75)} alt="" className="sc-image" loading="lazy" decoding="async" onError={e => { if (e.currentTarget.src !== item.image_url) e.currentTarget.src = item.image_url; }} />
                    : <span className="sc-image-placeholder" aria-hidden="true">ไม่มีรูป</span>}
                <div className="sc-top">
                    {categoryLabel ? (
                        <span className="sc-chip">{categoryLabel}</span>
                    ) : (
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onRecipe?.(item); }}
                            className={`sc-chip sc-chip--button ${item.is_base_recipe ? 'sc-chip--on' : ''}`}
                        >
                            สูตร
                        </button>
                    )}
                    {status !== 'ok' && <span className={`sc-status sc-status--${status}`}>{STOCK_STATUS_LABEL[status]}</span>}
                </div>
            </div>

            <div className="sc-name"><h3 className="sc-title">{item.name}</h3></div>

            {/* Two cells: how many on the shelf, and how much that is in the unit recipes use.
                Things used one by one (bottles of a crate) have one cell: the bottles, crates as the foot. */}
            <div className={`sc-cells${single ? ' sc-cells--single' : ''}`}>
                <div className="sc-cell">
                    <span className="sc-cell__n sc-qty__val">{main}</span>
                    <span className="sc-cell__unit">{unit}</span>
                </div>
                {!single && <div className="sc-cell">
                    {totalValue ? (
                        <>
                            <span className="sc-cell__n">{totalValue}</span>
                            <span className="sc-cell__unit">{totalUnit}</span>
                        </>
                    ) : (
                        <span className="sc-cell__none" aria-label="ยังไม่ได้ตั้งว่าแพ็คหนึ่งมีเท่าไร">–</span>
                    )}
                </div>}
            </div>

            {/* The opened pack: what is left in it, and one tube that drains */}
            <div className="sc-foot">
                {open && (
                    <>
                        <span className="sc-open__text">{open}</span>
                        {!single && <OpenPackMeter percent={openPercent} />}
                    </>
                )}
            </div>
        </div>
    );
}
