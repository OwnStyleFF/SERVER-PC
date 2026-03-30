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

const logLines = [];
const maxLogs = 200;

function addLog(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  logLines.push(line);
  if (logLines.length > maxLogs) {
    logLines.shift();
  }
  sendUIStatus();
}

function getLogs() {
  return [...logLines];
}

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
    connectionMessage,
    logs: getLogs()
  });
}

let remoteMessageTimer = null;

function showRemoteMessage(message = 'Mensaje remoto', durationMs = 10000) {
  if (remoteMessageTimer) {
    clearTimeout(remoteMessageTimer);
    remoteMessageTimer = null;
  }
  showLockScreen(message, '');
  if (durationMs > 0) {
    remoteMessageTimer = setTimeout(() => {
      hideLockScreen();
      remoteMessageTimer = null;
    }, durationMs);
  }
}

function showLockScreen(message = 'PC bloqueada', imagePath = 'image/AOD.png', countdownSeconds = null) {
  if (lockWindow && !lockWindow.isDestroyed()) {
    const script = `window.updateLockScreen(${JSON.stringify(message)}, ${JSON.stringify(imagePath)}, ${countdownSeconds !== null ? countdownSeconds : 'null'})`;
    lockWindow.webContents.executeJavaScript(script).catch(() => {});
    return;
  }

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

  const filePath = path.join(__dirname, 'lock-screen.html');
  const query = `?message=${encodeURIComponent(message)}&image=${encodeURIComponent(imagePath)}&countdown=${countdownSeconds !== null ? countdownSeconds : ''}`;
  lockWindow.loadFile(filePath, { query });

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

const AXIOS_TIMEOUT = 15000; // 15s, para conexiones lentas

async function registerAgent() {
  try {
    await axios.post(`${SERVER_URL}/api/pc/pair`, { pc_id: PC_ID, pc_name: PC_ID }, { timeout: AXIOS_TIMEOUT });

    const response = await axios.post(`${SERVER_URL}/api/pc/register`, { pc_id: PC_ID, pc_name: PC_ID }, { timeout: AXIOS_TIMEOUT });

    if (response.data && response.data.success && response.data.token) {
      AGENT_TOKEN = response.data.token;
      store.set('agentToken', AGENT_TOKEN);
      connectionMessage = 'Agente registrado exitosamente con PC ID.';
      addLog(`Registro exitoso: ${PC_ID}`);
      pushStatus();
      return true;
    }

    connectionMessage = `Registro no exitoso: ${response.data?.error || 'sin detalles'}`;
    addLog(`Registro no exitoso: ${JSON.stringify(response.data)}`);
    sendUIStatus();
    console.warn('Registro no exitoso:', response.data?.error || response.data);
    return false;
  } catch (error) {
    const details = error.response?.data || error.message || error;
    connectionMessage = `Error registro agente: ${error.response?.status || '?'} ${error.response?.statusText || ''} -- ${JSON.stringify(details)}`;
    addLog(`Error registro agente: ${connectionMessage}`);
    sendUIStatus();
    console.error('Register agent error', details);
    return false;
  }
}

async function requestPairCode() {
  if (!PC_ID) return false;

  try {
    const response = await axios.post(`${SERVER_URL}/api/pc/pair`, { pc_id: PC_ID, pc_name: PC_ID }, { timeout: AXIOS_TIMEOUT });

    if (response.data && response.data.success) {
      connectionMessage = `PC ${PC_ID} en estado pending para emparejar.`;
      addLog(`Emparejamiento iniciado: ${PC_ID}`);
      isPosConnected = false;
      pushStatus();
      return true;
    }
    
    connectionMessage = `No se pudo iniciar emparejamiento: ${response.data?.error || 'sin detalles'}`;
    addLog(`Emparejamiento falló: ${JSON.stringify(response.data)}`);
    pushStatus();
    console.warn('No se pudo emparejar:', response.data);
    return false;
  } catch (error) {
    const details = error.response?.data || error.message || error;
    connectionMessage = `Error emparejamiento: ${error.response?.status || '?'} ${error.response?.statusText || ''} -- ${JSON.stringify(details)}`;
    addLog(`Error emparejamiento: ${connectionMessage}`);
    sendUIStatus();
    console.error('Pair error', details);
    return false;
  }
}

async function updateAgentPcName() {
  if (!PC_ID || !SERVER_URL) return false;
  try {
    const response = await axios.post(`${SERVER_URL}/api/pc/update-name`, { pc_id: PC_ID, pc_name: PC_ID }, { timeout: 5000 });
    if (response.data?.success) {
      addLog(`Nombre PC actualizado: ${PC_ID}`);
      return true;
    }
    return false;
  } catch (error) {
    const details = error.response?.data || error.message || error;
    addLog(`Error update-name: ${JSON.stringify(details)}`);
    return false;
  }
}

function pushStatus() {
  if (mainWindow && mainWindow.webContents && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pc-controller-status', {
      serverUrl: SERVER_URL,
      pcId: PC_ID,
      agentToken: AGENT_TOKEN,
      connection: isPosConnected ? 'connected' : 'disconnected',
      connectionMessage,
      logs: getLogs()
    });
  }
}

