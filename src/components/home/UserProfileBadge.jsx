import { Link } from 'react-router-dom'
import { User } from 'lucide-react'

export default function UserProfileBadge({ session, userRole, handleLogout, setShowAuthModal }) {
    if (session?.user) {
        return (
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md pl-4 pr-2 py-2 rounded-full shadow-sm border border-white/20 text-white">
                <span className="text-xs font-bold truncate max-w-[100px] text-white/90">{session.user.user_metadata.full_name || 'User'}</span>
                {userRole === 'admin' ? (
                    <Link to="/admin" className="bg-[#DFFF00] text-black px-3 py-1.5 rounded-full text-xs font-bold hover:scale-105 transition-transform shadow-lg">
                        Admin
                    </Link>
                ) : (
                    <span className="bg-white/20 text-white/70 px-3 py-1.5 rounded-full text-xs font-bold">
                        Member
                    </span>
                )}
                <button onClick={handleLogout} className="bg-white/20 text-white px-3 py-1.5 rounded-full text-xs font-bold hover:bg-white hover:text-black transition-colors">
                    L
                </button>
            </div>
        )
    }

    return (
        <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-white/20 hover:scale-105 transition-transform font-bold text-xs text-white">
            <User size={16} />
            Login / Register
        </button>
    )
}
