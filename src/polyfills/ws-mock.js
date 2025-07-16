// Mock WebSocket complet pour éviter les problèmes avec ws sur React Native
// Cette implémentation évite les erreurs de module introuvable

class MockWebSocket {
  constructor() {
    this.readyState = 3; // CLOSED
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    this.url = '';
    this.protocol = '';
    this.extensions = '';
    this.bufferedAmount = 0;
    this.binaryType = 'blob';
    
    // Event handlers
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
  }

  send() {
    // Ne rien faire - connexion fermée
  }

  close() {
    // Ne rien faire - déjà fermé
  }

  addEventListener() {
    // Ne rien faire
  }

  removeEventListener() {
    // Ne rien faire
  }

  dispatchEvent() {
    return false;
  }
}

// Mock pour le module ws complet
const mockWs = {
  WebSocket: MockWebSocket,
  default: MockWebSocket,
  Server: class MockServer {
    constructor() {}
    on() {}
    close() {}
  },
  createWebSocketStream: () => ({
    readable: true,
    writable: true,
    on() {},
    write() {},
    end() {},
    destroy() {}
  }),
  WebSocketServer: class MockWebSocketServer {
    constructor() {}
    on() {}
    close() {}
  }
};

// Exporter pour différents formats d'import
module.exports = mockWs;
module.exports.default = mockWs;
module.exports.WebSocket = MockWebSocket;