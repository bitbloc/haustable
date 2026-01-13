import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient'; // Adjusted path
import AuthModal from '../AuthModal'; // Reuse existing AuthModal for login
// Ensure path to AuthModal is correct: '../AuthModal' from 'src/components/layout/' -> '../../components/AuthModal' if in layout dir.
// Wait, AuthModal is in src/components/AuthModal.jsx
// StaffAuthLayout will be in src/components/layout/StaffAuthLayout.jsx
// So path is ../../components/AuthModal

export default function StaffAuthLayout() {
    const [authStatus, setAuthStatus] = useState('loading'); // loading, unauthenticated, unauthorized, authorized
    const [userEmail, setUserEmail] = useState(null); 
    const [showLogin, setShowLogin] = useState(true); // Default to show login if not auth

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        // Optimistic Check
        const cachedRole = localStorage.getItem('staff_role');
        const cachedId = localStorage.getItem('staff_id');
        
        let isOptimistic = false;
        if (cachedRole === 'admin' && cachedId) {
            setAuthStatus('authorized');
            isOptimistic = true;
        }

        try {
            // Background / Real Check
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session) {
                if (isOptimistic) {
                     // Session expired but we showed authorized. Revert.
                     console.log("Session expired, reverting optimistic auth");
                }
                
                // Explicitly clear Supabase auth state to prevent stale tokens/WebSocket issues
                await supabase.auth.signOut();

                localStorage.removeItem('staff_role');
                localStorage.removeItem('staff_id');
                setAuthStatus('unauthenticated');
                return;
            }

            setUserEmail(session.user.email); // Store email for display

            // Verify Role
            // Optimization: If optimistic was true and session.id matches cachedId, 
            // we could skip profile fetch if we trust cache ttl? 
            // consistently verifying is safer, but let's do it.
            
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profileError || !profile || profile.role !== 'admin') {
                localStorage.removeItem('staff_role');
                localStorage.removeItem('staff_id');
                setAuthStatus('unauthorized');
                return;
            }

            // Success (Update Cache)
            localStorage.setItem('staff_role', 'admin');
            localStorage.setItem('staff_id', session.user.id);
            setAuthStatus('authorized');

        } catch (err) {
            console.error("Staff Auth Error:", err);
            // If network error, and we were optimistic, we stay authorized (Offline Mode support)
            // But if we weren't optimistic, we fail.
            if (!isOptimistic) setAuthStatus('unauthenticated');
        }
    };

    if (authStatus === 'loading') {
        return (
            <div className="min-h-screen bg-[#F4F4F4] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-[#1A1A1A] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 font-bold animate-pulse">Checking Access...</p>
                </div>
            </div>
        );
    }

    if (authStatus === 'unauthenticated') {
        // Show Login UI directly instead of redirecting?
        // User requested "Add login page". 
        // We can just show the AuthModal (which is full screen) or a nice Login Page.
        // Let's render a simple page wrapper around AuthModal logic or just trigger it.
        // Since AuthModal is a modal, we need a background.
        return (
            <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
                 <div className="text-center">
                     <h1 className="text-2xl font-bold text-white mb-4">Staff Access Required</h1>
                     <p className="text-gray-400 mb-8">Please log in with an Admin account.</p>
                     
                     {/* We can mount AuthModal here but force it open */}
                     <AuthModal 
                        isOpen={true} 
                        onClose={() => {}} // Disallow close?
                     />
                     {/* The AuthModal has a "Close" X button. If user clicks it, it closes and they stare at black screen.
                         Ideally AuthModal should be non-closable or handle close -> redirect home.
                         Let's modify AuthModal usage or just trust user won't close, or if they close we show a "Login Recquired" button.
                     */}
                 </div>
            </div>
        );
    }

    if (authStatus === 'unauthorized') {
        return (
            <div className="min-h-screen bg-red-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md bg-white p-8 rounded-3xl shadow-xl">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
                    </div>
                    <h1 className="text-xl font-bold text-[#1A1A1A] mb-2">Access Denied</h1>
                    <p className="text-gray-500 mb-6">
                        บัญชีของคุณ ({userEmail || 'User'}) ไม่มีสิทธิ์เข้าใช้งานส่วนนี้ <br/>
                        กรุณาติดต่อเจ้าของร้านเพื่อขอสิทธิ์ <strong>Admin</strong>
                    </p>
                    <button 
                        onClick={async () => {
                            await supabase.auth.signOut();
                            window.location.reload();
                        }}
                        className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                    >
                        Sign Out / Switch Account
                    </button>
                </div>
            </div>
        );
    }

    // Authorized
    return <Outlet />;
}
