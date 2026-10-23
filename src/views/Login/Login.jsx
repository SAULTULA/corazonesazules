import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Login.module.css';

function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await signIn(email, password);
    if (err) setError(err.message);
    setLoading(false);
  };

  return (
    <div className={styles.login}>
      <div className={styles.login__card}>
        <img src="/corazonazulsinfondo.png" alt="Logo" className={styles.login__logo} />
        <h1 className={styles.login__title}>Plataforma Panaderías</h1>
        <p className={styles.login__subtitle}>Ingresá con tu cuenta para continuar</p>

        <form className={styles.login__form} onSubmit={handleSubmit}>
          {error && <div className={styles.login__error}>{error}</div>}

          <div className={styles.login__group}>
            <label className={styles.login__label} htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className={styles.login__input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="username"
              required
            />
          </div>

          <div className={styles.login__group}>
            <label className={styles.login__label} htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              className={styles.login__input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className={styles.login__button} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
