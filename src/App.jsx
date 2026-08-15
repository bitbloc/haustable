import { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { supabase } from './lib/supabaseClient'
import PublicLayout from './components/layout/PublicLayout'
import AdminLayout from './components/AdminLayout'
import StaffAuthLayout from './components/layout/StaffAuthLayout'
import { BookingProvider } from './context/BookingContext'
import { Toaster } from 'sonner'

// Eagerly load instant startup pages for POS & Login
import POSDashboard from './pos/POSDashboard'
import LoginPage from './LoginPage'
import Home from './Home'
import RequireAuthLayout from './components/layout/RequireAuthLayout'

// Lazy load non-critical and heavy sub-pages for maximum launch speed
const QnAPage = lazy(() => import('./QnAPage'))
const BookingPage = lazy(() => import('./BookingPage'))
const PickupPage = lazy(() => import('./PickupPage'))
const AdsLandingPage = lazy(() => import('./AdsLandingPage'))
const AdminDashboard = lazy(() => import('./AdminDashboard'))
const AdminFinancialDashboard = lazy(() => import('./components/admin/AdminFinancialDashboard'))
const AdminSettings = lazy(() => import('./AdminSettings'))
const AdminTableEditor = lazy(() => import('./AdminTableEditor'))
const AdminMenu = lazy(() => import('./admin/AdminMenuPage'))
const AdminBookings = lazy(() => import('./AdminBookings'))
const AdminMembers = lazy(() => import('./AdminMembers'))
const AdminPromotions = lazy(() => import('./components/admin/AdminPromotions'))
const AdminTableManager = lazy(() => import('./admin/AdminTableManager'))
const AdminArcade = lazy(() => import('./components/admin/AdminArcade'))
const AdminMarketingPage = lazy(() => import('./pages/admin/AdminMarketingPage'))

const MemberCard = lazy(() => import('./pages/MemberCard'))
const StaffDashboard = lazy(() => import('./StaffDashboard'))
const StaffLiveOrders = lazy(() => import('./StaffLiveOrders'))
const StockPage = lazy(() => import('./StockPage'))
const MenuCostPage = lazy(() => import('./components/admin/MenuCostPage'))
const RecipeLabPage = lazy(() => import('./components/admin/RecipeLabPage'))
const SOPEditorPage = lazy(() => import('./components/admin/SOPEditorPage'))
const TrackingPage = lazy(() => import('./TrackingPage'))
const BarSOPPage = lazy(() => import('./components/sop/BarSOPPage'))
const CustomerOrderLanding = lazy(() => import('./pos/CustomerOrderLanding'))
const CustomerOrderStatus = lazy(() => import('./pos/CustomerOrderStatus'))
const SongRequestPage = lazy(() => import('./pages/SongRequestPage'))
const AdminSongRequests = lazy(() => import('./pages/AdminSongRequests'))
const HausCheckinPage = lazy(() => import('./pages/HausCheckinPage'))
const POSCustomerDisplay = lazy(() => import('./pos/POSCustomerDisplay'))
const ArcadeLobby = lazy(() => import('./pages/arcade/ArcadeLobby'))
const ArcadeClaim = lazy(() => import('./pages/arcade/ArcadeClaim'))
const HausmadeShopPage = lazy(() => import('./pages/HausmadeShopPage'))
const HausmadeAdminPage = lazy(() => import('./pages/admin/HausmadeAdminPage'))

const FallbackLoader = () => (
  <div className="min-h-screen bg-[#ECECE9] flex flex-col items-center justify-center text-[#181815] font-mono text-xs uppercase tracking-widest gap-3 select-none">
    <div className="w-6 h-6 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
    <span>LOADING MODULE...</span>
  </div>
)

function BookingProviderLayout() {
  const navigate = useNavigate()

  useEffect(() => {
    const redirectTo = localStorage.getItem('redirectAfterLogin')
    if (redirectTo) {
      localStorage.removeItem('redirectAfterLogin')
      console.log("Found redirect path after login. Sending user to:", redirectTo)
      navigate(redirectTo, { replace: true })
    }
  }, [navigate])

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

    const handleAuthChange = async (event, session) => {
        setSession(session)

        if (event === 'SIGNED_IN' && session?.user) {
            const identities = session.user.identities || []
            const lineIdentity = identities.find(id => id.provider === 'line')
            
            if (lineIdentity) {
                const lineUserId = lineIdentity.id
                const { data: existing } = await supabase.from('profiles').select('id').eq('id', session.user.id).single()
                
                if (existing) {
                     await supabase.from('profiles').update({ line_user_id: lineUserId }).eq('id', session.user.id)
                } else {
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
      <Toaster position="top-center" maxToasts={3} visibleToasts={3} closeButton />
      <Router>
        <Suspense fallback={<FallbackLoader />}>
          <Routes>
            {/* Standalone Pages (Fast Eager / Dynamic Routes) */}
            <Route path="/link" element={<AdsLandingPage />} />
            <Route path="/link/hauscheckin" element={<HausCheckinPage />} />
            <Route path="/qa" element={<QnAPage />} />
            <Route path="/pos/cfd" element={<POSCustomerDisplay />} />
            <Route path="/pos" element={<POSDashboard />} />
            <Route path="/index.html" element={Capacitor.isNativePlatform() ? <Navigate to="/pos" replace /> : <Navigate to="/" replace />} />

            <Route path="/arcade" element={<ArcadeLobby />} />
            <Route path="/arcade/claim" element={<ArcadeClaim />} />

            {/* Routes requiring Booking Context */}
            <Route element={<BookingProviderLayout />}>
              {/* Home & Auth */}
              <Route path="/" element={Capacitor.isNativePlatform() ? <Navigate to="/pos" replace /> : <Home session={session} />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/staff/login" element={<LoginPage />} />

              {/* Song Request (Login Required) */}
              <Route element={<RequireAuthLayout />}>
                <Route path="/songs" element={<SongRequestPage />} />
                <Route path="/song" element={<SongRequestPage />} />
              </Route>

              {/* Public Routes */}
              <Route element={<PublicLayout session={session} />}>
                <Route path="/booking" element={<BookingPage />} />
                <Route path="/pickup" element={<PickupPage />} />
                <Route path="/hausmade" element={<HausmadeShopPage />} />
                <Route path="/shop" element={<HausmadeShopPage />} />
                <Route path="/tracking/:token" element={<TrackingPage />} />
                <Route path="/t/:token" element={<TrackingPage />} />
              </Route>

              {/* Admin Routes - Streamlined 7 Core Hubs */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="financial" element={<AdminFinancialDashboard />} />
                <Route path="bookings" element={<AdminBookings />} />
                <Route path="tables" element={<AdminTableManager defaultTab="live" />} />
                <Route path="editor" element={<AdminTableManager defaultTab="editor" />} />
                <Route path="menu" element={<AdminMenu defaultTab="items" />} />
                <Route path="costing" element={<AdminMenu defaultTab="costing" />} />
                <Route path="lab" element={<AdminMenu defaultTab="lab" />} />
                <Route path="sop" element={<AdminMenu defaultTab="sop" />} />
                <Route path="marketing" element={<AdminMarketingPage defaultTab="members" />} />
                <Route path="members" element={<AdminMarketingPage defaultTab="members" />} />
                <Route path="promotions" element={<AdminMarketingPage defaultTab="promotions" />} />
                <Route path="rewards" element={<AdminMarketingPage defaultTab="rewards" />} />
                <Route path="arcade" element={<AdminMarketingPage defaultTab="arcade" />} />
                <Route path="songs" element={<AdminMarketingPage defaultTab="songs" />} />
                <Route path="hausmade" element={<HausmadeAdminPage />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              {/* Customer Table Ordering */}
              <Route path="/table/:tableId" element={<CustomerOrderLanding />} />
              <Route path="/table/:tableId/status" element={<CustomerOrderStatus />} />
              <Route path="/member-card" element={<MemberCard />} />
              
              {/* Staff/Kitchen Route */}
              <Route element={<StaffAuthLayout />}>
                <Route path="/staff" element={<StaffDashboard />} />
                <Route path="/staff/orders" element={<StaffLiveOrders />} />
                <Route path="/staff/history" element={<StaffLiveOrders />} />
                <Route path="/staff/checkin" element={<StaffLiveOrders />} />
                <Route path="/staff/stock" element={<StockPage />} />
                <Route path="/staff/sop" element={<BarSOPPage />} />
              </Route>
            </Route>

          </Routes>
        </Suspense>
      </Router>
    </div>
  )
}

export default App