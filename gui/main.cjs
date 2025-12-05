/**
 * Speech2Type Electron GUI
 *
 * Menu bar (tray) application for controlling speech2type.
 * Shows animated status indicator and provides controls for the service.
 */

console.log('Starting Speech2Type GUI...');

const { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain, globalShortcut, shell } = require('electron');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const fs = require('fs');

console.log('Modules loaded');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
console.log('Got lock:', gotTheLock);
if (!gotTheLock) {
  console.log('Another instance is running, quitting...');
  app.quit();
}

// State
let tray = null;
let settingsWindow = null;
let s2tProcess = null;
let isListening = false;
let isServiceRunning = false;
let currentMode = 'general';
let ttsEnabled = false;
let isSpeaking = false;

// Animation state
let animationInterval = null;
let animationFrame = 0;

// Paths
const TTS_CONTROL_FILE = '/tmp/claude-auto-speak';
const TTS_SPEAKING_FILE = '/tmp/claude-tts-speaking';
const S2T_STATUS_FILE = '/tmp/s2t-status.json';
const S2T_COMMAND_FILE = '/tmp/s2t-command';
const projectRoot = path.join(__dirname, '..');

// Config file path (same as speech2type uses)
const CONFIG_DIR = path.join(require('os').homedir(), '.config', 'speech2type');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Icon cache
const icons = {};

/**
 * Create tray icon using nativeImage - Mode-specific animations
 * @param {string} state - idle, listening, speaking, processing, error, disabled
 * @param {number} frame - animation frame (0-15) for smooth wave animation
 */
function createTrayIcon(state, frame = 0) {
  const width = 16;
  const height = 16;
  const cacheKey = `${state}-${frame}-${currentMode}`;

  if (icons[cacheKey]) {
    return icons[cacheKey];
  }

  // Colors for different states (RGBA)
  const colorMap = {
    listening: [90, 200, 130, 255],   // Soft green
    speaking: [100, 160, 240, 255],   // Soft blue
    processing: [240, 180, 70, 255],  // Soft amber
    error: [230, 100, 100, 255],      // Soft red
    disabled: [120, 120, 120, 255],   // Gray
    idle: [0, 0, 0, 255]              // Black (template)
  };

  // Mode-specific colors when listening
  if (state === 'listening') {
    if (currentMode === 'claude') {
      colorMap.listening = [217, 119, 87, 255];  // Claude orange/terracotta
    } else if (currentMode === 'music') {
      colorMap.listening = [0, 210, 211, 255];   // Ableton teal/cyan
    }
  }

  const [r, g, b, a] = colorMap[state] || colorMap.idle;
  const isTemplate = state === 'idle';
  const isAnimated = state === 'listening' || state === 'speaking' || state === 'processing';

  const buffer = Buffer.alloc(width * height * 4);

  // Choose icon style based on mode
  if (currentMode === 'claude' && isAnimated) {
    // Claude mode: pulsing dot (AI/thinking indicator)
    drawClaudeIcon(buffer, width, height, r, g, b, a, frame);
  } else if (currentMode === 'music' && isAnimated) {
    // Music mode: bouncing bars (equalizer style)
    drawMusicIcon(buffer, width, height, r, g, b, a, frame);
  } else {
    // General mode: waveform bars
    drawWaveformIcon(buffer, width, height, r, g, b, a, frame, isAnimated);
  }

  const icon = nativeImage.createFromBuffer(buffer, { width, height });

  if (isTemplate) {
    icon.setTemplateImage(true);
  }

  icons[cacheKey] = icon;
  return icon;
}

/**
 * Draw waveform bars (general mode)
 */
