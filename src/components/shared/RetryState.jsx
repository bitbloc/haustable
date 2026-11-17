// Shown when a customer page could not load what it needs. Thai first, one clear action.
// Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5
export default function RetryState({
    title = 'โหลดข้อมูลไม่สำเร็จ',
    message = 'กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง',
    onRetry,
    retrying = false
}) {
    return (
        <div role="alert" className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-12 text-center text-ink">
            <div className="w-full max-w-sm border border-[var(--color-rule)] bg-paper rounded-rams p-6 flex flex-col gap-4">
                <h2 className="text-xl font-display leading-normal">{title}</h2>
                <p className="text-base text-subInk leading-relaxed">{message}</p>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        disabled={retrying}
                        className="min-h-12 w-full bg-ink text-paper rounded-none font-bold text-base disabled:opacity-60"
                    >
                        {retrying ? 'กำลังลองใหม่...' : 'ลองใหม่'}
                    </button>
                )}
                <p className="text-sm text-subInk leading-relaxed">
                    หรือโทรจอง/สั่งอาหาร{' '}
                    <a href="tel:0985284217" className="font-mono font-bold underline text-ink">098-528-4217</a>
                </p>
            </div>
        </div>
    )
}
