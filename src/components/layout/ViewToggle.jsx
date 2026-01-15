import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function ViewToggle({ session }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkRole = async () => {
            if (!session) return;

            // fast check
            const role = localStorage.getItem('staff_role');
            if (role === 'admin') {
                setIsAdmin(true);
                return;
            }

            // robust check
            const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
            if (data?.role === 'admin') {
                setIsAdmin(true);
                localStorage.setItem('staff_role', 'admin');
            }
        };
        checkRole();
    }, [session]);

    if (!isAdmin) return null;

    const isStaffPage = location.pathname.startsWith('/staff') || location.pathname.startsWith('/admin');
    const name = session?.user?.user_metadata?.full_name?.split(' ')[0] || 'User';

    return (
        <div className="flex bg-white rounded-full p-1 shadow-sm border border-gray-100 items-center">
            <button
                onClick={() => navigate('/')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-2 ${
                    !isStaffPage ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'
                }`}
            >
                {name}
            </button>
            <button
                onClick={() => navigate('/staff')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                    isStaffPage ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'
                }`}
            >
                Staff App
            </button>
        </div>
    );
}
