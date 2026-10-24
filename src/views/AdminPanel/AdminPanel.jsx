import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { extractDominantColor, generatePalette } from '../../lib/colorExtractor';
import { useAuth } from '../../contexts/AuthContext';
import styles from './AdminPanel.module.css';

const STORAGE_BUCKET = 'tenant-logos';
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

function AdminPanel() {
  const { signOut } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Modal de credenciales
  const [credentialsTenant, setCredentialsTenant] = useState(null);
  const [storedPasswords, setStoredPasswords] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ca_passwords') || '{}');
    } catch {
      return {};
    }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  // Editar contraseña en credenciales
  const [editingPassword, setEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaveError, setPasswordSaveError] = useState('');

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
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.owner_email,
          password: formData.owner_password,
        });

        if (authError) throw new Error('Error creando usuario: ' + authError.message);
        if (!authData.user) throw new Error('No se pudo crear el usuario');

        const { data: newTenant, error: tenantError } = await supabase
          .from('tenants')
          .insert({
            business_name: formData.business_name,
            slogan: formData.slogan,
            logo_url: logoUrl,
            primary_color: primaryColor,
            owner_id: authData.user.id,
            owner_email: formData.owner_email,
          })
          .select()
          .single();

        if (tenantError) throw new Error(tenantError.message);

        // Guardar contraseña en localStorage (cifrado simple base64)
        if (newTenant) {
          const updated = {
            ...storedPasswords,
            [newTenant.id]: btoa(formData.owner_password),
          };
          setStoredPasswords(updated);
          localStorage.setItem('ca_passwords', JSON.stringify(updated));
        }
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

  // ── Delete corregido con optimistic update ──────────────────────

  const handleDelete = async (tenant) => {
    if (!window.confirm(`¿Eliminar "${tenant.business_name}"? Esto es irreversible.`)) return;

    // Optimistic update: remover de UI inmediatamente
    setTenants(prev => prev.filter(t => t.id !== tenant.id));
    setDeleteError('');

    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenant.id);

    if (error) {
      // Revertir si falló
      setDeleteError(`No se pudo eliminar "${tenant.business_name}": ${error.message}`);
      await fetchTenants(); // restaurar lista real
    } else {
      // Limpiar contraseña guardada
      const updated = { ...storedPasswords };
      delete updated[tenant.id];
      setStoredPasswords(updated);
      localStorage.setItem('ca_passwords', JSON.stringify(updated));
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTenant(null);
    setFormData({ business_name: '', slogan: 'Amasado con Fe y Amor', owner_email: '', owner_password: '' });
    removeLogo();
    setFormError('');
  };

  // ── Credenciales ───────────────────────────────────────────────

  const openCredentials = (tenant) => {
    setCredentialsTenant(tenant);
    setShowPassword(false);
    setResetSent(false);
    setEditingPassword(false);
    setNewPassword('');
    setPasswordSaveError('');
  };

  const closeCredentials = () => {
    setCredentialsTenant(null);
    setEditingPassword(false);
    setNewPassword('');
    setPasswordSaveError('');
  };

  const getStoredPassword = (tenantId) => {
    const enc = storedPasswords[tenantId];
    if (!enc) return null;
    try { return atob(enc); } catch { return null; }
  };

  const handleSaveNewPassword = (tenantId) => {
    if (newPassword.length < 8) {
      setPasswordSaveError('Mínimo 8 caracteres');
      return;
    }
    const updated = { ...storedPasswords, [tenantId]: btoa(newPassword) };
    setStoredPasswords(updated);
    localStorage.setItem('ca_passwords', JSON.stringify(updated));
    setEditingPassword(false);
    setNewPassword('');
    setPasswordSaveError('');
  };

  const handleSendResetEmail = async () => {
    if (!credentialsTenant?.owner_email) return;
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      credentialsTenant.owner_email,
      { redirectTo: `${APP_URL}/reset-password` }
    );
    setResetting(false);
    if (!error) setResetSent(true);
  };

  const getTenantUrl = (tenant) =>
    `${APP_URL}?t=${tenant.id}`;

  const copyToClipboard = async (text, field) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
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

        {/* Error de borrado */}
        {deleteError && (
          <div className={styles.admin__deleteError}>
            ⚠️ {deleteError}
            <button onClick={() => setDeleteError('')} className={styles.admin__deleteErrorClose}>×</button>
          </div>
        )}

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
                onCredentials={() => openCredentials(tenant)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal — Crear / Editar */}
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

            {/* Datos del dueño — solo en creación */}
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

      {/* Modal — Credenciales */}
      {credentialsTenant && (
        <div className={styles.admin__modal} onClick={(e) => e.target === e.currentTarget && closeCredentials()}>
          <div className={styles.admin__credModal}>
            <div className={styles.admin__credHeader}>
              {credentialsTenant.logo_url && (
                <img src={credentialsTenant.logo_url} alt="" className={styles.admin__credLogo} />
              )}
              <div>
                <h2 className={styles.admin__credTitle}>🔑 Acceso del cliente</h2>
                <p className={styles.admin__credSubtitle}>{credentialsTenant.business_name}</p>
              </div>
              <button className={styles.admin__credCloseBtn} onClick={closeCredentials}>×</button>
            </div>

            <div className={styles.admin__credBody}>

              {/* Email */}
              <div className={styles.admin__credField}>
                <span className={styles.admin__credFieldLabel}>📧 Email</span>
                <div className={styles.admin__credFieldRow}>
                  <code className={styles.admin__credFieldValue}>{credentialsTenant.owner_email}</code>
                  <button
                    className={styles.admin__credCopyBtn}
                    onClick={() => copyToClipboard(credentialsTenant.owner_email, 'email')}
                  >
                    {copiedField === 'email' ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Contraseña */}
              <div className={styles.admin__credField}>
                <span className={styles.admin__credFieldLabel}>🔒 Contraseña guardada</span>
                {editingPassword ? (
                  <div className={styles.admin__credPasswordEdit}>
                    <input
                      className={styles.admin__formInput}
                      type="text"
                      placeholder="Nueva contraseña (mín. 8 chars)"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      autoFocus
                    />
                    {passwordSaveError && (
                      <p className={styles.admin__credError}>{passwordSaveError}</p>
                    )}
                    <div className={styles.admin__credPasswordEditActions}>
                      <button
                        className={styles.admin__cancelBtn}
                        onClick={() => { setEditingPassword(false); setNewPassword(''); setPasswordSaveError(''); }}
                      >
                        Cancelar
                      </button>
                      <button
                        className={styles.admin__submitBtn}
                        onClick={() => handleSaveNewPassword(credentialsTenant.id)}
                      >
                        Guardar localmente
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.admin__credFieldRow}>
                    {getStoredPassword(credentialsTenant.id) ? (
                      <>
                        <code className={styles.admin__credFieldValue}>
                          {showPassword
                            ? getStoredPassword(credentialsTenant.id)
                            : '••••••••••'}
                        </code>
                        <button
                          className={styles.admin__credCopyBtn}
                          onClick={() => setShowPassword(v => !v)}
                        >
                          {showPassword ? '🙈 Ocultar' : '👁 Ver'}
                        </button>
                        <button
                          className={styles.admin__credCopyBtn}
                          onClick={() => copyToClipboard(getStoredPassword(credentialsTenant.id), 'pass')}
                        >
                          {copiedField === 'pass' ? '✓ Copiado' : 'Copiar'}
                        </button>
                      </>
                    ) : (
                      <span className={styles.admin__credEmpty}>
                        No guardada — fue creada antes de esta versión
                      </span>
                    )}
                    <button
                      className={styles.admin__credCopyBtn}
                      onClick={() => setEditingPassword(true)}
                    >
                      ✏️ Editar
                    </button>
                  </div>
                )}
              </div>

              {/* URL única */}
              <div className={styles.admin__credField}>
                <span className={styles.admin__credFieldLabel}>🔗 URL de acceso del cliente</span>
                <div className={styles.admin__credFieldRow}>
                  <code className={styles.admin__credFieldValue} style={{ fontSize: '0.75rem' }}>
                    {getTenantUrl(credentialsTenant)}
                  </code>
                  <button
                    className={styles.admin__credCopyBtn}
                    onClick={() => copyToClipboard(getTenantUrl(credentialsTenant), 'url')}
                  >
                    {copiedField === 'url' ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className={styles.admin__credHint}>
                  El cliente puede acceder desde cualquier dispositivo con esta URL. Al iniciar sesión, el sistema lo lleva directo a su panel.
                </p>
              </div>

              {/* Reset email */}
              <div className={styles.admin__credField}>
                <span className={styles.admin__credFieldLabel}>📬 Recuperación de contraseña</span>
                {resetSent ? (
                  <div className={styles.admin__credSuccess}>
                    ✅ Se envió un email de recuperación a <strong>{credentialsTenant.owner_email}</strong>.<br />
                    El cliente podrá crear una contraseña nueva desde ese link.
                  </div>
                ) : (
                  <div>
                    <p className={styles.admin__credHint}>
                      Enviá un email de recuperación para que el cliente pueda restablecer su contraseña directamente.
                    </p>
                    <button
                      className={styles.admin__credResetBtn}
                      onClick={handleSendResetEmail}
                      disabled={resetting}
                    >
                      {resetting ? 'Enviando...' : '📧 Enviar email de recuperación'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tenant Card Component ────────────────────────────────────────

function TenantCard({ tenant, onEdit, onDelete, onCredentials }) {
  const bannerStyle = tenant.logo_url
    ? {
        backgroundImage: `url(${tenant.logo_url})`,
        '--banner-color': tenant.primary_color || 'var(--color-primary)',
      }
    : {
        background: tenant.primary_color || 'var(--color-primary)',
      };

  return (
    <article className={styles.admin__tenantCard}>
      <div
        className={`${styles.admin__tenantBanner} ${tenant.logo_url ? styles['admin__tenantBanner--withLogo'] : ''}`}
        style={bannerStyle}
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
          <button className={styles.admin__tenantCredBtn} onClick={onCredentials}>🔑 Acceso</button>
          <button className={styles.admin__tenantEditBtn} onClick={onEdit}>✏️ Editar</button>
          <button className={styles.admin__tenantDeleteBtn} onClick={onDelete}>🗑️</button>
        </div>
      </div>
    </article>
  );
}

export default AdminPanel;