function drawWaveformIcon(buffer, width, height, r, g, b, a, frame, isAnimated) {
  const barWidth = 2;
  const gap = 3;
  const totalWidth = 3 * barWidth + 2 * gap;
  const startX = Math.floor((width - totalWidth) / 2);
  const minH = 3;
  const maxH = 11;

  const getBarHeight = (barIndex) => {
    if (!isAnimated) {
      return [5, 8, 5][barIndex];
    }
    const phase = (frame / 16) * Math.PI * 2 + barIndex * 0.8;
    const wave = Math.sin(phase);
    return Math.round(minH + (maxH - minH) * (0.5 + wave * 0.45));
  };

  for (let barIndex = 0; barIndex < 3; barIndex++) {
    const barX = startX + barIndex * (barWidth + gap);
    const barHeight = getBarHeight(barIndex);
    const barTop = Math.floor((height - barHeight) / 2);

    for (let y = barTop; y < barTop + barHeight; y++) {
      for (let x = barX; x < barX + barWidth; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          let alpha = a;
          if (y === barTop || y === barTop + barHeight - 1) {
            alpha = Math.round(a * 0.7);
          }
          buffer[idx] = r;
          buffer[idx + 1] = g;
          buffer[idx + 2] = b;
          buffer[idx + 3] = alpha;
        }
      }
    }
  }
}

/**
 * Draw Claude mode icon - pulsing concentric circles (thinking/AI)
 */
function drawClaudeIcon(buffer, width, height, r, g, b, a, frame) {
  const centerX = width / 2;
  const centerY = height / 2;

  // Pulsing effect
  const pulse = Math.sin((frame / 16) * Math.PI * 2) * 0.3 + 0.7;
  const innerRadius = 2;
  const outerRadius = 5 + Math.sin((frame / 16) * Math.PI * 2) * 1.5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX + 0.5;
      const dy = y - centerY + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * width + x) * 4;

      // Inner solid dot
      if (dist <= innerRadius) {
        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = a;
      }
      // Outer pulsing ring
      else if (dist >= outerRadius - 1 && dist <= outerRadius + 0.5) {
        const ringAlpha = Math.round(a * pulse * 0.6);
        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = ringAlpha;
      }
    }
  }
}

/**
 * Draw Music mode icon - equalizer bars bouncing
 */
function drawMusicIcon(buffer, width, height, r, g, b, a, frame) {
  // 4 thin bars like an equalizer
  const barWidth = 2;
  const gap = 2;
  const numBars = 4;
  const totalWidth = numBars * barWidth + (numBars - 1) * gap;
  const startX = Math.floor((width - totalWidth) / 2);
  const minH = 2;
  const maxH = 12;

  for (let barIndex = 0; barIndex < numBars; barIndex++) {
    // Each bar bounces with different phase
    const phase = (frame / 16) * Math.PI * 2 + barIndex * 1.2;
    const bounce = Math.abs(Math.sin(phase));
    const barHeight = Math.round(minH + (maxH - minH) * bounce);
    const barX = startX + barIndex * (barWidth + gap);
    const barTop = height - 2 - barHeight; // Anchor at bottom

    for (let y = barTop; y < barTop + barHeight; y++) {
      for (let x = barX; x < barX + barWidth; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          const idx = (y * width + x) * 4;
          // Gradient from top (lighter) to bottom (full color)
          const gradientFactor = (y - barTop) / barHeight;
          const alpha = Math.round(a * (0.5 + gradientFactor * 0.5));
          buffer[idx] = r;
          buffer[idx + 1] = g;
          buffer[idx + 2] = b;
          buffer[idx + 3] = alpha;
        }
      }
    }
  }
}

/**
 * Start icon animation for active states
 */
function startAnimation() {
  if (animationInterval) return;

  animationInterval = setInterval(() => {
    animationFrame = (animationFrame + 1) % 16;
    updateTrayIcon();
  }, 80); // Smooth 16-frame animation
}

/**
 * Stop icon animation
 */
function stopAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
    animationFrame = 0;
  }
}

/**
 * Update tray icon based on current state
 */
function updateTrayIcon() {
  if (!tray) return;

  let state = 'idle';
  let tooltip = 'Speech2Type';

  if (!isServiceRunning) {
    state = 'disabled';
    tooltip = 'Speech2Type - Service stopped';
    stopAnimation();
  } else if (isSpeaking) {
    state = 'speaking';
    tooltip = 'Speech2Type - Speaking...';
    startAnimation();
  } else if (isListening) {
    state = 'listening';
    tooltip = 'Speech2Type - Listening...';
    startAnimation();
  } else {
    state = 'idle';
    tooltip = `Speech2Type - ${currentMode} mode`;
    stopAnimation();
  }

  tray.setImage(createTrayIcon(state, animationFrame));
  tray.setToolTip(tooltip);
}

