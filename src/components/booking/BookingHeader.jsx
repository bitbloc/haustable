import React from 'react'

export default function BookingHeader({ title, subtitle }) {
    return (
        <div className="mb-6">
            <h1 className="text-3xl font-bold text-black tracking-tight">{title}</h1>
            <p className="text-gray-500 text-sm uppercase tracking-widest">{subtitle}</p>
        </div>
    )
}
