import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantThemeProvider } from './contexts/TenantThemeContext';
import Login from './views/Login/Login';
import AdminPanel from './views/AdminPanel/AdminPanel';
import Dashboard from './views/Dashboard/Dashboard';
import Insumos from './views/Insumos/Insumos';
import Costos from './views/Costos/Costos';
import Recetas from './views/Recetas/Recetas';
import Rentabilidad from './views/Rentabilidad/Rentabilidad';
import './styles/global.css';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@panaderia.com';

function AppRouter() {
  const { user, tenant, loading, isSuperAdmin } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-primary)',
        fontSize: '1.5rem',
        fontFamily: 'var(--font-family)'
      }}>
        🍞 Cargando...
      </div>
    );
  }

  // No autenticado → Login
  if (!user) return <Login />;

  // Superadmin → Panel de gestión
  if (user.email === ADMIN_EMAIL) return <AdminPanel />;

  // Usuario sin tenant asignado
  if (!tenant) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        fontFamily: 'var(--font-family)',
        textAlign: 'center',
        gap: '1rem',
        padding: '2rem'
      }}>
        <div>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: 'var(--color-primary)', margin: '0 0 0.5rem' }}>
            Cuenta sin negocio asignado
          </h2>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>
            Contactá al administrador para vincular tu cuenta a un negocio.
          </p>
        </div>
      </div>
    );
  }

  // Usuario con tenant → App de panadería
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':    return <Dashboard setView={setCurrentView} />;
      case 'insumos':      return <Insumos setView={setCurrentView} />;
      case 'costos':       return <Costos setView={setCurrentView} />;
      case 'recetas':      return <Recetas setView={setCurrentView} />;
      case 'rentabilidad': return <Rentabilidad setView={setCurrentView} />;
      default:             return <Dashboard setView={setCurrentView} />;
    }
  };

  return (
    <div className="app-root">
      {renderView()}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <TenantThemeProvider>
        <AppRouter />
      </TenantThemeProvider>
    </AuthProvider>
  );
}

export default App;
