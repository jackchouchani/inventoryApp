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

// Variable pour gérer le conteneur de logs
let logContainer: HTMLElement | null = null;
let logTextArea: HTMLTextAreaElement | null = null;
let logEntries: string[] = [];

// Fonction pour créer le conteneur de logs
const createLogContainer = () => {
  if (logContainer) return;
  
  // Créer le conteneur principal
  logContainer = document.createElement('div');
  logContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 600px;
    height: 400px;
    background: #1e1e1e;
    border: 2px solid #333;
    border-radius: 8px;
    z-index: 99999;
    font-family: monospace;
    color: white;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    display: flex;
    flex-direction: column;
  `;
  
  // Créer le header avec titre et bouton fermer
  const header = document.createElement('div');
  header.style.cssText = `
    background: #333;
    padding: 8px 12px;
    border-radius: 6px 6px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #555;
  `;
  
  const title = document.createElement('span');
  title.textContent = '🔍 Debug Logs';
  title.style.cssText = `
    font-weight: bold;
    color: #fff;
  `;
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
  `;
  closeBtn.onclick = () => {
    hideLogContainer();
  };
  
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear';
  clearBtn.style.cssText = `
    background: #666;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    margin-right: 8px;
  `;
  clearBtn.onclick = () => {
    clearLogContainer();
  };
  
  header.appendChild(title);
  const btnGroup = document.createElement('div');
  btnGroup.appendChild(clearBtn);
  btnGroup.appendChild(closeBtn);
  header.appendChild(btnGroup);
  
  // Créer la zone de texte
  logTextArea = document.createElement('textarea');
  logTextArea.style.cssText = `
    flex: 1;
    background: #1e1e1e;
    color: #fff;
    border: none;
    padding: 12px;
    font-family: monospace;
    font-size: 12px;
    resize: none;
    outline: none;
    white-space: pre;
    overflow-y: auto;
  `;
  logTextArea.readOnly = true;
  logTextArea.placeholder = 'Les logs apparaîtront ici...';
  
  logContainer.appendChild(header);
  logContainer.appendChild(logTextArea);
  document.body.appendChild(logContainer);
};

// Fonction pour afficher le conteneur de logs
const showLogContainer = () => {
  if (!logContainer) {
    createLogContainer();
  }
  if (logContainer) {
    logContainer.style.display = 'flex';
  }
};

// Fonction pour masquer le conteneur de logs
const hideLogContainer = () => {
  if (logContainer) {
    logContainer.style.display = 'none';
  }
};

// Fonction pour vider le conteneur de logs
const clearLogContainer = () => {
  logEntries = [];
  if (logTextArea) {
    logTextArea.value = '';
  }
};

// Fonction pour forcer l'affichage d'un message - Version avec conteneur intelligent
export const forceLog = (message: string, level: 'log' | 'warn' | 'error' | 'info' = 'log') => {
  // Utiliser la fonction console originale
  originalConsole[level](`[DEBUG] ${message}`);
  
  // FORCER l'affichage dans le DOM pour contourner la suppression des logs
  if (typeof document !== 'undefined') {
    // Créer le conteneur si nécessaire
    if (!logContainer) {
      createLogContainer();
    }
    
    // Afficher le conteneur
    showLogContainer();
    
    // Formater le message avec timestamp
    const timestamp = new Date().toLocaleTimeString('fr-FR', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    
    const levelIcon = level === 'error' ? '🔴' : level === 'warn' ? '🟠' : level === 'info' ? '🟢' : '🔵';
    const logEntry = `[${timestamp}] ${levelIcon} [${level.toUpperCase()}] ${message}`;
    
    // Ajouter à la liste des entrées
    logEntries.push(logEntry);
    
    // Garder seulement les 500 dernières entrées
    if (logEntries.length > 500) {
      logEntries = logEntries.slice(-500);
    }
    
    // Mettre à jour la zone de texte
    if (logTextArea) {
      logTextArea.value = logEntries.join('\n');
      // Scroll vers le bas automatiquement
      logTextArea.scrollTop = logTextArea.scrollHeight;
    }
  }
};

// Fonction pour restaurer les logs si supprimés
export const restoreConsoleLogs = () => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
};

// Fonction pour nettoyer tous les logs affichés
export const clearForceLogs = () => {
  clearLogContainer();
};

// Fonction pour tester si les logs fonctionnent
export const testConsoleLogging = () => {
  forceLog('Testing console logging...', 'warn');
  console.warn('Normal console.warn test');
  setTimeout(() => {
    forceLog('Delayed log test', 'info');
  }, 1000);
};