async function isPcRegisteredInPos() {
  try {
    const discoveredResp = await axios.get(`${SERVER_URL}/api/pc/discovered`, { timeout: AXIOS_TIMEOUT });
    const unassignedResp = await axios.get(`${SERVER_URL}/api/pc/unassigned`, { timeout: AXIOS_TIMEOUT });

    const discovered = discoveredResp.data?.data || [];
    const unassigned = unassignedResp.data?.data || [];

    const current = discovered.find((p) => p.pc_id === PC_ID);
    const isUnassigned = unassigned.some((p) => p.pc_id === PC_ID);

    addLog(`Check inventario POS: pc_id=${PC_ID}, found=${!!current}, assigned=${!!current?.assigned}, unassigned=${isUnassigned}`);

    if (isUnassigned) return false;
    if (!current) return false;
    return Boolean(current.assigned);
  } catch (error) {
    const details = error.response?.data || error.message || error;
    addLog(`Error verificando inventario POS: ${JSON.stringify(details)}`);
    return false;
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
    }, { timeout: AXIOS_TIMEOUT });

    if (response.status === 200 && response.data && response.data.success) {
      isPosConnected = true;
      connectionMessage = 'Conectado con POS correctamente.';
      addLog(`Heartbeat OK para ${PC_ID}`);
      sendUIStatus();
      hideMainWindowAfterConnected();
    } else {
      isPosConnected = false;
      connectionMessage = `No se recibió confirmación de POS: ${response.status} ${response.statusText}`;
      addLog(`Heartbeat no OK: ${response.status} ${JSON.stringify(response.data)}`);
      sendUIStatus();
      showMainWindow();
    }

    const pcRegistered = await isPcRegisteredInPos();
    if (!pcRegistered) {
      addLog(`PC ${PC_ID} no registrada en inventario POS. Desbloqueando IU local.`);
      connectionMessage = 'PC no registrada en POS; UI local habilitada.';
      hideLockScreen();
      showMainWindow();
      sendUIStatus();
      return;
    }

    if (response.data && response.data.action) {
      const action = response.data.action;

      // Acciones por estado general
      if (action.type === 'lock' || action.type === 'aod') {
        showLockScreen(action.message || 'PC no autorizada aún', action.image || 'image/AOD.png');
      } else if (action.type === 'unassigned') {
        addLog('PC no inventariada: estado normal bloqueado no aplicado, espera inventario.');
        hideLockScreen();
        showMainWindow();
      } else if (action.type === 'active') {
        addLog('Renta activa: desbloqueado.');
        hideLockScreen();
        showMainWindow();
      } else if (action.type === 'countdown') {
        showLockScreen(`Tiempo restante: ${action.seconds}s`, action.image || 'image/AOD.png', action.seconds);
      } else if (action.type === 'maintenance') {
        showLockScreen(action.message || 'Modo mantenimiento activo', action.image || 'image/AOD.png');
      } else if (action.type === 'unlock') {
        hideLockScreen();
      } else {
        hideLockScreen();
      }

      // Comando remoto específico desde POS
      if (action.command) {
        const cmd = action.command;
        addLog(`Comando remoto recibido: ${cmd.type}`);

        if (cmd.type === 'lock') {
          showLockScreen(cmd.payload?.message || 'Bloqueo remoto activo', cmd.payload?.image || 'image/AOD.png');
        } else if (cmd.type === 'unlock') {
          hideLockScreen();
        } else if (cmd.type === 'message') {
          const msg = cmd.payload?.text || 'Mensaje remoto';
          const duration = Number(cmd.payload?.duration || 12000);
          showRemoteMessage(msg, duration);
          connectionMessage = `Mensaje remoto: ${msg}`;
          addLog(`Mostrar mensaje remoto: ${msg}`);
        } else if (cmd.type === 'add-time') {
          addLog(`Comando agregar tiempo: ${cmd.payload?.minutes || 'n/a'}m`);
        } else if (cmd.type === 'reduce-time') {
          addLog(`Comando reducir tiempo: ${cmd.payload?.minutes || 'n/a'}m`);
        } else if (cmd.type === 'freeze') {
          const message = cmd.payload?.is_frozen ? 'Renta en pausa' : 'Renta reanudada';
          showLockScreen(message, cmd.payload?.image || 'image/AOD.png');
          setTimeout(() => hideLockScreen(), 5000);
        }
      }

      connectionMessage = `Acción recibida: ${action.type}`;
      sendUIStatus();
    } else {
      addLog('Sin acción específica. Mantener IU disponible / desbloqueada.');
      hideLockScreen();
      showMainWindow();
      connectionMessage = 'PC lista. Sin bloqueo activo.';
      sendUIStatus();
    }
  } catch (error) {
    isPosConnected = false;
    const status = error.response?.status;
    const details = error.response?.data || error.message || error;

    if (status === 403 && error.response?.data?.error === 'invalid token') {
      connectionMessage = 'Token inválido: reintentando registro.';
      addLog(`Heartbeat invalid token: ${JSON.stringify(details)}`);
      AGENT_TOKEN = null;
      store.delete('agentToken');
      await registerAgent();
      await updateAgentPcName();
      sendUIStatus();
      return;
    }

    connectionMessage = `Error conexión POS: ${status || '?'} ${error.response?.statusText || ''} - ${JSON.stringify(details)}`;
    addLog(`Heartbeat error: ${connectionMessage}`);
    sendUIStatus();
    console.error('Heartbeat error', details);
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
  await updateAgentPcName();
  pushStatus();
  return { success, pcId: PC_ID, agentToken: AGENT_TOKEN };
});

ipcMain.handle('pc-controller-save-settings', async (event, { serverUrl, pcId }) => {
  SERVER_URL = serverUrl || SERVER_URL;
  PC_ID = pcId || PC_ID;
  store.set('serverUrl', SERVER_URL);
  store.set('pcId', PC_ID);

  const pairOk = await requestPairCode();
  if (pairOk) {
    await registerAgent();
  }
  await updateAgentPcName();
  pushStatus();

  return { serverUrl: SERVER_URL, pcId: PC_ID, agentToken: AGENT_TOKEN, paired: pairOk };
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
