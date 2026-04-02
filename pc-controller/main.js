const { app, BrowserWindow, globalShortcut, powerMonitor, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const Store = require('electron-store');
const axios = require('axios');

const store = new Store({ name: 'pc-controller-config' });

let SERVER_URL = process.env.PC_SERVER_URL || store.get('serverUrl', 'https://server-pc-fq7x.onrender.com');
let PC_ID = process.env.PC_NAME || store.get('pcId', 'pc-1');
let AGENT_TOKEN = store.get('agentToken', null);

const FALLBACK_SERVER_URLS = ['http://127.0.0.1:4000', 'http://localhost:4000'];

async function isServerReachable(url) {
  try {
    await axios.get(`${url}/api/pc/discovered?freshnessMinutes=1`, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

async function pickBestServerUrl() {
  if (await isServerReachable(SERVER_URL)) return SERVER_URL;

  for (const candidate of FALLBACK_SERVER_URLS) {
    if (await isServerReachable(candidate)) {
      SERVER_URL = candidate;
      store.set('serverUrl', SERVER_URL);
      addLog(`Servidor principal inalcanzable; usando fallback ${SERVER_URL}`);
      return SERVER_URL;
    }
  }

  return SERVER_URL;
}

let mainWindow;
let lockWindow;
let isPosConnected = false;
let isPosRegistered = false;
let pcName = PC_ID;
let connectionMessage = 'Iniciando, conectando a servidor...';

const packageJson = require('./package.json');
const CURRENT_VERSION = packageJson.version || '1.0.0';
let latestRemoteVersion = CURRENT_VERSION;
let updateInfo = null;

function semverCompare(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}


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
    if (!isPosConnected || !isPosRegistered) return;
    mainWindow.hide();
  }
}

function sendUIStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send('pc-controller-status', {
    serverUrl: SERVER_URL,
    pcId: PC_ID,
    pcName,
    agentToken: AGENT_TOKEN,
    connection: isPosConnected ? 'connected' : 'disconnected',
    registered: isPosRegistered,
    connectionMessage,
    logs: getLogs(),
    currentVersion: CURRENT_VERSION,
    latestVersion: latestRemoteVersion,
    updateAvailable: latestRemoteVersion && latestRemoteVersion !== CURRENT_VERSION,
    updateInfo
  });
}

function sendUpdateNotification(info) {
  if (!info || !info.version || info.version === CURRENT_VERSION) return;
  latestRemoteVersion = info.version;
  updateInfo = info;

  connectionMessage = `Nueva versión ${info.version} disponible. Presiona actualizar.`;
  addLog(connectionMessage);
  sendUIStatus();
}

async function downloadAndInstallUpdate() {
  if (!updateInfo || !updateInfo.url) {
    connectionMessage = 'No hay URL de actualización disponible';
    sendUIStatus();
    return false;
  }

  try {
    const tempFilename = `gcweb-controller-update-${Date.now()}.exe`;
    const tempPath = path.join(os.tmpdir(), tempFilename);
    const response = await axios.get(updateInfo.url, { responseType: 'stream', timeout: 300000 });

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    if (updateInfo.hash) {
      const computedHash = await calculateFileHash(tempPath);
      if (computedHash.toLowerCase() !== updateInfo.hash.toLowerCase()) {
        addLog(`Hash mismatch: esperado ${updateInfo.hash}, obtenido ${computedHash}`);
        connectionMessage = 'Verification de hash falló, actualización cancelada.';
        sendUIStatus();
        fs.unlinkSync(tempPath);
        return false;
      }
      addLog('Hash verificado correctamente.');
    }

    addLog(`Actualización descargada a ${tempPath}. Iniciando instalador...`);

    spawn(tempPath, ['/S'], { detached: true, stdio: 'ignore' }).unref();

    app.quit();
    return true;
  } catch (error) {
    addLog(`Error descargando/instalando actualización: ${error.message || error}`);
    connectionMessage = 'Error al descargar la actualización';
    sendUIStatus();
    return false;
  }
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
  await pickBestServerUrl();

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      addLog(`registerAgent inicio (intento ${attempt}) server=${SERVER_URL} pc_id=${PC_ID}`);
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

      const issue = response.data?.error || 'sin detalles';
      connectionMessage = `Registro no exitoso: ${issue}`;
      addLog(`Registro no exitoso (intento ${attempt}): ${JSON.stringify(response.data)}`);

      if (issue === 'pc not found' || issue === 'pc not paired' || issue === 'invalid token') {
        // Rerun pair/reg intent
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      sendUIStatus();
      return false;
    } catch (error) {
      const details = error.response?.data || error.message || error;
      connectionMessage = `Error registro agente: ${error.response?.status || '?'} ${error.response?.statusText || ''} -- ${JSON.stringify(details)}`;
      addLog(`Error registro agente (intento ${attempt}): ${connectionMessage}`);
      sendUIStatus();
      console.error('Register agent error', details);

      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      return false;
    }
  }

  return false;
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

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.post(`${SERVER_URL}/api/pc/update-name`, { pc_id: PC_ID, pc_name: PC_ID }, { timeout: 7000 });
      if (response.data?.success) {
        addLog(`Nombre PC actualizado: ${PC_ID} (intento ${attempt})`);
        return true;
      }
      addLog(`Intento ${attempt} update-name fallido: ${JSON.stringify(response.data)}`);
    } catch (error) {
      const details = error.response?.data || error.message || error;
      addLog(`Error update-name (intento ${attempt}): ${JSON.stringify(details)}`);
      if (attempt === 3) return false;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return false;
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
    const updateResp = await axios.get(`${SERVER_URL}/api/pc/update-info`, { timeout: AXIOS_TIMEOUT });
    if (updateResp.data?.success && updateResp.data?.data) {
      checkForUpdate(updateResp.data.data);
    }

    // Report current installed version to server for telemetry
    await axios.post(`${SERVER_URL}/api/pc/report-version`, { pc_id: PC_ID, current_version: CURRENT_VERSION }, { timeout: AXIOS_TIMEOUT }).catch(() => {});

    const discovered = discoveredResp.data?.data || [];
    const unassigned = unassignedResp.data?.data || [];

    const current = discovered.find((p) => p.pc_id === PC_ID);
    const isUnassigned = unassigned.some((p) => p.pc_id === PC_ID);

    const registered = Boolean(current?.assigned && !isUnassigned);
    if (current?.pc_name && current.pc_name !== pcName) {
      pcName = current.pc_name;
      addLog(`Nombre PC actualizado desde POS: ${pcName}`);
    }

    addLog(`Check inventario POS: pc_id=${PC_ID}, found=${!!current}, assigned=${!!current?.assigned}, unassigned=${isUnassigned}, registered=${registered}`);

    return registered;
  } catch (error) {
    const details = error.response?.data || error.message || error;
    addLog(`Error verificando inventario POS: ${JSON.stringify(details)}`);
    return false;
  }
}

