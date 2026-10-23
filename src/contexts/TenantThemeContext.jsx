import React, { createContext, useContext, useEffect } from 'react';
import { generatePalette } from '../lib/colorExtractor';
import { useAuth } from './AuthContext';

const TenantThemeContext = createContext(null);

export function TenantThemeProvider({ children }) {
  const { tenant } = useAuth();

  useEffect(() => {
    const root = document.documentElement;

    if (tenant?.primary_color) {
      const palette = generatePalette(tenant.primary_color);
      Object.entries(palette).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    } else {
      // Restaurar defaults
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-primary-hover');
      root.style.removeProperty('--color-primary-light');
      root.style.removeProperty('--color-primary-dark');
      root.style.removeProperty('--color-accent');
    }
  }, [tenant]);

  return (
    <TenantThemeContext.Provider value={tenant}>
      {children}
    </TenantThemeContext.Provider>
  );
}

export const useTenantTheme = () => useContext(TenantThemeContext);
