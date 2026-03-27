const { app, BrowserWindow, globalShortcut, powerMonitor, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const axios = require('axios');

const store = new Store({ name: 'pc-controller-config' });

let SERVER_URL = process.env.PC_SERVER_URL || store.get('serverUrl', 'https://server-pc-fq7x.onrender.com');
let PC_ID = process.env.PC_NAME || store.get('pcId', 'pc-1');
let AGENT_TOKEN = store.get('agentToken', null);

let mainWindow;
let lockWindow;
let isPosConnected = false;
let connectionMessage = 'Iniciando, conectando a servidor...';

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: true,
    autoHideMenuBar: true
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('minimize', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

function hideMainWindowAfterConnected() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!isPosConnected) return;
    mainWindow.hide();
  }
}

function sendUIStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send('pc-controller-status', {
    serverUrl: SERVER_URL,
    pcId: PC_ID,
    agentToken: AGENT_TOKEN,
    connection: isPosConnected ? 'connected' : 'disconnected',
    connectionMessage
  });
}

function showLockScreen(message = 'PC bloqueada') {
  if (lockWindow && !lockWindow.isDestroyed()) return;

  lockWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: false,
    kiosk: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  lockWindow.loadFile(path.join(__dirname, 'lock-screen.html'));
  lockWindow.webContents.executeJavaScript(`document.getElementById('message').innerText = '${message}';`);

  lockWindow.on('close', (e) => {
    e.preventDefault();
  });
}

function hideLockScreen() {
  if (lockWindow && !lockWindow.isDestroyed()) {
    lockWindow.close();
    lockWindow = null;
  }
}

async function registerAgent() {
  try {
    await axios.post(`${SERVER_URL}/api/pc/pair`, { pc_id: PC_ID }, { timeout: 5000 });

    const response = await axios.post(`${SERVER_URL}/api/pc/register`, { pc_id: PC_ID }, { timeout: 5000 });

    if (response.data && response.data.success && response.data.token) {
      AGENT_TOKEN = response.data.token;
      store.set('agentToken', AGENT_TOKEN);
      connectionMessage = 'Agente registrado exitosamente con PC ID.';
      pushStatus();
      return true;
    }

    connectionMessage = `Registro no exitoso: ${response.data?.error || 'sin detalles'}`;
    sendUIStatus();
    console.warn('Registro no exitoso:', response.data?.error || response.data);
    return false;
  } catch (error) {
    connectionMessage = `Error registro agente: ${error.response?.data?.error || error.message || error}`;
    sendUIStatus();
    console.error('Register agent error', error.response?.data || error.message || error);
    return false;
  }
}

async function requestPairCode() {
  if (!PC_ID) return false;

  try {
    const response = await axios.post(`${SERVER_URL}/api/pc/pair`, { pc_id: PC_ID, pc_name: PC_ID }, { timeout: 5000 });

    if (response.data && response.data.success) {
      connectionMessage = `PC ${PC_ID} en estado pending para emparejar.`;
      isPosConnected = false;
      pushStatus();
      return true;
    }

    connectionMessage = `No se pudo iniciar emparejamiento: ${response.data?.error || 'sin detalles'}`;
    pushStatus();
    console.warn('No se pudo emparejar:', response.data);
    return false;
  } catch (error) {
    connectionMessage = `Error emparejamiento: ${error.message || error}`;
    sendUIStatus();
    console.error('Pair error', error.message || error);
    return false;
  }
}

function pushStatus() {
  if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pc-controller-status', {
      serverUrl: SERVER_URL,
      pcId: PC_ID,
      agentToken: AGENT_TOKEN
    });
  }
}

async function reportStatus() {
  try {
    if (!AGENT_TOKEN) {
      const pairCode = store.get('pairCode');
      if (pairCode) {
        await registerAgent(pairCode);
      }
    }

    if (!AGENT_TOKEN) {
      connectionMessage = 'Sin token de agente. Verifica emparejamiento con POS.';
      isPosConnected = false;
      sendUIStatus();
      return;
    }

    const response = await axios.post(`${SERVER_URL}/api/pc/${PC_ID}/heartbeat`, {
      status: 'alive',
      token: AGENT_TOKEN,
      timestamp: new Date().toISOString()
    }, { timeout: 5000 });

    if (response.status === 200 && response.data && response.data.success) {
      isPosConnected = true;
      connectionMessage = 'Conectado con POS correctamente.';
      sendUIStatus();
      hideMainWindowAfterConnected();
    } else {
      isPosConnected = false;
      connectionMessage = 'No se recibió confirmación de POS.';
      sendUIStatus();
      showMainWindow();
    }

    if (response.data && response.data.action) {
      const action = response.data.action;
      if (action.type === 'lock') {
        showLockScreen(action.payload?.message || 'Bloqueado desde POS');
      } else if (action.type === 'unlock') {
        hideLockScreen();
      }
      connectionMessage = `Acción recibida: ${action.type}`;
      sendUIStatus();
    }
  } catch (error) {
    isPosConnected = false;
    connectionMessage = `Error conexión POS: ${error.message || error}`;
    sendUIStatus();
    console.error('Heartbeat error', error.message || error);
    showMainWindow();
  }
}

async function sendPosCommand(command, payload = {}) {
  if (!PC_ID || !SERVER_URL) return { success: false, error: 'pc_id o server_url missing' };
  try {
    const response = await axios.post(`${SERVER_URL}/api/pc/${PC_ID}/command`, { command, payload }, { timeout: 5000 });
    return response.data;
  } catch (error) {
    const err = error.response?.data || error.message || error;
    console.error('sendPosCommand error', err);
    return { success: false, error: err };
  }
}

function registerHotkeys() {
  // Bloquear combinación de teclado de Windows y otras cosas
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    // differ intentionally no action
  });
}

app.whenReady().then(async () => {
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: ['--hidden']
  });

  createMainWindow();
  registerHotkeys();

  // For rent use case: auto pair/register and heartbeat with single pc identifier.
  const pairOk = await requestPairCode();
  if (pairOk) {
    const reg = await registerAgent();
    if (!reg) {
      console.warn('Registro no exitoso. Reintentando cada 10s...');
    }
  }

  // Every 5 seconds send heartbeat and check server actions
  reportStatus();
  setInterval(reportStatus, 5000);

  powerMonitor.on('suspend', () => {
    console.log('System suspend detected');
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

ipcMain.handle('pc-controller-request-pair', async (event, { serverUrl, pcId }) => {
  SERVER_URL = serverUrl || SERVER_URL;
  PC_ID = pcId || PC_ID;
  store.set('serverUrl', SERVER_URL);
  store.set('pcId', PC_ID);
  const requested = await requestPairCode();
  return { success: requested, pcId: PC_ID, agentToken: AGENT_TOKEN };
});

ipcMain.handle('pc-controller-register', async (event, { pcId }) => {
  if (pcId) {
    PC_ID = pcId;
    store.set('pcId', PC_ID);
  }
  const success = await registerAgent();
  pushStatus();
  return { success, pcId: PC_ID, agentToken: AGENT_TOKEN };
});

ipcMain.handle('pc-controller-save-settings', (event, { serverUrl, pcId }) => {
  SERVER_URL = serverUrl || SERVER_URL;
  PC_ID = pcId || PC_ID;
  store.set('serverUrl', SERVER_URL);
  store.set('pcId', PC_ID);
  pushStatus();
  return { serverUrl: SERVER_URL, pcId: PC_ID };
});

ipcMain.handle('pc-controller-send-command', async (event, { command, payload }) => {
  return await sendPosCommand(command, payload);
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
