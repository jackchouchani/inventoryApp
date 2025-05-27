// Polyfill pour jsPDF compatible avec Metro/Expo - utilise SimplePDF
import { SimplePDF } from './simple-pdf.ts';

// Polyfill pour les dépendances dynamiques
if (typeof window !== 'undefined') {
  // Simuler html2canvas si nécessaire
  window.html2canvas = window.html2canvas || (() => Promise.reject(new Error('html2canvas not available')));
  
  // Polyfill pour require dynamique
  const originalRequire = window.require;
  window.require = function(deps, callback) {
    if (Array.isArray(deps) && deps.includes('html2canvas')) {
      // Gérer le cas spécifique de html2canvas
      if (window.html2canvas) {
        callback && callback(window.html2canvas);
      } else {
        console.warn('html2canvas not available, using fallback');
        callback && callback(() => Promise.reject(new Error('html2canvas not available')));
      }
      return;
    }
    // Fallback vers le require original si disponible
    if (originalRequire) {
      return originalRequire.apply(this, arguments);
    }
  };
}

// Fonction qui retourne SimplePDF directement (pas une instance)
const getJsPDF = () => {
  console.log('[jspdf-polyfill] getJsPDF called, returning SimplePDF class:', SimplePDF);
  return SimplePDF;
};

// Export de SimplePDF comme jsPDF
export const jsPDF = SimplePDF;
export default getJsPDF; 