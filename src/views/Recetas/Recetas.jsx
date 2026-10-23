import React, { useState, useEffect } from 'react';
import Header from '../../components/Header/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantData } from '../../hooks/useTenantData';
import { supabase } from '../../lib/supabase';
import styles from './Recetas.module.css';

function Recetas({ setView }) {
  const { tenant } = useAuth();
  const { data: recipes, loading: loadingRecipes, insert: insertRecipe, update: updateRecipe, remove: removeRecipe } = useTenantData('recipes', tenant?.id);
  const { data: insumos } = useTenantData('insumos', tenant?.id);
  const [config, setConfig] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [newRecipe, setNewRecipe] = useState({
    name: '',
    ingredients: [],
    oven_time: 0,
    yield_units: 1
  });

  useEffect(() => {
    if (!tenant?.id) return;
    supabase
      .from('costos_config')
      .select('*')
      .eq('tenant_id', tenant.id)
      .single()
      .then(({ data }) => { if (data) setConfig({ kwhPrice: data.kwh_price, ovenPower: data.oven_power }); });
  }, [tenant?.id]);

  // ── Cálculo de costos ──────────────────────────────────────────

  const getIngredientData = (ing) => {
    const insumo = insumos.find(i => i.id === ing.insumoId || i.id === parseInt(ing.insumoId));
    if (!insumo) return { cost: 0, weightGr: 0 };

    let qtyForCalc = ing.quantity;
    let weightGr = 0;

    if ((insumo.unit === 'kg' && ing.unit === 'gr') || (insumo.unit === 'lt' && ing.unit === 'ml')) {
      qtyForCalc = ing.quantity / 1000;
    } else if ((insumo.unit === 'gr' && ing.unit === 'kg') || (insumo.unit === 'ml' && ing.unit === 'lt')) {
      qtyForCalc = ing.quantity * 1000;
    }
    const cost = insumo.price * qtyForCalc;

    if (ing.unit === 'gr' || ing.unit === 'ml') weightGr = ing.quantity;
    else if (ing.unit === 'kg' || ing.unit === 'lt') weightGr = ing.quantity * 1000;
    else if (ing.unit === 'un') weightGr = ing.quantity * 60;

    return { cost, weightGr };
  };

  const calculateRecipeCosts = (recipe) => {
    if (!config) return { ingredients: 0, operating: 0, total: 0, unitCost: 0, totalWeight: 0, weightPerUnit: 0, costPerKg: 0 };

    let totalWeightGr = 0;
    let totalIngredientsCost = 0;

    (recipe.ingredients || []).forEach(ing => {
      const { cost, weightGr } = getIngredientData(ing);
      totalIngredientsCost += cost;
      totalWeightGr += weightGr;
    });

    const ovenCost = (config.ovenPower / 1000) * (config.kwhPrice || 0) * ((recipe.oven_time || 0) / 60);
    const totalCost = totalIngredientsCost + ovenCost;
    const yieldUnits = recipe.yield_units || 1;

    return {
      ingredients: totalIngredientsCost,
      operating: ovenCost,
      total: totalCost,
      unitCost: totalCost / yieldUnits,
      totalWeight: totalWeightGr,
      weightPerUnit: totalWeightGr / yieldUnits,
      costPerKg: totalWeightGr > 0 ? (totalCost / (totalWeightGr / 1000)) : 0
    };
  };

  // ── Form handlers ──────────────────────────────────────────────

  const handleAddIngredient = () => {
    setNewRecipe({
      ...newRecipe,
      ingredients: [...newRecipe.ingredients, { insumoId: '', quantity: 0, unit: '' }]
    });
  };

  const handleRemoveIngredient = (index) => {
    setNewRecipe({
      ...newRecipe,
      ingredients: newRecipe.ingredients.filter((_, i) => i !== index)
    });
  };

  const handleIngredientChange = (index, field, value) => {
    const updated = [...newRecipe.ingredients];
    if (field === 'insumoId') {
      const insumo = insumos.find(i => i.id === value || i.id === parseInt(value));
      updated[index].unit = insumo ? insumo.unit : '';
    }
    updated[index][field] = value;
    setNewRecipe({ ...newRecipe, ingredients: updated });
  };

  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const costs = calculateRecipeCosts(newRecipe);
      const payload = {
        name: newRecipe.name,
        ingredients: newRecipe.ingredients,
        oven_time: newRecipe.oven_time,
        yield_units: newRecipe.yield_units,
        costs,
      };

      if (editingId) {
        await updateRecipe(editingId, payload);
      } else {
        await insertRecipe(payload);
      }
      handleCloseForm();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (recipe) => {
    setNewRecipe({
      name: recipe.name || '',
      ingredients: recipe.ingredients || [],
      oven_time: recipe.oven_time || 0,
      yield_units: recipe.yield_units || 1,
    });
    setEditingId(recipe.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta receta?')) return;
    try { await removeRecipe(id); } catch (err) { alert(err.message); }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setNewRecipe({ name: '', ingredients: [], oven_time: 0, yield_units: 1 });
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className={styles.recetas}>
      <Header title="Gestión de Recetas" onBack={() => setView('dashboard')} />
      <div className={styles.recetas__topActions}>
        <button className={styles.recetas__addButton} onClick={() => setShowForm(true)}>+ Nueva Receta</button>
      </div>
      <main className={styles.recetas__content}>
        {showForm && (
          <div className={styles.recetas__modal}>
            <form className={styles.recetas__form} onSubmit={handleSaveRecipe}>
              <h2 className={styles.recetas__formTitle}>{editingId ? 'Editar Receta' : 'Crear Nueva Receta'}</h2>
              <div className={styles.recetas__formGroup}>
                <label>Nombre de la Receta</label>
                <input
                  type="text"
                  value={newRecipe.name}
                  onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                  required
                />
              </div>
              <div className={styles.recetas__section}>
                <div className={styles.recetas__sectionHeader}>
                  <h3>Ingredientes</h3>
                  <div className={styles.recetas__headerLabels}>
                    <span>Cant.</span>
                    <span>Unid.</span>
                    <span>Costo</span>
                    <span>Peso</span>
                  </div>
                </div>
                {newRecipe.ingredients.map((ing, index) => {
                  const currentInsumo = insumos.find(i => i.id === ing.insumoId || i.id === parseInt(ing.insumoId));
                  const { cost, weightGr } = getIngredientData(ing);
                  return (
                    <div key={index} className={styles.recetas__ingredientRow}>
                      <select
                        value={ing.insumoId}
                        onChange={(e) => handleIngredientChange(index, 'insumoId', e.target.value)}
                        required
                      >
                        <option value="">Seleccionar Insumo...</option>
                        {insumos.map(i => (
                          <option key={i.id} value={i.id}>{i.name} (${i.price}/{i.unit})</option>
                        ))}
                      </select>
                      <div className={styles.recetas__inputWithAction}>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="Cant."
                          value={ing.quantity}
                          onChange={(e) => handleIngredientChange(index, 'quantity', parseFloat(e.target.value))}
                          required
                        />
                        <select
                          value={ing.unit}
                          onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                          className={styles.recetas__unitSelector}
                        >
                          {currentInsumo?.unit === 'kg' && <><option value="gr">gr</option><option value="kg">kg</option></>}
                          {currentInsumo?.unit === 'lt' && <><option value="ml">ml</option><option value="lt">lt</option></>}
                          {currentInsumo?.unit === 'un' && <option value="un">un</option>}
                          {currentInsumo?.unit === 'gr' && <option value="gr">gr</option>}
                          {!currentInsumo && <option value="">-</option>}
                        </select>
                        <span className={styles.recetas__lineCost}>${cost.toFixed(2)}</span>
                        <span className={styles.recetas__lineWeight}>{(weightGr / 1000).toFixed(2)}kg</span>
                        <button
                          type="button"
                          className={styles.recetas__removeIngBtn}
                          onClick={() => handleRemoveIngredient(index)}
                        >×</button>
                      </div>
                    </div>
                  );
                })}
                <button type="button" onClick={handleAddIngredient} className={styles.recetas__smallBtn}>+ Añadir Ingrediente</button>
              </div>
              <div className={styles.recetas__row}>
                <div className={styles.recetas__formGroup}>
                  <label>Tiempo Horno (min)</label>
                  <input
                    type="number"
                    step="1"
                    value={newRecipe.oven_time}
                    onChange={(e) => setNewRecipe({ ...newRecipe, oven_time: parseFloat(e.target.value) })}
                  />
                </div>
                <div className={styles.recetas__formGroup}>
                  <label>Rendimiento (unidades)</label>
                  <input
                    type="number"
                    value={newRecipe.yield_units}
                    onChange={(e) => setNewRecipe({ ...newRecipe, yield_units: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className={styles.recetas__formActions}>
                <button type="button" className={styles.recetas__cancelBtn} onClick={handleCloseForm}>Cancelar</button>
                <button type="submit" className={styles.recetas__submitBtn} disabled={saving}>
                  {saving ? 'Guardando...' : editingId ? 'Actualizar Receta' : 'Guardar Receta'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={styles.recetas__list}>
          {loadingRecipes ? (
            <div className={styles.recetas__empty}>Cargando recetas...</div>
          ) : recipes.length === 0 ? (
            <div className={styles.recetas__empty}>No hay recetas creadas aún.</div>
          ) : (
            recipes.map(recipe => (
              <div key={recipe.id} className={styles.recetas__card}>
                <div className={styles.recetas__cardHeader}>
                  <h3 className={styles.recetas__cardTitle}>{recipe.name}</h3>
                  <div className={styles.recetas__cardActions}>
                    <button className={styles.recetas__editBtn} onClick={() => handleEdit(recipe)}>✏️</button>
                    <button className={styles.recetas__deleteBtn} onClick={() => handleDelete(recipe.id)}>🗑️</button>
                  </div>
                </div>
                <div className={styles.recetas__cardDetails}>
                  <div className={styles.recetas__costBreakdown}>
                    <p>Insumos: <span>${(recipe.costs?.ingredients || 0).toFixed(2)}</span></p>
                    <p>Energía: <span>${(recipe.costs?.operating || 0).toFixed(2)}</span></p>
                    <p>Peso Total Lote: <span>{((recipe.costs?.totalWeight || 0) / 1000).toFixed(2)} kg</span></p>
                  </div>
                  <p className={styles.recetas__totalLabel}>Costo Total Lote: <span>${(recipe.costs?.total || 0).toFixed(2)}</span></p>
                  <p>Costo por Unidad: <span className={styles.recetas__unitPrice}>${(recipe.costs?.unitCost || 0).toFixed(2)}</span></p>
                  <hr />
                  <p>Peso por Unidad: <span>{(recipe.costs?.weightPerUnit || 0).toFixed(0)} gr</span></p>
                  <p>Costo por Kg: <span>${(recipe.costs?.costPerKg || 0).toFixed(2)}</span></p>
                </div>
                <div className={styles.recetas__cardFooter}>
                  <small>Produce: {recipe.yield_units} unidades</small>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default Recetas;
