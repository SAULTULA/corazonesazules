import React from 'react';
import Header from '../../components/Header/Header';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Dashboard.module.css';

function Dashboard({ setView }) {
  const { tenant } = useAuth();

  const cards = [
    { id: 'insumos', title: '📦 Insumos', desc: 'Gestión de materias primas e ingredientes.' },
    { id: 'costos', title: '⚡ Costos Operativos', desc: 'Configuración de horno eléctrico y mano de obra.' },
    { id: 'recetas', title: '📝 Recetas', desc: 'Armado de productos y cálculo de rendimiento.' },
    { id: 'rentabilidad', title: '💰 Rentabilidad', desc: 'Análisis de precios de venta y ganancias.' }
  ];

  return (
    <div className={styles.dashboard}>
      <Header
        title="Calculadora de Costos"
        subtitle={`Gestión para ${tenant?.business_name || 'tu panadería'}`}
      />
      
      <main className={styles.dashboard__grid}>
        {cards.map(card => (
          <section
            key={card.id}
            className={`${styles.dashboard__card} ${tenant?.logo_url ? styles['dashboard__card--branded'] : ''}`}
            style={tenant?.logo_url ? {
              '--card-logo': `url(${tenant.logo_url})`,
              '--card-color': tenant?.primary_color || 'var(--color-primary)',
            } : {}}
          >
            <h2 className={styles.dashboard__cardTitle}>{card.title}</h2>
            <p className={styles.dashboard__cardDesc}>{card.desc}</p>
            <button 
              className={styles.dashboard__button}
              onClick={() => setView(card.id)}
            >
              Ir a {card.title.split(' ')[1]}
            </button>
          </section>
        ))}
      </main>
    </div>
  );
}

export default Dashboard;
