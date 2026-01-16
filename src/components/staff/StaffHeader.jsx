import { ChefHat, Package, UserCheck, Bell, Home, LogOut, ArrowLeft } from 'lucide-react'

export default function StaffHeader({ 
    title = "Live View", 
    isConnected = true, 
    notificationsEnabled = false, 
    onRequestNotifications,
    onLogout 
}) {
    // Determine active tab or generic
    const isOffline = !isConnected

    return (
        <div className={`flex flex-col gap-4 mb-6 sticky z-20 pt-2 bg-[#F4F4F4]/95 backdrop-blur-sm -mx-4 px-4 pb-4 border-b border-gray-200 ${isOffline ? 'top-8' : 'top-0'} transition-all`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => window.location.href = '/staff'}
                        className="w-10 h-10 bg-white border border-gray-200 text-gray-700 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-10 h-10 bg-[#1A1A1A] text-white rounded-full flex items-center justify-center shadow-md">
                        <ChefHat className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
                    </div>
                </div>
                 <div className="flex gap-2">
                    <button
                         onClick={() => window.location.href = '/staff/stock'}
                         className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-full transition-colors relative"
                         title="Stock Management"
                    >
                        <Package className="w-5 h-5" />
                    </button>
                    <a
                         href="https://inthehaus-hr.vercel.app/checkin"
                         target="_blank"
                         rel="noopener noreferrer"
                         className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-full transition-colors relative flex items-center justify-center"
                         title="HR Check-in"
                    >
                        <UserCheck className="w-5 h-5" />
                    </a>
                    {!notificationsEnabled && (
                        <button
                            onClick={onRequestNotifications}
                            className="p-2.5 bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-100 hover:text-blue-600 text-gray-600 rounded-full transition-colors relative"
                            title="Enable Notifications"
                        >
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                    )}
                    <button 
                         onClick={() => {
                                sessionStorage.setItem('skip_staff_redirect', 'true')
                                window.location.href = '/'
                         }}
                         className="p-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-full transition-colors"
                         title="Home"
                    >
                        <Home className="w-5 h-5" />
                    </button>
                    <button onClick={onLogout} className="p-2.5 bg-white border border-gray-200 hover:bg-red-50 hover:border-red-100 hover:text-red-600 text-gray-600 rounded-full transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                 </div>
            </div>
        </div>
    )
}
