// Polyfill pour jsPDF compatible avec Metro/Expo
import { SimplePDF } from './simple-pdf';

// Essayer d'importer le vrai jsPDF en premier
let RealJsPDF = null;
try {
  const jsPDFModule = require('jspdf');
  RealJsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
  console.log('[jspdf-polyfill] Real jsPDF loaded successfully');
} catch (error) {
  console.log('[jspdf-polyfill] Real jsPDF not available, falling back to SimplePDF:', error.message);
}

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

// Fonction qui retourne la meilleure option disponible
const getJsPDF = () => {
  if (RealJsPDF) {
    console.log('[jspdf-polyfill] getJsPDF called, returning real jsPDF class');
    return RealJsPDF;
  } else {
    console.log('[jspdf-polyfill] getJsPDF called, returning SimplePDF fallback class');
    return SimplePDF;
  }
};

// Export de la meilleure option disponible
export const jsPDF = RealJsPDF || SimplePDF;
export default getJsPDF; 