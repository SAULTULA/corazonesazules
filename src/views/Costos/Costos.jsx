import React, { useState, useEffect } from 'react';
import Header from '../../components/Header/Header';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import styles from './Costos.module.css';

function Costos({ setView }) {
  const { tenant } = useAuth();
  const [config, setConfig] = useState({ kwhPrice: 0, ovenPower: 0 });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    supabase
      .from('costos_config')
      .select('*')
      .eq('tenant_id', tenant.id)
      .single()
      .then(({ data }) => {
        if (data) setConfig({ kwhPrice: data.kwh_price, ovenPower: data.oven_power });
        setLoaded(true);
      });
  }, [tenant?.id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await supabase
        .from('costos_config')
        .upsert({
          tenant_id: tenant.id,
          kwh_price: config.kwhPrice,
          oven_power: config.ovenPower,
        }, { onConflict: 'tenant_id' });
      alert('Configuración de energía guardada ✅');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig({ ...config, [name]: parseFloat(value) || 0 });
  };

  return (
    <div className={styles.costos}>
      <Header title="Costos de Energía" onBack={() => setView('dashboard')} />

      <main className={styles.costos__content}>
        <form className={styles.costos__form} onSubmit={handleSave}>
          <section className={styles.costos__section}>
            <h2 className={styles.costos__sectionTitle}>⚡ Energía (Horno)</h2>
            <div className={styles.costos__group}>
              <label>Precio por kWh ($)</label>
              <input
                type="number"
                name="kwhPrice"
                step="0.01"
                value={config.kwhPrice}
                onChange={handleChange}
                placeholder="Ej: 45.50"
              />
              <small>Consultá tu factura de luz para este valor.</small>
            </div>
            <div className={styles.costos__group}>
              <label>Potencia del Horno (Watts)</label>
              <input
                type="number"
                name="ovenPower"
                step="1"
                value={config.ovenPower}
                onChange={handleChange}
                placeholder="Ej: 2000"
              />
              <small>Suele figurar en la etiqueta técnica del horno.</small>
            </div>
          </section>

          <div className={styles.costos__actions}>
            <button
              type="submit"
              className={styles.costos__saveButton}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar Configuración de Energía'}
            </button>
          </div>
        </form>

        <div className={styles.costos__preview}>
          <h2 className={styles.costos__previewTitle}>Resumen de Gasto</h2>
          <div className={styles.costos__card}>
            <p>
              <strong>Costo de Horno por hora:</strong>{' '}
              ${((config.ovenPower / 1000) * (config.kwhPrice || 0)).toFixed(2)}
            </p>
            <hr className={styles.costos__divider} />
            <p className={styles.costos__total}>
              Gasto Eléctrico Total (1h):{' '}
              <span>${((config.ovenPower / 1000) * (config.kwhPrice || 0)).toFixed(2)}</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Costos;
