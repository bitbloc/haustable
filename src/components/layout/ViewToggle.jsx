import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

export default function ViewToggle() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isStaff, setIsStaff] = useState(false);

    useEffect(() => {
        const checkRole = async () => {
            // fast check
            const role = localStorage.getItem('staff_role');
            if (role === 'admin') {
                setIsAdmin(true);
                return;
            }

            // robust check
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
                if (data?.role === 'admin') {
                    setIsAdmin(true);
                    localStorage.setItem('staff_role', 'admin');
                }
            }
        };
        checkRole();
    }, []);

    if (!isAdmin) return null;

    const isStaffPage = location.pathname.startsWith('/staff') || location.pathname.startsWith('/admin');

    return (
        <div className="flex bg-white rounded-full p-1 shadow-sm border border-gray-100 items-center">
            <button
                onClick={() => navigate('/')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                    !isStaffPage ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'
                }`}
            >
                haus
            </button>
            <button
                onClick={() => navigate('/staff')}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                    isStaffPage ? 'bg-black text-white shadow-md' : 'text-gray-500 hover:text-black'
                }`}
            >
                Admin
            </button>
        </div>
    );
}
