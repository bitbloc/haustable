import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  handleReload = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
    } catch (_) {}
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-paper,#ECECE9)] p-6 text-center select-none font-sans">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-[var(--color-rule,#DCDCD9)] max-w-sm w-full">
            <div className="inline-flex items-center px-2.5 py-1 rounded border border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-mono font-semibold uppercase tracking-wider mb-4">
              Module Sync Notice
            </div>
            <h2 className="text-lg font-bold text-[var(--color-ink,#181815)] mb-2 uppercase tracking-wide">
              ตรวจพบการอัปเดตระบบ
            </h2>
            <p className="text-[var(--color-neutral,#555552)] text-xs mb-6 leading-relaxed">
              มีการอัปเดตเวอร์ชันใหม่ กรุณากดปุ่มด้านล่างเพื่อซิงค์ข้อมูลและโหลดหน้าเว็บล่าสุด
            </p>
            <button
              onClick={this.handleReload}
              className="w-full bg-[var(--color-ink,#181815)] text-white text-xs font-mono font-bold uppercase tracking-widest py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all"
            >
              รีโหลดและอัปเดต (RELOAD APP)
            </button>
            {this.state.error && (
              <div className="mt-4 p-2.5 bg-[#F4F4F2] border border-[var(--color-rule,#DCDCD9)] rounded-lg text-[10px] text-[var(--color-muted,#777774)] font-mono text-left overflow-auto max-h-24 break-all">
                {this.state.error.toString()}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

