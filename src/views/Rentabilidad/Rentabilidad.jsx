import React, { useState, useEffect } from 'react';
import Header from '../../components/Header/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantData } from '../../hooks/useTenantData';
import styles from './Rentabilidad.module.css';

function Rentabilidad({ setView }) {
  const { tenant } = useAuth();
  const { data: recipes } = useTenantData('recipes', tenant?.id);
  const [margins, setMargins] = useState({});

  useEffect(() => {
    const initialMargins = {};
    recipes.forEach(r => {
      if (!(r.id in margins)) initialMargins[r.id] = '100';
    });
    if (Object.keys(initialMargins).length > 0) {
      setMargins(prev => ({ ...initialMargins, ...prev }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes]);

  const handleMarginChange = (id, value) => {
    // Permitimos que el valor sea un string (incluso vacío) para facilitar la escritura
    setMargins({
      ...margins,
      [id]: value
    });
  };

  const calculateSalePrice = (cost, margin) => {
    const numMargin = parseFloat(margin) || 0;
    return cost * (1 + numMargin / 100);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const date = new Date().toLocaleDateString();

    // Datos del tenant dinámicos
    const businessName = tenant?.business_name || 'Corazones Azules';
    const slogan = tenant?.slogan || 'Amasado con Fe y Amor';
    const logoUrl = tenant?.logo_url || '/corazonazulsinfondo.png';
    const primaryColor = tenant?.primary_color || '#f39c12';
    
    const itemsHtml = recipes.map(recipe => {
      const margin = margins[recipe.id] || "100";
      const unitSale = calculateSalePrice(recipe.costs?.unitCost || 0, margin);
      const kgSale = calculateSalePrice(recipe.costs?.costPerKg || 0, margin);
      const quarterSale = kgSale / 4;

      return `
        <tr>
          <td>
            <strong>${recipe.name}</strong>
            <br/><small>Amasado Artesanal Premium</small>
          </td>
          <td>$${unitSale.toFixed(0)}</td>
          <td>$${quarterSale.toFixed(0)}</td>
          <td>$${kgSale.toFixed(0)}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Lista de Precios - ${businessName}</title>
          <link href="https://fonts.googleapis.com/css2?family=Italianno&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
          <style>
            body { 
              font-family: 'Playfair Display', serif; 
              padding: 50px; 
              color: #1a3a5a; 
              background-color: #fff;
              position: relative;
              min-height: 100vh;
            }
            /* Borde Decorativo Externo */
            .page-border {
              position: fixed;
              top: 20px; left: 20px; right: 20px; bottom: 20px;
              border: 2px solid ${primaryColor};
              pointer-events: none;
              z-index: 10;
            }
            .page-border::before {
              content: '';
              position: absolute;
              top: 5px; left: 5px; right: 5px; bottom: 5px;
              border: 1px solid #1a3a5a;
            }

            .header { text-align: center; margin-bottom: 40px; position: relative; z-index: 5; }
            .logo { width: 180px; margin-bottom: 10px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); }
            
            h1 { 
              font-family: 'Italianno', cursive; 
              font-size: 5rem; 
              color: #1a3a5a; 
              margin: -10px 0 0 0;
              font-weight: normal;
            }
            .subtitle {
              text-transform: uppercase;
              letter-spacing: 5px;
              font-size: 0.8rem;
              margin-top: -15px;
              color: ${primaryColor};
              font-weight: bold;
            }
            
            .date { font-style: italic; color: #666; font-size: 0.9rem; margin-top: 15px; }
            
            table { width: 100%; border-collapse: collapse; margin-top: 30px; position: relative; z-index: 5; }
            th { 
              border-bottom: 2px solid ${primaryColor}; 
              color: #1a3a5a; 
              padding: 15px; 
              text-align: left; 
              text-transform: uppercase; 
              font-size: 0.85rem; 
              letter-spacing: 2px;
            }
            td { padding: 20px 15px; border-bottom: 1px solid #eee; }
            
            .product-name { font-size: 1.2rem; font-weight: bold; color: #1a3a5a; }
            .product-desc { font-style: italic; color: #f39c12; font-size: 0.85rem; }
            
            .price { font-size: 1.1rem; font-weight: bold; }

            .footer { 
              margin-top: 60px; 
              text-align: center; 
              color: #1a3a5a; 
              font-family: 'Italianno', cursive;
              font-size: 3rem;
              position: relative;
              z-index: 5;
            }

            /* Espigas de Trigo SVG Decoration */
            .wheat {
              position: absolute;
              width: 120px;
              height: auto;
              fill: #f39c12;
              opacity: 0.8;
              z-index: 20;
            }
            .wheat-tl { top: 40px; left: 40px; transform: rotate(-45deg); }
            .wheat-tr { top: 40px; right: 40px; transform: rotate(45deg); }
            
            .watermark-container {
              position: fixed;
              top: 0; left: 0; width: 100%; height: 100%;
              display: flex; justify-content: center; align-items: center;
              z-index: 1; pointer-events: none;
            }
            .watermark { width: 550px; opacity: 0.04; }
          </style>
        </head>
        <body>
          <div class="page-border"></div>
          
          <!-- Espigas en las esquinas superiores - Ahora con Imagen Real -->
          <img src="/espiga.png" class="wheat wheat-tl" alt="Espiga">
          <img src="/espiga.png" class="wheat wheat-tr" alt="Espiga">

          <div class="watermark-container">
            <img src="/corazonazul.png" class="watermark" alt="Watermark">
          </div>

          <div class="header">
            <img src="${logoUrl}" class="logo" alt="Logo">
            <h1>Lista de Precios</h1>
            <div class="subtitle">${slogan}</div>
            <div class="date">Vigente al: ${date}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Producto Artesanal</th>
                <th>Unidad</th>
                <th>1/4 Kg</th>
                <th>1 Kg</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="footer">
            ${businessName}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className={styles.rentabilidad}>
      <Header 
        title="Análisis de Rentabilidad" 
        onBack={() => setView('dashboard')}
      />

      <main className={styles.rentabilidad__content}>
        <div className={styles.rentabilidad__topActions}>
          <button className={styles.rentabilidad__printButton} onClick={handlePrint}>
            🖨️ Generar Lista de Precios
          </button>
        </div>
        <div className={styles.rentabilidad__info}>
          <p>Ajusta el margen de ganancia para calcular automáticamente los precios de venta sugeridos. Luego usa el botón superior para crear tu lista de precios profesional.</p>
        </div>

        <div className={styles.rentabilidad__grid}>
          {recipes.length === 0 ? (
            <div className={styles.rentabilidad__empty}>Primero debes crear recetas en la sección correspondiente.</div>
          ) : (
            recipes.map(recipe => {
              const margin = margins[recipe.id] !== undefined ? margins[recipe.id] : "100";
              
              // Cálculos por Unidad
              const unitCost = recipe.costs?.unitCost || 0;
              const unitSalePrice = calculateSalePrice(unitCost, margin);
              const unitProfit = unitSalePrice - unitCost;

              // Cálculos por Kilogramo
              const kgCost = recipe.costs?.costPerKg || 0;
              const kgSalePrice = calculateSalePrice(kgCost, margin);
              const kgProfit = kgSalePrice - kgCost;

              return (
                <div key={recipe.id} className={styles.rentabilidad__card}>
                  <h3 className={styles.rentabilidad__recipeName}>{recipe.name}</h3>
                  
                  <div className={styles.rentabilidad__marginControl}>
                    <label>Margen de Ganancia (%)</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={margin} 
                      onChange={(e) => handleMarginChange(recipe.id, e.target.value.replace(/[^0-9]/g, ''))}
                      className={styles.rentabilidad__marginInput}
                      placeholder="0"
                    />
                  </div>

                  <div className={styles.rentabilidad__sections}>
                    <div className={styles.rentabilidad__section}>
                      <h4 className={styles.rentabilidad__sectionTitle}>Venta por Unidad</h4>
                      <div className={styles.rentabilidad__row}>
                        <label>Costo</label>
                        <span>${unitCost.toFixed(2)}</span>
                      </div>
                      <div className={styles.rentabilidad__row}>
                        <label>Ganancia</label>
                        <span className={styles.rentabilidad__profit}>+ ${unitProfit.toFixed(2)}</span>
                      </div>
                      <div className={styles.rentabilidad__rowEmphasized}>
                        <label>Precio Sugerido</label>
                        <span className={styles.rentabilidad__salePrice}>${unitSalePrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className={styles.rentabilidad__divider}></div>

                    <div className={styles.rentabilidad__section}>
                      <h4 className={styles.rentabilidad__sectionTitle}>Venta por Kilo</h4>
                      <div className={styles.rentabilidad__row}>
                        <label>Costo Kg</label>
                        <span>${kgCost.toFixed(2)}</span>
                      </div>
                      <div className={styles.rentabilidad__row}>
                        <label>Ganancia Kg</label>
                        <span className={styles.rentabilidad__profit}>+ ${kgProfit.toFixed(2)}</span>
                      </div>
                      <div className={styles.rentabilidad__rowEmphasized}>
                        <label>Precio Sugerido</label>
                        <span className={styles.rentabilidad__salePrice}>${kgSalePrice.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                 <div className={styles.rentabilidad__footer}>
                <small>Valores basados en costo de insumos y energía.</small>
              </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

export default Rentabilidad;
