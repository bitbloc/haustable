import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import PublicLayout from './components/layout/PublicLayout'
import AdminLayout from './components/AdminLayout'

// Pages
import Home from './Home'
import BookingPage from './BookingPage'
import PickupPage from './PickupPage'
import AdminDashboard from './AdminDashboard'
import AdminSettings from './AdminSettings'
import AdminTableEditor from './AdminTableEditor'
import AdminMenu from './admin/AdminMenuPage'
import AdminBookings from './AdminBookings'
import AdminMembers from './AdminMembers'

function App() {
  const [session, setSession] = useState(null)

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
        {/* Public Routes */}
        <Route element={<PublicLayout session={session} />}>
          <Route path="/" element={<Home session={session} />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/pickup" element={<PickupPage />} />
        </Route>

        {/* Admin Routes */}
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