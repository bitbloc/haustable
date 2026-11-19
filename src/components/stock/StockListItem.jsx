/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · quiet row, accent only on what needs a look */
import React from 'react';
import { stockStatus, stockQtyParts, STOCK_STATUS_LABEL } from '../../utils/stockUtils';
import OpenPackMeter from './OpenPackMeter';
import { optimizeImageUrl } from '../../utils/urlHelper';

export default function StockListItem({ item, onClick, onRecipe, searchActive = false, categories = [] }) {
    const status = stockStatus(item);
    const { main, unit, open, openPercent, total, single } = stockQtyParts(item);
    const categoryLabel = searchActive ? categories?.find(c => c.id === item.category)?.label : '';

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onClick(item)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(item); } }}
            className={`sli-item sli-item--${status}`}
        >
            <div className="sli-image-wrap">
                {item.image_url
                    ? <img src={optimizeImageUrl(item.image_url, 120, 75)} alt="" className="sli-image" loading="lazy" decoding="async" onError={e => { if (e.currentTarget.src !== item.image_url) e.currentTarget.src = item.image_url; }} />
                    : <span className="sli-image-placeholder" aria-hidden="true">ไม่มีรูป</span>}
            </div>

            <div className="sli-info">
                <h3 className="sli-title">{item.name}</h3>
                <div className="sli-meta">
                    {categoryLabel && <span>{categoryLabel}</span>}
                    {item.is_base_recipe && (
                        <button type="button" className="sli-recipe" onClick={e => { e.stopPropagation(); onRecipe?.(item); }}>
                            สูตร
                        </button>
                    )}
                    {open && !single && <span className="sc-open sc-open--inline"><OpenPackMeter percent={openPercent} /><span className="sc-open__text">{open}</span></span>}
                </div>
            </div>

            <div className="sli-right">
                <span className="sli-qty"><span className="sli-qty__val">{main}</span> {unit}{total && <span className="sc-qty__total"> · {total}</span>}</span>
                {status !== 'ok' && <span className={`sc-status sc-status--${status}`}>{STOCK_STATUS_LABEL[status]}</span>}
            </div>
        </div>
    );
}