/**
 * Check current TTS state from file
 */
function checkTTSState() {
  ttsEnabled = fs.existsSync(TTS_CONTROL_FILE);
  isSpeaking = fs.existsSync(TTS_SPEAKING_FILE);
  return { ttsEnabled, isSpeaking };
}

/**
 * Load config from speech2type config file
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return {};
}

/**
 * Save config to speech2type config file
 */
function saveConfig(config) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save config:', e);
    return false;
  }
}

/**
 * Build the context menu
 */
function buildContextMenu() {
  checkTTSState();

  const statusLabel = isServiceRunning
    ? (isListening ? '● Listening' : '○ Ready')
    : '○ Stopped';

  const modeSubmenu = [
    {
      label: 'General',
      type: 'radio',
      checked: currentMode === 'general',
      click: () => setMode('general')
    },
    {
      label: 'Music (Ableton)',
      type: 'radio',
      checked: currentMode === 'music',
      click: () => setMode('music')
    },
    {
      label: 'Claude (Power)',
      type: 'radio',
      checked: currentMode === 'claude',
      click: () => setMode('claude')
    }
  ];

  const template = [
    {
      label: statusLabel,
      enabled: false
    },
    { type: 'separator' },
    {
      label: isListening ? 'Stop Listening' : 'Start Listening',
      click: toggleListening,
      enabled: isServiceRunning,
      accelerator: 'CmdOrCtrl+;'
    },
    { type: 'separator' },
    {
      label: 'Mode',
      submenu: modeSubmenu,
      enabled: isServiceRunning
    },
    {
      label: ttsEnabled ? '🔊 TTS Enabled' : '🔇 TTS Disabled',
      click: toggleTTS
    },
    { type: 'separator' },
    {
      label: isServiceRunning ? 'Restart Service' : 'Start Service',
      click: isServiceRunning ? restartS2T : startS2T
    },
    {
      label: 'Stop Service',
      click: stopS2T,
      enabled: isServiceRunning
    },
    { type: 'separator' },
    {
      label: 'Settings...',
      click: openSettings,
      accelerator: 'CmdOrCtrl+,'
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        stopS2T();
        app.quit();
      },
      accelerator: 'CmdOrCtrl+Q'
    }
  ];

  return Menu.buildFromTemplate(template);
}

/**
 * Send command to s2t backend via shared file
 */
function sendCommand(command) {
  const commandFile = '/tmp/s2t-gui-command';
  try {
    fs.writeFileSync(commandFile, command);
    console.log(`[gui] Sent command: ${command}`);
  } catch (e) {
    console.error('Failed to send command:', e);
  }
}

/**
 * Toggle listening state
 */
function toggleListening() {
  if (!isServiceRunning) return;

  sendCommand('toggle');
}

/**
 * Set the current mode
 */
function setMode(mode) {
  currentMode = mode;
  tray.setContextMenu(buildContextMenu());
  updateTrayIcon();

  // Send mode change to backend
  sendCommand(`mode:${mode}`);

  // Notify settings window if open
  if (settingsWindow) {
    settingsWindow.webContents.send('mode-changed', mode);
  }
}

/**
 * Toggle TTS enabled state
 */
function toggleTTS() {
  if (ttsEnabled) {
    try {
      fs.unlinkSync(TTS_CONTROL_FILE);
    } catch (e) {}
    ttsEnabled = false;
  } else {
    fs.writeFileSync(TTS_CONTROL_FILE, '');
    ttsEnabled = true;
  }
  tray.setContextMenu(buildContextMenu());

  // Notify settings window if open
  if (settingsWindow) {
    settingsWindow.webContents.send('tts-changed', ttsEnabled);
  }

  console.log(`TTS: ${ttsEnabled ? 'enabled' : 'disabled'}`);
}

/**
 * Start the speech2type backend service
 */
