import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

/**
 * RequireAuthLayout — Route guard that requires LINE login.
 * If user is not logged in, redirects to /login?redirect=<current_path>
 * Once logged in, LoginPage handles redirect back.
 */
export default function RequireAuthLayout() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Loading state
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#06C755] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  // Not logged in — redirect to login with return path
  if (!session) {
    const redirectPath = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectPath}`} replace />;
  }

  // Authenticated — render child routes
  return <Outlet />;
}