let isUpdateInstalling = false;

function checkForUpdate(info) {
  if (!info || !info.version || !info.url) return;

  const cmp = semverCompare(info.version, CURRENT_VERSION);
  if (cmp <= 0) {
    latestRemoteVersion = CURRENT_VERSION;
    updateInfo = null;
    sendUIStatus();
    return;
  }

  latestRemoteVersion = info.version;
  updateInfo = info;

  // Si la versión remota es mayor que la versión actual, notificar siempre.
  sendUpdateNotification(info);

  if (isUpdateInstalling) {
    addLog(`Actualización ya en progreso a ${info.version}, se mantiene.`);
    return;
  }

  isUpdateInstalling = true;
  downloadAndInstallUpdate().finally(() => {
    isUpdateInstalling = false;
  });
}



async function reportStatus() {
  await pickBestServerUrl();
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
    isPosRegistered = pcRegistered;

    if (!pcRegistered) {
      addLog(`PC ${PC_ID} no registrada en inventario POS. Esperando registro antes de bloqueo.`);
      connectionMessage = 'Esperando registro en inventario POS...';
      isPosConnected = false;
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

    if (status === 404 && error.response?.data?.error === 'pc not found') {
      connectionMessage = 'PC no encontrada en POS: reintentando emparejamiento.';
      addLog(`Heartbeat pc not found: ${JSON.stringify(details)}`);
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

async function sendScreenshot() {
  if (!PC_ID || !SERVER_URL) return;
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 640, height: 360 } });
    if (!sources.length) return;
    const imageDataUrl = sources[0].thumbnail.toDataURL();

    await axios.post(`${SERVER_URL}/api/pc/${PC_ID}/screenshot`, { image: imageDataUrl }, { timeout: 15000 });
    addLog('Screenshot enviado al servidor.');
  } catch (error) {
    const details = error.response?.data || error.message || error;
    addLog(`Error enviando screenshot: ${JSON.stringify(details)}`);
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

  sendScreenshot();
  setInterval(sendScreenshot, 30000);

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

ipcMain.handle('pc-controller-save-settings', async (event, { serverUrl, pcId, pcName }) => {
  SERVER_URL = serverUrl || SERVER_URL;
  PC_ID = pcId || PC_ID;
  store.set('serverUrl', SERVER_URL);
  store.set('pcId', PC_ID);

  const pairOk = await requestPairCode();
  if (pairOk) {
    await registerAgent();
  }

  const pcNameToSet = pcName && pcName.trim() ? pcName.trim() : PC_ID;
  try {
    const response = await axios.post(`${SERVER_URL}/api/pc/update-name`, { pc_id: PC_ID, pc_name: pcNameToSet }, { timeout: AXIOS_TIMEOUT });
    if (response.data?.success) {
      addLog(`Nombre PC actualizado desde controlador: ${pcNameToSet}`);
    }
  } catch (err) {
    const details = err.response?.data || err.message || err;
    addLog(`Error update-name desde controlador: ${JSON.stringify(details)}`);
  }

  await updateAgentPcName();
  pushStatus();

  return { serverUrl: SERVER_URL, pcId: PC_ID, agentToken: AGENT_TOKEN, paired: pairOk };
});

ipcMain.handle('pc-controller-update-name', async (event, { pcId, pcName }) => {
  try {
    const response = await axios.post(`${SERVER_URL}/api/pc/update-name`, { pc_id: pcId, pc_name: pcName }, { timeout: AXIOS_TIMEOUT });
    if (response.data?.success) {
      addLog(`Nombre PC actualizado desde controlador: ${pcName}`);
      return { success: true };
    }
    return { success: false, error: response.data?.error || 'unknown error' };
  } catch (err) {
    const details = err.response?.data || err.message || err;
    addLog(`Error update-name IPC: ${JSON.stringify(details)}`);
    return { success: false, error: details };
  }
});

ipcMain.handle('pc-controller-send-command', async (event, { command, payload }) => {
  return await sendPosCommand(command, payload);
});

ipcMain.handle('pc-controller-install-update', async () => {
  const OK = await downloadAndInstallUpdate();
  return { success: OK };
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
