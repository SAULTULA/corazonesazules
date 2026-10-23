import React, { useState } from 'react';
import Header from '../../components/Header/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantData } from '../../hooks/useTenantData';
import styles from './Insumos.module.css';

function Insumos({ setView }) {
  const { tenant } = useAuth();
  const { data: insumos, loading, insert, remove } = useTenantData('insumos', tenant?.id);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', unit: 'kg', price: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) return;
    setSaving(true);
    try {
      await insert({
        name: formData.name,
        unit: formData.unit,
        price: parseFloat(formData.price),
      });
      setFormData({ name: '', unit: 'kg', price: '' });
      setShowForm(false);
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteInsumo = async (id) => {
    if (!window.confirm('¿Eliminar este insumo?')) return;
    try {
      await remove(id);
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  return (
    <div className={styles.insumos}>
      <Header
        title="Gestión de Insumos"
        onBack={() => setView('dashboard')}
      />

      <div className={styles.insumos__topActions}>
        <button
          className={styles.insumos__addButton}
          onClick={() => setShowForm(true)}
        >
          + Nuevo Insumo
        </button>
      </div>

      <main className={styles.insumos__content}>
        {showForm && (
          <div className={styles.insumos__modal}>
            <form className={styles.insumos__form} onSubmit={handleSubmit}>
              <h2 className={styles.insumos__formTitle}>Añadir Insumo</h2>
              <div className={styles.insumos__formGroup}>
                <label>Nombre del Insumo</label>
                <input
                  type="text"
                  placeholder="Ej: Harina 000"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className={styles.insumos__formRow}>
                <div className={styles.insumos__formGroup}>
                  <label>Unidad de Compra</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  >
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="gr">Gramos (gr)</option>
                    <option value="lt">Litros (lt)</option>
                    <option value="un">Unidades (un)</option>
                  </select>
                </div>
                <div className={styles.insumos__formGroup}>
                  <label>Precio por Unidad ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className={styles.insumos__formActions}>
                <button
                  type="button"
                  className={styles.insumos__cancelBtn}
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.insumos__submitBtn}
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Guardar Insumo'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.insumos__tableWrapper}>
          <table className={styles.insumos__table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Unidad</th>
                <th>Precio</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className={styles.insumos__empty}>Cargando insumos...</td>
                </tr>
              ) : insumos.length === 0 ? (
                <tr>
                  <td colSpan="4" className={styles.insumos__empty}>No hay insumos registrados.</td>
                </tr>
              ) : (
                insumos.map(item => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.unit}</td>
                    <td>${item.price.toLocaleString('es-AR')}</td>
                    <td>
                      <button
                        className={styles.insumos__deleteBtn}
                        onClick={() => deleteInsumo(item.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default Insumos;
