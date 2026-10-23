/**
 * Extrae el color dominante de una imagen (URL o File) usando un canvas.
 * Devuelve un objeto { hex, r, g, b }
 */
export function extractDominantColor(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const processImage = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = 50; // Redimensionar para velocidad
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const data = ctx.getImageData(0, 0, size, size).data;
      const colorMap = {};

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Ignorar transparentes y colores muy oscuros/claros
        if (a < 128) continue;
        const brightness = (r + g + b) / 3;
        if (brightness < 30 || brightness > 230) continue;

        // Cuantizar a grupos de 20
        const key = `${Math.round(r / 20) * 20},${Math.round(g / 20) * 20},${Math.round(b / 20) * 20}`;
        colorMap[key] = (colorMap[key] || 0) + 1;
      }

      let maxCount = 0;
      let dominant = { r: 243, g: 156, b: 18 }; // fallback naranja

      for (const [key, count] of Object.entries(colorMap)) {
        if (count > maxCount) {
          maxCount = count;
          const [r, g, b] = key.split(',').map(Number);
          dominant = { r, g, b };
        }
      }

      const hex = rgbToHex(dominant.r, dominant.g, dominant.b);
      resolve({ hex, ...dominant });
    };

    img.onload = processImage;
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      img.src = URL.createObjectURL(imageSource);
    }
  });
}

/**
 * Genera una paleta armoniosa a partir de un color base.
 * Devuelve variables CSS listas para usar en :root.
 */
export function generatePalette(hex) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);

  return {
    '--color-primary': hex,
    '--color-primary-hover': hslToHex(h, s, Math.max(l - 10, 10)),
    '--color-primary-light': hslToHex(h, Math.max(s - 20, 10), Math.min(l + 25, 90)),
    '--color-primary-dark': hslToHex(h, s, Math.max(l - 25, 5)),
    '--color-accent': hslToHex((h + 30) % 360, s, l),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 243, g: 156, b: 18 };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
