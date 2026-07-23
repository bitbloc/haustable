import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import AuthModal from '../AuthModal';

export default function StaffAuthLayout() {
    const location = useLocation();
    const [authStatus, setAuthStatus] = useState('loading');
    const [userEmail, setUserEmail] = useState(null); 
    const [showLogin, setShowLogin] = useState(true);

    useEffect(() => {
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                checkUser();
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkUser = async () => {
        const cachedRole = localStorage.getItem('staff_role');
        const cachedId = localStorage.getItem('staff_id');
        
        let isOptimistic = false;
        if (cachedRole === 'admin' && cachedId) {
            setAuthStatus('authorized');
            isOptimistic = true;
        }

        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session) {
                if (isOptimistic) {
                     console.log("Session expired, reverting optimistic auth");
                }
                
                await supabase.auth.signOut();

                localStorage.removeItem('staff_role');
                localStorage.removeItem('staff_id');
                setAuthStatus('unauthenticated');
                return;
            }

            setUserEmail(session.user.email);

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

            localStorage.setItem('staff_role', 'admin');
            localStorage.setItem('staff_id', session.user.id);
            setAuthStatus('authorized');

        } catch (err) {
            console.error("Staff Auth Error:", err);
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
        return <Navigate to="/login" state={{ from: location }} replace />;
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
