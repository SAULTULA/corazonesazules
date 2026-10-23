/**
 * useTenantData — Hook genérico para CRUD aislado por tenant en Supabase.
 * 
 * Reemplaza el patrón localStorage de todas las vistas.
 * Cada tenant solo puede ver y modificar sus propios datos.
 * 
 * @param {string} tableName  - Nombre de la tabla en Supabase
 * @param {string} tenantId   - ID del tenant actual
 * @param {string} [orderBy]  - Campo para ordenar (default: 'created_at')
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useTenantData(tableName, tenantId, orderBy = 'created_at') {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!tenantId) { setData([]); setLoading(false); return; }
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from(tableName)
      .select('*')
      .eq('tenant_id', tenantId)
      .order(orderBy, { ascending: true });
    if (err) setError(err.message);
    else setData(rows || []);
    setLoading(false);
  }, [tableName, tenantId, orderBy]);

  useEffect(() => { fetch(); }, [fetch]);

  const insert = async (record) => {
    const { data: row, error: err } = await supabase
      .from(tableName)
      .insert({ ...record, tenant_id: tenantId })
      .select()
      .single();
    if (err) throw new Error(err.message);
    setData(prev => [...prev, row]);
    return row;
  };

  const update = async (id, changes) => {
    const { data: row, error: err } = await supabase
      .from(tableName)
      .update(changes)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (err) throw new Error(err.message);
    setData(prev => prev.map(r => r.id === id ? row : r));
    return row;
  };

  const remove = async (id) => {
    const { error: err } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (err) throw new Error(err.message);
    setData(prev => prev.filter(r => r.id !== id));
  };

  return { data, loading, error, refetch: fetch, insert, update, remove };
}
