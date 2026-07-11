import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core' // Added Capacitor import
import { supabase } from './lib/supabaseClient'
import PublicLayout from './components/layout/PublicLayout'
import AdminLayout from './components/AdminLayout'
import StaffAuthLayout from './components/layout/StaffAuthLayout'
// import { ToastProvider } from './context/ToastContext' -> Removed
import { BookingProvider } from './context/BookingContext'
import { Toaster } from 'sonner' // Added

// Pages
import Home from './Home'
import QnAPage from './QnAPage'
import BookingPage from './BookingPage'
import PickupPage from './PickupPage'
import AdsLandingPage from './AdsLandingPage' // NEW
import AdminDashboard from './AdminDashboard'
import AdminSettings from './AdminSettings'
import AdminTableEditor from './AdminTableEditor'
import AdminMenu from './admin/AdminMenuPage'
import AdminBookings from './AdminBookings'
import AdminMembers from './AdminMembers'
import AdminPromotions from './components/admin/AdminPromotions' // NEW
import AdminTableManager from './admin/AdminTableManager' // NEW

import LoginPage from './LoginPage' // NEW
import StaffDashboard from './StaffDashboard'
import StaffLiveOrders from './StaffLiveOrders' // Was StaffOrderPage
import StockPage from './StockPage' // NEW
import MenuCostPage from './components/admin/MenuCostPage' // NEW
import RecipeLabPage from './components/admin/RecipeLabPage' // NEW
import SOPEditorPage from './components/admin/SOPEditorPage' // NEW: SOP
import TrackingPage from './TrackingPage'
import BarSOPPage from './components/sop/BarSOPPage' // NEW: SOP
import POSDashboard from './pos/POSDashboard'
import CustomerOrderLanding from './pos/CustomerOrderLanding'
import CustomerOrderStatus from './pos/CustomerOrderStatus'
import SongRequestPage from './pages/SongRequestPage'
import AdminSongRequests from './pages/AdminSongRequests'
import HausCheckinPage from './pages/HausCheckinPage'
import RequireAuthLayout from './components/layout/RequireAuthLayout'
import { Suspense, lazy } from 'react'

const ArcadeLobby = lazy(() => import('./pages/arcade/ArcadeLobby'))
const ArcadeClaim = lazy(() => import('./pages/arcade/ArcadeClaim'))

function BookingProviderLayout() {
  return (
    <BookingProvider>
      <Outlet />
    </BookingProvider>
  )
}


