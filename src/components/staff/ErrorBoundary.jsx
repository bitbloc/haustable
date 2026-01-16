import React from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

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

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F9F9] p-6 text-center">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-sm w-full">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">Something went wrong</h2>
            <p className="text-gray-500 text-sm mb-6">
              ระบบเกิดข้อขัดข้องชั่วคราว<br/>
              (Application encountered an error)
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#1A1A1A] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-black transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>
            {this.state.error && (
                <div className="mt-4 p-2 bg-gray-50 rounded text-[10px] text-gray-400 font-mono text-left overflow-auto max-h-20">
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
