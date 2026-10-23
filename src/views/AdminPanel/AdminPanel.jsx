import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { extractDominantColor, generatePalette } from '../../lib/colorExtractor';
import { useAuth } from '../../contexts/AuthContext';
import styles from './AdminPanel.module.css';

const STORAGE_BUCKET = 'tenant-logos';

function AdminPanel() {
  const { signOut } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    business_name: '',
    slogan: 'Amasado con Fe y Amor',
    owner_email: '',
    owner_password: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [extractedColor, setExtractedColor] = useState(null);
  const [palette, setPalette] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchTenants(); }, []);

  const fetchTenants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setTenants(data || []);
    setLoading(false);
  };

  // ── Logo handling ──────────────────────────────────────────────

  const handleLogoChange = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreviewUrl(url);
    setExtractedColor(null);
    setPalette(null);

    try {
      const color = await extractDominantColor(file);
      setExtractedColor(color);
      setPalette(generatePalette(color.hex));
    } catch (e) {
      console.warn('Color extraction failed:', e);
    }
  };

  const handleFileInput = (e) => handleLogoChange(e.target.files?.[0]);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleLogoChange(e.dataTransfer.files?.[0]);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreviewUrl('');
    setExtractedColor(null);
    setPalette(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Form submit ────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      let logoUrl = editingTenant?.logo_url || '';
      let primaryColor = editingTenant?.primary_color || '#f39c12';

      // 1. Upload logo if new file
      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileName, logoFile, { upsert: true });

        if (uploadError) throw new Error('Error subiendo logo: ' + uploadError.message);

        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(fileName);
        logoUrl = urlData.publicUrl;
      }

      if (extractedColor) primaryColor = extractedColor.hex;

      if (editingTenant) {
        // ── Editar negocio existente ──
        const { error } = await supabase.from('tenants').update({
          business_name: formData.business_name,
          slogan: formData.slogan,
          logo_url: logoUrl,
          primary_color: primaryColor,
        }).eq('id', editingTenant.id);

        if (error) throw new Error(error.message);
      } else {
        // ── Crear nuevo negocio ──
        // 1. Registrar usuario con signUp (funciona con anon key)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.owner_email,
          password: formData.owner_password,
        });

        if (authError) throw new Error('Error creando usuario: ' + authError.message);
        if (!authData.user) throw new Error('No se pudo crear el usuario');

        // 2. Insertar tenant
        const { error: tenantError } = await supabase.from('tenants').insert({
          business_name: formData.business_name,
          slogan: formData.slogan,
          logo_url: logoUrl,
          primary_color: primaryColor,
          owner_id: authData.user.id,
          owner_email: formData.owner_email,
        });

        if (tenantError) throw new Error(tenantError.message);
      }

      await fetchTenants();
      handleCloseForm();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tenant) => {
    setEditingTenant(tenant);
    setFormData({
      business_name: tenant.business_name,
      slogan: tenant.slogan || 'Amasado con Fe y Amor',
      owner_email: tenant.owner_email || '',
      owner_password: '',
    });
    setLogoPreviewUrl(tenant.logo_url || '');
    setExtractedColor(tenant.primary_color ? { hex: tenant.primary_color } : null);
    setPalette(tenant.primary_color ? generatePalette(tenant.primary_color) : null);
    setLogoFile(null);
    setShowForm(true);
  };

  const handleDelete = async (tenant) => {
    if (!window.confirm(`¿Eliminar "${tenant.business_name}"? Esto es irreversible.`)) return;
    await supabase.from('tenants').delete().eq('id', tenant.id);
    fetchTenants();
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTenant(null);
    setFormData({ business_name: '', slogan: 'Amasado con Fe y Amor', owner_email: '', owner_password: '' });
    removeLogo();
    setFormError('');
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className={styles.admin}>
      {/* Header */}
      <header className={styles.admin__header}>
        <div className={styles.admin__headerBrand}>
          <div className={styles.admin__headerIcon}>🏭</div>
          <div>
            <p className={styles.admin__headerTitle}>Panel Superadmin</p>
            <p className={styles.admin__headerSub}>Gestión de negocios</p>
          </div>
        </div>
        <button className={styles.admin__logoutBtn} onClick={signOut}>Cerrar sesión</button>
      </header>

      <div className={styles.admin__body}>
        {/* Stats */}
        <div className={styles.admin__stats}>
          <div className={styles.admin__stat}>
            <span className={styles.admin__statLabel}>Negocios activos</span>
            <span className={styles.admin__statValue}>{tenants.length}</span>
          </div>
        </div>

        {/* Create button */}
        <button className={styles.admin__createBtn} onClick={() => setShowForm(true)}>
          <span>+</span> Crear Nuevo Negocio
        </button>

        {/* Grid */}
        {loading ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Cargando negocios...</p>
        ) : (
          <div className={styles.admin__grid}>
            {tenants.length === 0 && (
              <div className={styles.admin__empty}>
                No hay negocios creados aún. ¡Empieza creando el primero!
              </div>
            )}
            {tenants.map(tenant => (
              <TenantCard
                key={tenant.id}
                tenant={tenant}
                onEdit={() => handleEdit(tenant)}
                onDelete={() => handleDelete(tenant)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className={styles.admin__modal} onClick={(e) => e.target === e.currentTarget && handleCloseForm()}>
          <form className={styles.admin__form} onSubmit={handleSubmit}>
            <h2 className={styles.admin__formTitle}>
              {editingTenant ? '✏️ Editar Negocio' : '🏪 Crear Nuevo Negocio'}
            </h2>

            {formError && <div className={styles.admin__formError}>{formError}</div>}

            {/* Datos del negocio */}
            <section className={styles.admin__formSection}>
              <p className={styles.admin__formSectionTitle}>Datos del negocio</p>

              <div className={styles.admin__formGroup}>
                <label className={styles.admin__formLabel}>Nombre del negocio *</label>
                <input
                  className={styles.admin__formInput}
                  type="text"
                  placeholder="Ej: Panadería El Sol"
                  value={formData.business_name}
                  onChange={e => setFormData({ ...formData, business_name: e.target.value })}
                  required
                />
              </div>

              <div className={styles.admin__formGroup}>
                <label className={styles.admin__formLabel}>Slogan en la lista de precios</label>
                <input
                  className={styles.admin__formInput}
                  type="text"
                  placeholder="Ej: Amasado con Fe y Amor"
                  value={formData.slogan}
                  onChange={e => setFormData({ ...formData, slogan: e.target.value })}
                />
              </div>
            </section>

            {/* Logo */}
            <section className={styles.admin__formSection}>
              <p className={styles.admin__formSectionTitle}>Logo del negocio</p>

              <div className={styles.admin__logoUpload}>
                {!logoPreviewUrl ? (
                  <div
                    className={`${styles.admin__logoDropzone} ${isDragging ? styles['admin__logoDropzone--active'] : ''}`}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInput}
                    />
                    <span className={styles.admin__logoDropzoneIcon}>🖼️</span>
                    <p className={styles.admin__logoDropzoneText}>
                      <strong>Clic para subir</strong> o arrastrá tu logo aquí<br />
                      PNG, JPG, SVG — recomendado con fondo transparente
                    </p>
                  </div>
                ) : (
                  <div className={styles.admin__logoPreview}>
                    <img
                      src={logoPreviewUrl}
                      alt="Logo preview"
                      className={styles.admin__logoPreviewImg}
                    />
                    <div className={styles.admin__logoPreviewInfo}>
                      <p className={styles.admin__logoPreviewName}>
                        {logoFile?.name || 'Logo actual'}
                      </p>
                      {extractedColor && (
                        <p className={styles.admin__logoPreviewSize}>
                          Color extraído: <strong style={{ color: extractedColor.hex }}>{extractedColor.hex}</strong>
                        </p>
                      )}
                    </div>
                    <button type="button" className={styles.admin__logoRemoveBtn} onClick={removeLogo}>×</button>
                  </div>
                )}

                {/* Paleta generada */}
                {palette && (
                  <div className={styles.admin__colorPreview}>
                    <div
                      className={styles.admin__colorSwatch}
                      style={{ background: extractedColor?.hex }}
                    />
                    <div>
                      <p className={styles.admin__colorText}>
                        Color dominante: <span className={styles.admin__colorHex}>{extractedColor?.hex}</span>
                      </p>
                      <div className={styles.admin__paletteRow}>
                        {Object.values(palette).map((c, i) => (
                          <div
                            key={i}
                            className={styles.admin__paletteChip}
                            style={{ background: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Datos del dueño */}
            {!editingTenant && (
              <section className={styles.admin__formSection}>
                <p className={styles.admin__formSectionTitle}>Acceso del dueño</p>
                <div className={styles.admin__formGroup}>
                  <label className={styles.admin__formLabel}>Email *</label>
                  <input
                    className={styles.admin__formInput}
                    type="email"
                    placeholder="dueno@panaderia.com"
                    value={formData.owner_email}
                    onChange={e => setFormData({ ...formData, owner_email: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.admin__formGroup}>
                  <label className={styles.admin__formLabel}>Contraseña inicial *</label>
                  <input
                    className={styles.admin__formInput}
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={formData.owner_password}
                    onChange={e => setFormData({ ...formData, owner_password: e.target.value })}
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </section>
            )}

            <div className={styles.admin__formActions}>
              <button type="button" className={styles.admin__cancelBtn} onClick={handleCloseForm}>
                Cancelar
              </button>
              <button type="submit" className={styles.admin__submitBtn} disabled={saving}>
                {saving ? 'Guardando...' : editingTenant ? 'Actualizar' : 'Crear Negocio'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Tenant Card Component ────────────────────────────────────────

function TenantCard({ tenant, onEdit, onDelete }) {
  return (
    <article className={styles.admin__tenantCard}>
      <div
        className={styles.admin__tenantBanner}
        style={{ background: tenant.primary_color || 'var(--color-primary)' }}
      />
      <div className={styles.admin__tenantBody}>
        <div className={styles.admin__tenantLogoRow}>
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={`Logo ${tenant.business_name}`}
              className={styles.admin__tenantLogo}
            />
          ) : (
            <div className={styles.admin__tenantLogoPlaceholder}>🏪</div>
          )}
          <div>
            <h3 className={styles.admin__tenantName}>{tenant.business_name}</h3>
            <p className={styles.admin__tenantSlogan}>{tenant.slogan || 'Sin slogan'}</p>
          </div>
        </div>

        <div className={styles.admin__tenantMeta}>
          <span className={styles.admin__tenantEmail}>{tenant.owner_email}</span>
          {tenant.primary_color && (
            <div
              className={styles.admin__tenantColor}
              style={{ background: tenant.primary_color }}
              title={tenant.primary_color}
            />
          )}
        </div>

        <div className={styles.admin__tenantActions}>
          <button className={styles.admin__tenantEditBtn} onClick={onEdit}>✏️ Editar</button>
          <button className={styles.admin__tenantDeleteBtn} onClick={onDelete}>🗑️</button>
        </div>
      </div>
    </article>
  );
}

export default AdminPanel;
