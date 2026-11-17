import React from 'react'

export default function BookingHeader({ title, subtitle }) {
    return (
        <div className="mb-6">
            {/* SOV_monomon has one weight: never bold */}
            <h1 className="text-3xl font-display text-ink leading-normal">{title}</h1>
            <p className="text-[var(--color-muted)] text-sm leading-normal">{subtitle}</p>
        </div>
    )
}