function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Prepare for Native App: Redirect to /pos if running in Capacitor
    if (Capacitor.isNativePlatform()) {
        const path = window.location.pathname
        if (path === '/' || path === '') {
            // Check if we can use history, but outside router we just set hash or pathname depending on router type.
            // Since we use BrowserRouter, direct manipulation works if server/file supports it. 
            // Capacitor serves from localhost, so pathname works.
            window.location.replace('/pos') 
        }
    }

    const handleAuthChange = async (event, session) => {
        setSession(session)

        if (event === 'SIGNED_IN' && session?.user) {
            // Check for LINE Provider
            const identities = session.user.identities || []
            const lineIdentity = identities.find(id => id.provider === 'line')
            
            // If log in via LINE, we want to ensure profile exists and has the line_user_id
            if (lineIdentity) {
                const lineUserId = lineIdentity.id // This is the Provider User ID (Uxxxxxxxx...)
                const { error } = await supabase.from('profiles').upsert({
                    id: session.user.id,
                    line_user_id: lineUserId,
                    // We only update these if they are null, or just upsert blindly? 
                    // Let's rely on standard profile creation, but ensure LINE ID is patched.
                    // Actually, if it's a new user, 'profiles' might be empty.
                    // For simplicity, we just patch the line_user_id.
                }, { onConflict: 'id' }) // This requires the row to exist? No, Upsert creates if not.
                
                // Note: If profile doesn't exist (because trigger didn't run or we do client side creation),
                // we should probably fetch first.
                // But simplified: Just update the line_user_id if mapped.
               
                // Actually, let's do a smarter upsert that preserves existing data but sets ID
                const { data: existing } = await supabase.from('profiles').select('id').eq('id', session.user.id).single()
                
                if (existing) {
                     await supabase.from('profiles').update({ line_user_id: lineUserId }).eq('id', session.user.id)
                } else {
                    // Create new profile with basic info from metadata
                    const metadata = session.user.user_metadata
                    await supabase.from('profiles').insert({
                        id: session.user.id,
                        display_name: metadata.full_name || metadata.name || 'LINE User',
                        line_user_id: lineUserId,
                        role: 'customer'
                    })
                }
            }
        }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthChange)

    return () => subscription.unsubscribe()
  }, [])

  return (
    <div className="app-container">
      <Toaster position="top-center" richColors closeButton />
      <Router>
        <Routes>
          {/* Standalone Pages (No Booking Context for fast loading) */}
          <Route path="/link" element={<AdsLandingPage />} />
          <Route path="/link/hauscheckin" element={<HausCheckinPage />} />
          <Route path="/qa" element={<QnAPage />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />

          <Route path="/arcade" element={
            <Suspense fallback={<div className="min-h-screen bg-[#0a0018] flex items-center justify-center text-purple-400 font-mono text-xs uppercase tracking-widest">LOADING PLAYGROUND...</div>}>
              <ArcadeLobby />
            </Suspense>
          } />
          <Route path="/arcade/claim" element={
            <Suspense fallback={<div className="min-h-screen bg-[#0a0018] flex items-center justify-center text-purple-400 font-mono text-xs uppercase tracking-widest">LOADING CLAIM PORTAL...</div>}>
              <ArcadeClaim />
            </Suspense>
          } />

          {/* Routes requiring Booking Context */}
          <Route element={<BookingProviderLayout />}>
            {/* Home Page */}
            <Route path="/" element={<Home session={session} />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/staff/login" element={<LoginPage />} />

            {/* Song Request (Login Required) */}
            <Route element={<RequireAuthLayout />}>
              <Route path="/songs" element={<SongRequestPage />} />
              <Route path="/song" element={<SongRequestPage />} />
            </Route>

            {/* Public Routes (Standard Layout) */}
            <Route element={<PublicLayout session={session} />}>
              <Route path="/booking" element={<BookingPage />} />
              <Route path="/pickup" element={<PickupPage />} />
              <Route path="/tracking/:token" element={<TrackingPage />} />
              <Route path="/t/:token" element={<TrackingPage />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="members" element={<AdminMembers />} />
              <Route path="menu" element={<AdminMenu />} />
              <Route path="costing" element={<MenuCostPage />} />
              <Route path="lab" element={<RecipeLabPage />} />
              <Route path="promotions" element={<AdminPromotions />} />
              <Route path="tables" element={<AdminTableManager />} />
              <Route path="editor" element={<AdminTableEditor />} />
              <Route path="sop" element={<SOPEditorPage />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="songs" element={<AdminSongRequests />} />
            </Route>

            {/* Customer Table Ordering */}
            <Route path="/table/:tableId" element={<CustomerOrderLanding />} />
            <Route path="/table/:tableId/status" element={<CustomerOrderStatus />} />
            
            {/* Staff/Kitchen Route (Protected) */}
            <Route element={<StaffAuthLayout />}>
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/staff/orders" element={<StaffLiveOrders />} />
              <Route path="/staff/history" element={<StaffLiveOrders />} />
              <Route path="/staff/checkin" element={<StaffLiveOrders />} />
              <Route path="/staff/stock" element={<StockPage />} />
              <Route path="/staff/sop" element={<BarSOPPage />} />
            </Route>

            {/* POS Dashboard */}
            <Route path="/pos" element={<POSDashboard />} />
          </Route>

        </Routes>
      </Router>
    </div>
  )
}

export default App