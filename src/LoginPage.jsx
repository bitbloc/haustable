import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthModal from './components/AuthModal';
import { supabase } from './lib/supabaseClient';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Listen for Auth Changes (Login Success)
    useEffect(() => {
        // check current session first
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                const from = location.state?.from?.pathname || '/staff';
                navigate(from, { replace: true });
            }
        });

        // Listen for future changes (e.g. login completes)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
             if (event === 'SIGNED_IN' && session) {
                 const from = location.state?.from?.pathname || '/staff';
                 navigate(from, { replace: true });
             }
        });

        return () => subscription.unsubscribe();
    }, [navigate, location]);

    return (
        <div className="min-h-screen bg-[#1A1A1A] relative overflow-hidden flex items-center justify-center">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-blue-500/20 rounded-full blur-[120px] mix-blend-screen animate-blob" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] bg-purple-500/20 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-2000" />
            </div>

            <div className="z-10 w-full max-w-md">
                 {/* 
                   We force AuthModal to be open. 
                   We pass a dummy onClose that redirects to home or does nothing, 
                   because staying on this page without modal means blank screen.
                 */}
                 <AuthModal 
                    isOpen={true} 
                    onClose={() => navigate('/')} 
                 />
            </div>
        </div>
    );
}
