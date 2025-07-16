/**
 * Debug utilities pour forcer l'affichage des logs même si supprimés par le navigateur
 */

// Sauvegarder les fonctions console originales
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info
};

// Fonction pour forcer l'affichage d'un message - Version nettoyée sans DOM
export const forceLog = (message: string, level: 'log' | 'warn' | 'error' | 'info' = 'log') => {
  // Utiliser la fonction console originale
  originalConsole[level](`[DEBUG] ${message}`);
};

// Fonction pour restaurer les logs si supprimés
export const restoreConsoleLogs = () => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
};

// Fonction pour tester si les logs fonctionnent
export const testConsoleLogging = () => {
  forceLog('Testing console logging...', 'warn');
  console.warn('Normal console.warn test');
  setTimeout(() => {
    forceLog('Delayed log test', 'info');
  }, 1000);
};