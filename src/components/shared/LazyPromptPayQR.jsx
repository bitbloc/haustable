import { Suspense, lazy } from 'react'

const PromptPayQR = lazy(() => import('./PromptPayQR'))

// Same box size while the QR chunk loads, so the payment card does not jump
export default function LazyPromptPayQR(props) {
    const size = props.size || 176
    return (
        <Suspense fallback={<div style={{ width: size, height: size }} className="flex items-center justify-center text-subInk text-sm">กำลังโหลด QR...</div>}>
            <PromptPayQR {...props} />
        </Suspense>
    )
}
