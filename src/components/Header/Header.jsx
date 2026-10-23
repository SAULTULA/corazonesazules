import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Header.module.css';

function Header({ title, subtitle, onBack }) {
  const { tenant, signOut } = useAuth();

  const logoSrc = tenant?.logo_url || '/corazonazulsinfondo.png';
  const brandName = tenant?.business_name || 'Corazones Azules';
  const slogan = tenant?.slogan || 'Amasado con Fe y Amor';

  return (
    <header className={styles.header}>
      <div className={styles.header__main}>
        {onBack && (
          <button className={styles.header__back} onClick={onBack}>
            ← Volver
          </button>
        )}
        <div className={styles.header__logoContainer}>
          <img
            src={logoSrc}
            alt={`Logo ${brandName}`}
            className={styles.header__logo}
          />
        </div>
        <div className={styles.header__text}>
          <h1 className={styles.header__title}>{title}</h1>
          {subtitle
            ? <p className={styles.header__subtitle}>{subtitle}</p>
            : <p className={styles.header__subtitle}>{brandName} — {slogan}</p>
          }
        </div>
      </div>
      {!onBack && (
        <button className={styles.header__logout} onClick={signOut} title="Cerrar sesión">
          ↩ Salir
        </button>
      )}
    </header>
  );
}

export default Header;
