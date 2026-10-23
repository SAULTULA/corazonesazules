import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) loadTenant(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadTenant(session.user.id);
      else { setTenant(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadTenant = async (userId) => {
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle();
    setTenant(data ?? null);
    setLoading(false);
  };

  const refreshTenant = async () => {
    if (user) await loadTenant(user.id);
  };

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signOut = () => supabase.auth.signOut();

  const isSuperAdmin = user?.email === import.meta.env.VITE_ADMIN_EMAIL;

  return (
    <AuthContext.Provider value={{ user, tenant, loading, signIn, signOut, isSuperAdmin, refreshTenant }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