function startS2T() {
  if (s2tProcess) {
    console.log('Service already running');
    return;
  }

  console.log('Starting Speech2Type service...');

  const s2tPath = path.join(projectRoot, 'bin', 'speech2type.js');

  s2tProcess = spawn('node', [s2tPath, 'start', '--auto'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  s2tProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[s2t]', output);

    // Parse status from output
    if (output.includes('Started listening')) {
      isListening = true;
      updateTrayIcon();
      tray.setContextMenu(buildContextMenu());
    } else if (output.includes('Stopped listening')) {
      isListening = false;
      updateTrayIcon();
      tray.setContextMenu(buildContextMenu());
    }
  });

  s2tProcess.stderr.on('data', (data) => {
    console.error('[s2t error]', data.toString());
  });

  s2tProcess.on('close', (code) => {
    console.log(`Speech2Type service exited with code ${code}`);
    s2tProcess = null;
    isServiceRunning = false;
    isListening = false;
    updateTrayIcon();
    tray.setContextMenu(buildContextMenu());
  });

  isServiceRunning = true;
  updateTrayIcon();
  tray.setContextMenu(buildContextMenu());
}

/**
 * Stop the speech2type backend service
 */
function stopS2T() {
  if (s2tProcess) {
    console.log('Stopping Speech2Type service...');
    s2tProcess.kill('SIGTERM');
    s2tProcess = null;
  }
  isServiceRunning = false;
  isListening = false;
  updateTrayIcon();
  tray.setContextMenu(buildContextMenu());
}

/**
 * Restart the speech2type backend service
 */
function restartS2T() {
  stopS2T();
  setTimeout(startS2T, 500);
}

/**
 * Open the settings window
 */
function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 650,
    title: 'Speech2Type Settings',
    resizable: true,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: '#00000000'
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * Watch for state changes from backend
 */
function startStateWatcher() {
  setInterval(() => {
    const prevSpeaking = isSpeaking;
    const prevListening = isListening;

    checkTTSState();

    // Read status from backend
    try {
      if (fs.existsSync(S2T_STATUS_FILE)) {
        const status = JSON.parse(fs.readFileSync(S2T_STATUS_FILE, 'utf8'));
        isListening = status.listening;
        if (status.mode === 'addon') {
          currentMode = 'music';
        } else {
          currentMode = status.mode;
        }
        ttsEnabled = status.tts;
      }
    } catch (e) {
      // Ignore read errors
    }

    if (prevSpeaking !== isSpeaking || prevListening !== isListening) {
      updateTrayIcon();
      tray.setContextMenu(buildContextMenu());
    }
  }, 300);
}

// IPC handlers for settings window
ipcMain.handle('get-config', () => loadConfig());
ipcMain.handle('save-config', (event, config) => saveConfig(config));
ipcMain.handle('get-state', () => ({
  isListening,
  isServiceRunning,
  currentMode,
  ttsEnabled,
  isSpeaking
}));
ipcMain.on('set-mode', (event, mode) => setMode(mode));
ipcMain.on('set-tts', (event, enabled) => {
  if (enabled !== ttsEnabled) toggleTTS();
});
ipcMain.on('start-service', () => startS2T());
ipcMain.on('stop-service', () => stopS2T());
ipcMain.on('restart-service', () => restartS2T());
ipcMain.on('open-external', (event, url) => shell.openExternal(url));

// App lifecycle
app.whenReady().then(() => {
  console.log('App ready, creating tray...');

  // Hide dock icon (menu bar app only)
  if (app.dock) {
    app.dock.hide();
    console.log('Dock icon hidden');
  }

  // Create tray
  try {
    const icon = createTrayIcon('idle');
    console.log('Icon created:', icon ? 'success' : 'failed');
    console.log('Icon empty?', icon.isEmpty());

    tray = new Tray(icon);
    console.log('Tray created');

    tray.setToolTip('Speech2Type');
    tray.setContextMenu(buildContextMenu());
    console.log('Context menu set');
  } catch (err) {
    console.error('Error creating tray:', err);
  }

  // Click behavior: left-click shows menu (standard macOS behavior)
  // Could change to toggle listening with: tray.on('click', toggleListening);

  // Start watching for state changes
  startStateWatcher();

  // Auto-start the service
  startS2T();

  console.log('Speech2Type GUI started');
});

app.on('window-all-closed', () => {
  // Keep running in menu bar even if settings window is closed
});

app.on('before-quit', () => {
  stopS2T();
  stopAnimation();
});

// Handle second instance
app.on('second-instance', () => {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.focus();
  }
});
