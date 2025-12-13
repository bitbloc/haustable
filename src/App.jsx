import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useLanguage } from './context/LanguageContext';
import { Globe } from 'lucide-react';
import { Users } from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import PageTransition from './components/PageTransition'
import BookingPage from './BookingPage'
import AdminDashboard from './AdminDashboard'
import PickupPage from './PickupPage'
import AdminSettings from './AdminSettings'
import AdminTableEditor from './AdminTableEditor'
import AdminMenu from './AdminMenu'
import AdminMembers from './AdminMembers' // NEW
import AdminLayout from './components/AdminLayout'

import Home from './Home'




// แยก Component ปุ่มเปลี่ยนภาษาออกมาเพื่อความสะอาด
const LanguageToggle = () => {
  const { lang, toggleLanguage } = useLanguage();
  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-white px-3 py-2 rounded-full shadow-sm hover:text-black transition-colors"
    >
      <Globe className="w-3 h-3" />
      <span>{lang.toUpperCase()}</span>
    </button>
  )
}
// Header Component (Dieter Rams Style)
const Header = ({ session }) => {
  const { lang, t } = useLanguage();

  return (
    <nav className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-gray-100 sticky top-0 z-40 flex justify-between items-center transition-all bg-[#FFFFFFCC]">
      <div>
        <Link to="/" className="font-bold text-lg tracking-tight text-black">{t('headline')}</Link>
        <span className="text-[10px] text-gray-400 uppercase tracking-widest ml-2 hidden sm:inline-block">by in the haus</span>
      </div>

      <div className="flex items-center gap-3">
        <LanguageToggle />

        {session ? (
          <div className="relative group">
            <div className="flex items-center gap-2 bg-white pl-3 pr-1 py-1 rounded-full shadow-sm border border-gray-100">
              <span className="text-xs font-bold text-gray-700 hidden sm:block max-w-[80px] truncate">
                {session.user.user_metadata.full_name?.split(' ')[0]}
              </span>
              <img
                src={session.user.user_metadata.avatar_url || 'https://placehold.co/100'}
                className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                alt="Profile"
              />
            </div>
            <div className="absolute right-0 top-12 w-32 bg-white rounded-2xl shadow-xl overflow-hidden hidden group-hover:block z-50 p-1 border border-gray-100">
              <button
                onClick={() => supabase.auth.signOut()}
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl font-bold"
              >
                {t('logout')}
              </button>
            </div>
          </div>
        ) : (
          <Link to="/" className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors">
            <Users size={18} className="text-gray-400" />
          </Link>
        )}
      </div>
    </nav>
  )
}

// Public Layout (Updated with Footer & Full Width)
const PublicLayout = ({ session }) => {
  return (
    <div className="flex flex-col min-h-screen bg-[#F4F4F4] font-sans text-[#111]">
      <Header session={session} />

      {/* Content */}
      <div className="flex-1">
        <Outlet />
      </div>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-gray-200 bg-[#FAFAFA] mt-auto">
        <div className="flex flex-col items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
          <p className="text-[10px] font-bold text-gray-900 uppercase tracking-[0.2em]">
            on haus table <span className="text-gray-400 font-normal">by in the haus</span>
          </p>
          <p className="text-[10px] text-gray-400 font-mono">
            Last updated: {new Date().toLocaleDateString('en-GB')}
          </p>
        </div>
      </footer>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const { t } = useLanguage();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <Router>
      <Routes>
        {/* Public Routes (with Mobile Layout) */}
        <Route element={<PublicLayout session={session} />}>
          <Route path="/" element={<Home session={session} />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/pickup" element={<PickupPage />} />
        </Route>

        {/* Admin Routes (with Full Screen Admin Layout) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="members" element={<AdminMembers />} />
          <Route path="menu" element={<AdminMenu />} />
          <Route path="editor" element={<AdminTableEditor />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App