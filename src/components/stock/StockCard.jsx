/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · quiet card, accent only on what needs a look */
import React from 'react';
import { stockStatus, stockQtyParts, STOCK_STATUS_LABEL } from '../../utils/stockUtils';
import OpenPackMeter from './OpenPackMeter';

export default function StockCard({ item, onClick, onRecipe, searchActive = false, categories = [] }) {
    const status = stockStatus(item);
    const { main, unit, open, openPercent, total } = stockQtyParts(item);
    const categoryLabel = searchActive ? categories?.find(c => c.id === item.category)?.label : '';
    const par = Number(item.par_level) || 0;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onClick(item)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(item); } }}
            className={`sc-card sc-card--${status}`}
        >
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

            <div className="sc-image-wrap">
                {item.image_url
                    ? <img src={item.image_url} alt="" className="sc-image" loading="lazy" />
                    : <span className="sc-image-placeholder" aria-hidden="true">ไม่มีรูป</span>}
            </div>

            <h3 className="sc-title">{item.name}</h3>

            <div className="sc-qty">
                <span className="sc-qty__val">{main}</span>
                <span className="sc-qty__unit">{unit}</span>
                {total && <span className="sc-qty__total">· {total}</span>}
            </div>
            <p className="sc-open">
                {open ? <><OpenPackMeter percent={openPercent} /><span className="sc-open__text">{open}</span></> : ' '}
            </p>

            {par > 0 && (
                <div className="sc-par-bar" aria-hidden="true">
                    <div className="sc-par-fill" style={{ width: `${Math.min(((Number(item.current_quantity) || 0) / par) * 100, 100)}%` }} />
                </div>
            )}
        </div>
    );
}
