# ONE Cross-Platform Strategy

> From macOS-first to everywhere - Linux, Windows, and beyond

## Vision Statement

Transform ONE from a macOS app into a **universal voice-first platform** that works seamlessly across all major desktop operating systems, bringing voice-powered computing to every developer and power user regardless of their platform choice.

---

## Platform Priorities

### Priority 1: Linux (v2.0)
**Why:**
- Developer-heavy audience (ONE's core users)
- Open source community alignment
- Growing desktop Linux adoption (3-4% market share, but 30%+ among developers)
- Technical users willing to test alpha software

**Target Distros:**
1. Ubuntu/Debian (60% of desktop Linux)
2. Fedora/RHEL (20%)
3. Arch (10%, but vocal enthusiasts)
4. Pop!_OS (System76's dev-focused distro)

### Priority 2: Windows (v2.5)
**Why:**
- Largest market share (75%)
- Enterprise potential
- Gaming community (streamers, content creators)
- PowerShell ecosystem for automation

**Target Editions:**
- Windows 10 (build 1903+)
- Windows 11 (all builds)

### Priority 3: Web Settings (v2.0)
**Why:**
- Cross-platform settings management
- Remote configuration
- Easier onboarding (no native app required initially)

---

## Linux Implementation

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ONE for Linux                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Node.js Backend (src/)                                │ │
│  │  - Audio capture (PipeWire/PulseAudio)                 │ │
│  │  - STT processing (Whisper.cpp local)                  │ │
│  │  - Intent resolution                                   │ │
│  │  - Command execution                                   │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│  ┌───────────────────┴────────────────────────────────────┐ │
│  │  GUI Layer                                             │ │
│  │                                                        │ │
│  │  Option A: Electron (familiar, but heavy)             │ │
│  │  Option B: Tauri (Rust, lighter)                      │ │
│  │  Option C: Qt Quick (native feel)                     │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│  ┌───────────────────┴────────────────────────────────────┐ │
│  │  System Integration                                    │ │
│  │  - D-Bus for IPC                                       │ │
│  │  - Secret Service (gnome-keyring/KWallet)              │ │
│  │  - XDG Desktop Portal                                  │ │
│  │  - systemd for auto-start                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Audio Capture

#### Option A: PipeWire (Modern, Recommended)

```javascript
// src/platforms/linux/audio-pipewire.js
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';

class PipeWireAudioCapture {
  constructor() {
    this.process = null;
    this.sampleRate = 16000;  // Whisper requirement
  }

  async start() {
    // Use pw-cat to capture audio from default mic
    this.process = spawn('pw-cat', [
      '--record',
      '--channels', '1',
      '--rate', this.sampleRate.toString(),
      '--format', 's16',  // 16-bit signed PCM
      '-'  // stdout
    ]);

    // Pipe audio data to our processing pipeline
    this.process.stdout.on('data', (chunk) => {
      this.emit('audio-data', chunk);
    });

    this.process.on('error', (err) => {
      console.error('PipeWire error:', err);
      this.fallbackToPulseAudio();
    });
  }

  async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  fallbackToPulseAudio() {
    // Fallback for systems without PipeWire
    console.log('Falling back to PulseAudio');
    this.startPulseAudio();
  }
}
```

#### Option B: PulseAudio (Legacy, Wide Compatibility)

```javascript
// src/platforms/linux/audio-pulseaudio.js
class PulseAudioCapture {
  async start() {
    // Use parecord (PulseAudio record)
    this.process = spawn('parecord', [
      '--channels=1',
      '--rate=16000',
      '--format=s16le',
      '--raw',
      '-'
    ]);

    this.process.stdout.on('data', (chunk) => {
      this.emit('audio-data', chunk);
    });
  }
}
```

### App Control & Automation

#### Window Management

```javascript
// src/platforms/linux/window-manager.js
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class LinuxWindowManager {
  constructor() {
    this.detectWindowManager();
  }

  async detectWindowManager() {
    // Detect which window manager/DE is running
    try {
      const { stdout } = await execAsync('echo $XDG_CURRENT_DESKTOP');
      this.desktop = stdout.trim().toLowerCase();

      // gnome, kde, xfce, hyprland, sway, etc.
      console.log('Detected desktop:', this.desktop);
    } catch (err) {
      this.desktop = 'unknown';
    }
  }

  async focusApp(appName) {
    // Try wmctrl first (works with X11)
    try {
      await execAsync(`wmctrl -a "${appName}"`);
      return true;
    } catch {
      // Fallback to xdotool
      try {
        await execAsync(`xdotool search --name "${appName}" windowactivate`);
        return true;
      } catch {
        // Last resort: GNOME-specific
        if (this.desktop === 'gnome') {
          return await this.gnomeFocusApp(appName);
        }
        return false;
      }
    }
  }

  async gnomeFocusApp(appName) {
    // Use GNOME Shell D-Bus interface
    const dbus = require('dbus-next');
    const bus = dbus.sessionBus();

    const shellObj = await bus.getProxyObject(
      'org.gnome.Shell',
      '/org/gnome/Shell'
    );

    const shellInterface = shellObj.getInterface('org.gnome.Shell');

    // Get all windows
    const result = await shellInterface.Eval(`
      global.get_window_actors()
        .map(w => w.get_meta_window())
        .filter(w => w.get_title().includes('${appName}'))
        .forEach(w => w.activate(global.get_current_time()))
    `);

    return result[0];  // success boolean
  }

  async sendKeys(keys) {
    // Use xdotool to send keyboard input
    await execAsync(`xdotool key ${keys}`);
  }

  async typeText(text) {
    // Type text safely (escape special chars)
    const escaped = text.replace(/'/g, "\\'");
    await execAsync(`xdotool type '${escaped}'`);
  }

  async getActiveWindow() {
    try {
      const { stdout } = await execAsync('xdotool getactivewindow getwindowname');
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async getActiveApp() {
    try {
      const { stdout } = await execAsync('xdotool getactivewindow getwindowclassname');
      return stdout.trim();
    } catch {
      return null;
    }
  }
}
```

#### D-Bus Integration

```javascript
// src/platforms/linux/dbus-integration.js
import dbus from 'dbus-next';

class DBusIntegration {
  constructor() {
    this.bus = dbus.sessionBus();
  }

  // Media control via MPRIS (Media Player Remote Interfacing Specification)
  async controlMedia(action) {
    const players = await this.getMediaPlayers();

    if (players.length === 0) {
      throw new Error('No media player found');
    }

    const player = players[0];  // Use first active player
    const obj = await this.bus.getProxyObject(
      player,
      '/org/mpris/MediaPlayer2'
    );

    const mpris = obj.getInterface('org.mpris.MediaPlayer2.Player');

    switch (action) {
      case 'play':
        await mpris.Play();
        break;
      case 'pause':
        await mpris.Pause();
        break;
      case 'next':
        await mpris.Next();
        break;
      case 'previous':
        await mpris.Previous();
        break;
    }
  }

  async getMediaPlayers() {
    // Find all MPRIS-compatible players
    const dbusObj = await this.bus.getProxyObject(
      'org.freedesktop.DBus',
      '/org/freedesktop/DBus'
    );

    const dbusInterface = dbusObj.getInterface('org.freedesktop.DBus');
    const names = await dbusInterface.ListNames();

    return names.filter(name => name.startsWith('org.mpris.MediaPlayer2.'));
  }

  // Notification integration
  async sendNotification(title, body) {
    const obj = await this.bus.getProxyObject(
      'org.freedesktop.Notifications',
      '/org/freedesktop/Notifications'
    );

    const notif = obj.getInterface('org.freedesktop.Notifications');

    await notif.Notify(
      'ONE',           // app name
      0,               // replaces_id
      'one-icon',      // app icon
      title,
      body,
      [],              // actions
      {},              // hints
      5000             // timeout (ms)
    );
  }
}
```

### Secrets Management

```javascript
// src/platforms/linux/secrets.js
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class LinuxSecrets {
  constructor() {
    this.backend = null;
    this.detectBackend();
  }

  async detectBackend() {
    // Try to detect if gnome-keyring or KWallet is available
    try {
      await execAsync('which secret-tool');
      this.backend = 'secret-service';  // gnome-keyring, KWallet
    } catch {
      // Fallback to encrypted file storage
      this.backend = 'file';
      console.warn('No Secret Service found, using encrypted file storage');
    }
  }

  async setSecret(key, value) {
    if (this.backend === 'secret-service') {
      // Use libsecret via secret-tool
      await execAsync(
        `echo -n "${value}" | secret-tool store --label="ONE ${key}" service one key ${key}`
      );
    } else {
      // Fallback: encrypted file storage
      await this.setSecretFile(key, value);
    }
  }

  async getSecret(key) {
    if (this.backend === 'secret-service') {
      try {
        const { stdout } = await execAsync(
          `secret-tool lookup service one key ${key}`
        );
        return stdout.trim();
      } catch {
        return null;
      }
    } else {
      return await this.getSecretFile(key);
    }
  }

  async deleteSecret(key) {
    if (this.backend === 'secret-service') {
      await execAsync(`secret-tool clear service one key ${key}`);
    } else {
      await this.deleteSecretFile(key);
    }
  }

  // Fallback encrypted file storage (uses keytar-style encryption)
  async setSecretFile(key, value) {
    // Implementation similar to Windows credential manager fallback
    const crypto = require('crypto');
    const fs = require('fs').promises;
    const path = require('path');

    const configDir = path.join(process.env.HOME, '.config/one');
    const secretsFile = path.join(configDir, '.secrets.enc');

    // Use system entropy + user password for encryption
    // (simplified - production would need proper key derivation)
    const cipher = crypto.createCipher('aes-256-cbc', process.env.USER);
    const encrypted = cipher.update(value, 'utf8', 'hex') + cipher.final('hex');

    const secrets = await this.loadSecretsFile();
    secrets[key] = encrypted;

    await fs.writeFile(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
  }
}
```

### Distribution & Packaging

#### 1. AppImage (Recommended for Initial Release)

```bash
# build-appimage.sh
#!/bin/bash

# Bundle ONE into a single executable AppImage
npm run build

# Use electron-builder with AppImage target
npx electron-builder --linux AppImage

# Result: ONE-2.0.0-x86_64.AppImage
# Users can download and run directly, no installation needed
```

**Pros:**
- Single file, no installation required
- Works on all Linux distros
- Easy updates (built-in updater support)

**Cons:**
- Large file size (~150MB)
- Not integrated with package managers

#### 2. Debian/Ubuntu Package (.deb)

```bash
# build-deb.sh
#!/bin/bash

# Create .deb package
npx electron-builder --linux deb

# Result: one_2.0.0_amd64.deb

# Users install with:
# sudo dpkg -i one_2.0.0_amd64.deb
# sudo apt-get install -f  # fix dependencies
```

**Pros:**
- Native installation experience
- Automatic dependency resolution
- Updates via apt

**Cons:**
- Requires sudo for installation
- More complex build process

#### 3. Snap Package

```yaml
# snapcraft.yaml
name: one
version: '2.0.0'
summary: Voice-powered computing for developers
description: |
  ONE lets you control your computer with natural voice commands.
  Built for developers and power users.

grade: stable
confinement: strict

apps:
  one:
    command: one
    plugs:
      - audio-record
      - audio-playback
      - network
      - home
      - desktop
      - x11

parts:
  one:
    plugin: nodejs
    source: .
    build-packages:
      - node-gyp
    stage-packages:
      - libasound2
```

**Pros:**
- Auto-updates
- Sandboxed (security)
- Works on all distros with snapd

**Cons:**
- Slower startup (snap overhead)
- Permission prompts for audio access

#### 4. Flatpak

```yaml
# com.one-voice.ONE.yaml
app-id: com.one-voice.ONE
runtime: org.freedesktop.Platform
runtime-version: '22.08'
sdk: org.freedesktop.Sdk
command: one

finish-args:
  - --socket=pulseaudio
  - --socket=x11
  - --share=network
  - --filesystem=home

modules:
  - name: one
    buildsystem: simple
    build-commands:
      - npm install
      - npm run build
      - install -D one /app/bin/one
```

**Pros:**
- Modern Linux standard
- Great sandboxing
- Flathub distribution

**Cons:**
- Complex permission model
- Larger download size

### Desktop Integration

```ini
# one.desktop (XDG Desktop Entry)
[Desktop Entry]
Name=ONE
Comment=Voice-powered computing
Exec=/usr/bin/one
Icon=one
Terminal=false
Type=Application
Categories=Utility;AudioVideo;
StartupNotify=false
X-GNOME-Autostart-enabled=true
```

```bash
# Install desktop file
install -Dm644 one.desktop /usr/share/applications/one.desktop
install -Dm644 assets/icon.png /usr/share/icons/hicolor/512x512/apps/one.png

# Register file associations
xdg-mime default one.desktop x-scheme-handler/one
```

### Auto-Start on Login

```bash
# Using systemd user service (recommended)
# ~/.config/systemd/user/one.service

[Unit]
Description=ONE Voice Control
After=network.target

[Service]
ExecStart=/usr/bin/one --background
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
```

```bash
# Enable auto-start
systemctl --user enable one.service
systemctl --user start one.service
```

---

## Windows Implementation

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ONE for Windows                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Node.js Backend (src/)                                │ │
│  │  - Audio capture (WASAPI)                              │ │
│  │  - STT processing (Whisper.cpp local)                  │ │
│  │  - Intent resolution                                   │ │
│  │  - Command execution                                   │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│  ┌───────────────────┴────────────────────────────────────┐ │
│  │  GUI Layer (Electron)                                  │ │
│  │  - System tray icon                                    │ │
│  │  - Settings window                                     │ │
│  │  - Overlay display                                     │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│  ┌───────────────────┴────────────────────────────────────┐ │
│  │  Windows Integration                                   │ │
│  │  - Credential Manager (secrets)                        │ │
│  │  - UI Automation (app control)                         │ │
│  │  - Task Scheduler (auto-start)                         │ │
│  │  - PowerShell integration                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Audio Capture (WASAPI)

```javascript
// src/platforms/windows/audio-wasapi.js
import { spawn } from 'child_process';
import ffi from 'ffi-napi';
import ref from 'ref-napi';

class WASAPIAudioCapture {
  constructor() {
    this.sampleRate = 16000;
    this.process = null;
  }

  async start() {
    // Option A: Use ffmpeg with WASAPI input (simpler)
    this.process = spawn('ffmpeg', [
      '-f', 'dshow',
      '-i', 'audio=Microphone',  // Default microphone
      '-ar', this.sampleRate.toString(),
      '-ac', '1',  // Mono
      '-f', 's16le',  // 16-bit PCM
      'pipe:1'  // stdout
    ]);

    this.process.stdout.on('data', (chunk) => {
      this.emit('audio-data', chunk);
    });

    // Option B: Native WASAPI via node-ffi (more complex, better latency)
    // Implementation would use Windows Core Audio APIs directly
  }

  async stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
```

### App Control (UI Automation)

```javascript
// src/platforms/windows/automation.js
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class WindowsAutomation {
  async focusApp(appName) {
    // Use PowerShell to focus application
    const ps = `
      $app = Get-Process | Where-Object { $_.MainWindowTitle -like "*${appName}*" } | Select-Object -First 1
      if ($app) {
        [Microsoft.VisualBasic.Interaction]::AppActivate($app.Id)
        $true
      } else {
        $false
      }
    `;

    const { stdout } = await execAsync(`powershell -Command "${ps}"`);
    return stdout.trim() === 'True';
  }

  async openApp(appName) {
    // Use Start-Process
    await execAsync(`powershell -Command "Start-Process '${appName}'"`);
  }

  async sendKeys(keys) {
    // Use Windows Script Host SendKeys
    const vbs = `
      Set WshShell = CreateObject("WScript.Shell")
      WshShell.SendKeys "${keys}"
    `;

    await execAsync(`cscript //nologo -e:vbscript -`).stdin.end(vbs);
  }

  async typeText(text) {
    // Use PowerShell with SendKeys
    const escaped = text.replace(/"/g, '""');
    const ps = `
      [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
      [System.Windows.Forms.SendKeys]::SendWait("${escaped}")
    `;

    await execAsync(`powershell -Command "${ps}"`);
  }

  async getActiveWindow() {
    const ps = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Window {
          [DllImport("user32.dll")]
          public static extern IntPtr GetForegroundWindow();

          [DllImport("user32.dll")]
          public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
        }
"@
      $handle = [Window]::GetForegroundWindow()
      $title = New-Object System.Text.StringBuilder(256)
      [Window]::GetWindowText($handle, $title, 256)
      $title.ToString()
    `;

    const { stdout } = await execAsync(`powershell -Command "${ps}"`);
    return stdout.trim();
  }

  async minimizeWindow() {
    const ps = `
      Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class Window {
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

          [DllImport("user32.dll")]
          public static extern IntPtr GetForegroundWindow();
        }
"@
      $handle = [Window]::GetForegroundWindow()
      [Window]::ShowWindow($handle, 6)  # SW_MINIMIZE
    `;

    await execAsync(`powershell -Command "${ps}"`);
  }
}
```

### Secrets Management (Credential Manager)

```javascript
// src/platforms/windows/secrets.js
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class WindowsSecrets {
  async setSecret(key, value) {
    // Use Windows Credential Manager via cmdkey
    const target = `ONE:${key}`;
    const username = 'ONE';

    // cmdkey doesn't support stdin, so we use PowerShell
    const ps = `
      $password = ConvertTo-SecureString "${value}" -AsPlainText -Force
      $credential = New-Object System.Management.Automation.PSCredential("${username}", $password)

      # Store in Credential Manager
      [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential.Password)
      ) | cmdkey /generic:"${target}" /user:"${username}" /pass
    `;

    await execAsync(`powershell -Command "${ps}"`);
  }

  async getSecret(key) {
    const target = `ONE:${key}`;

    const ps = `
      $cred = Get-StoredCredential -Target "${target}"
      if ($cred) {
        [Runtime.InteropServices.Marshal]::PtrToStringAuto(
          [Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred.Password)
        )
      }
    `;

    try {
      const { stdout } = await execAsync(`powershell -Command "${ps}"`);
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  async deleteSecret(key) {
    const target = `ONE:${key}`;
    await execAsync(`cmdkey /delete:"${target}"`);
  }
}
```

### Distribution

#### 1. NSIS Installer (Recommended)

```javascript
// electron-builder config for Windows
{
  "win": {
    "target": ["nsis", "portable"],
    "icon": "assets/icon.ico",
    "publisherName": "ONE Voice Inc.",
    "certificateFile": "certs/one-windows.pfx",  // Code signing
    "certificatePassword": "${WINDOWS_CERT_PASSWORD}"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "ONE",
    "runAfterFinish": true,
    "include": "build/installer.nsh"  // Custom NSIS script
  }
}
```

#### 2. Microsoft Store (Future)

```xml
<!-- AppxManifest.xml -->
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10">
  <Identity Name="ONEVoice.ONE"
            Publisher="CN=ONE Voice Inc"
            Version="2.5.0.0" />

  <Properties>
    <DisplayName>ONE - Voice Control</DisplayName>
    <PublisherDisplayName>ONE Voice Inc</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>

  <Capabilities>
    <Capability Name="internetClient" />
    <DeviceCapability Name="microphone" />
  </Capabilities>

  <Applications>
    <Application Id="ONE" Executable="one.exe" EntryPoint="one.App">
      <uap:VisualElements DisplayName="ONE" ... />
    </Application>
  </Applications>
</Package>
```

**Benefits:**
- Trusted installation source
- Automatic updates
- Monetization built-in
- Windows 11 Store prominence

### Auto-Start on Login

```javascript
// src/platforms/windows/auto-start.js
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

class WindowsAutoStart {
  async enable() {
    // Add to Windows startup via Task Scheduler (better than registry)
    const exePath = process.execPath;
    const taskName = 'ONE Voice Control';

    const xml = `
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2">
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Actions>
    <Exec>
      <Command>${exePath}</Command>
      <Arguments>--background</Arguments>
    </Exec>
  </Actions>
  <Settings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
  </Settings>
</Task>
    `;

    // Save XML to temp file
    const xmlPath = path.join(process.env.TEMP, 'one-task.xml');
    await fs.writeFile(xmlPath, xml);

    // Create scheduled task
    await execAsync(`schtasks /create /tn "${taskName}" /xml "${xmlPath}" /f`);
  }

  async disable() {
    await execAsync('schtasks /delete /tn "ONE Voice Control" /f');
  }

  async isEnabled() {
    try {
      await execAsync('schtasks /query /tn "ONE Voice Control"');
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## Web Settings Interface

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Local Web Server (localhost:7890)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Frontend (Svelte/React)                               │ │
│  │  - Settings UI                                         │ │
│  │  - Command browser                                     │ │
│  │  - Stats dashboard                                     │ │
│  │  - Package marketplace                                 │ │
│  └───────────────────┬────────────────────────────────────┘ │
│                      │                                       │
│                      │ REST API / WebSocket                  │
│                      │                                       │
│  ┌───────────────────┴────────────────────────────────────┐ │
│  │  Backend (Express.js)                                  │ │
│  │  - Authentication (local token)                        │ │
│  │  - Settings management                                 │ │
│  │  - Real-time status updates                            │ │
│  │  - Command execution                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### API Endpoints

```typescript
// Web API for cross-platform settings

// Authentication
POST   /api/auth/token          // Get auth token
GET    /api/auth/verify         // Verify token

// Settings
GET    /api/settings            // Get all settings
PUT    /api/settings            // Update settings
GET    /api/settings/export     // Export config
POST   /api/settings/import     // Import config

// Commands
GET    /api/commands            // List all commands
POST   /api/commands            // Add command
PUT    /api/commands/:id        // Update command
DELETE /api/commands/:id        // Delete command
POST   /api/commands/test       // Test command

// Packages
GET    /api/packages            // Installed packages
POST   /api/packages/install    // Install package
DELETE /api/packages/:id        // Uninstall package

// Stats
GET    /api/stats               // Usage statistics
GET    /api/stats/history       // Historical data

// Real-time
WS     /ws                      // WebSocket for live updates
```

### Benefits

1. **Cross-Platform Consistency** - Same UI on all OSes
2. **Remote Access** - Configure ONE from phone/tablet (local network)
3. **Easier Development** - Web tech faster to iterate than native
4. **Better UX** - Modern web frameworks = better settings UI
5. **Future: Cloud Sync** - Settings sync across devices

---

## Platform-Specific Features

### Linux-Specific

```yaml
linux_features:
  - Tiling WM support (Hyprland, Sway, i3)
  - Wayland native (XWayland fallback)
  - systemd integration
  - Desktop notifications via D-Bus
  - Clipboard via wl-clipboard/xclip
  - Package manager integration (apt, dnf, pacman)
```

### Windows-Specific

```yaml
windows_features:
  - PowerShell automation
  - Windows Terminal integration
  - WSL support (control Linux VMs)
  - Cortana/Windows Speech replacement
  - Game Bar integration
  - Xbox Game Pass cloud gaming control
```

---

## Testing Strategy

### Linux Testing

```yaml
test_matrix:
  distros:
    - ubuntu-22.04    # LTS, priority 1
    - ubuntu-24.04    # Latest LTS
    - fedora-39       # Latest Fedora
    - arch-latest     # Rolling release
    - pop-os-22.04    # Dev-focused

  desktop_environments:
    - GNOME 44+       # Most popular
    - KDE Plasma 5.27
    - XFCE 4.18

  display_servers:
    - Wayland         # Modern default
    - X11             # Legacy compatibility

  audio_systems:
    - PipeWire        # Modern
    - PulseAudio      # Legacy
```

### Windows Testing

```yaml
test_matrix:
  versions:
    - Windows 10 21H2  # Minimum supported
    - Windows 10 22H2  # Latest Win10
    - Windows 11 22H2  # Latest Win11

  editions:
    - Home
    - Pro
    - Enterprise

  scenarios:
    - Clean install
    - Upgrade from v1.x
    - Multiple monitors
    - High DPI displays
```

---

## Migration Path

### Phase P1: Linux Alpha (v2.0-alpha, 3 months)

**Goals:**
- Core functionality working on Ubuntu 22.04
- AppImage distribution
- Audio capture + STT working
- Basic app control (wmctrl)

**Deliverables:**
- one-2.0.0-alpha.1-x86_64.AppImage
- Documentation for Linux users
- Known issues list

### Phase P2: Linux Beta (v2.0-beta, 2 months)

**Goals:**
- Support top 3 distros (Ubuntu, Fedora, Arch)
- Wayland support
- .deb and .rpm packages
- Feature parity with macOS (90%)

**Deliverables:**
- Multi-distro testing results
- Community feedback incorporated
- Beta user cohort (100+ users)

### Phase P3: Linux Stable (v2.0, 1 month)

**Goals:**
- Production-ready
- Flatpak/Snap available
- Documentation complete
- 95% feature parity with macOS

### Phase P4: Windows Alpha (v2.5-alpha, 4 months)

**Goals:**
- Core functionality on Windows 11
- NSIS installer
- PowerShell integration
- Basic app control

### Phase P5: Windows Stable (v2.5, 3 months)

**Goals:**
- Windows 10 + 11 support
- Feature parity with macOS/Linux
- Microsoft Store listing
- Code signing

---

## Open Questions

1. **GUI Framework for Linux**
   - Stay with Electron (familiar but heavy)?
   - Switch to Tauri (lighter, Rust-based)?
   - Native Qt (better Linux integration)?

2. **Windows Store Distribution**
   - Worth the certification effort?
   - What's the user expectation (traditional installer vs Store)?

3. **Snap vs Flatpak**
   - Support both or pick one?
   - How to handle the permission complexity?

4. **Cross-Platform Audio Latency**
   - Can we achieve <100ms on Linux/Windows?
   - Acceptable tradeoff between latency and compatibility?

---

*Last updated: 2025-12-08 by dreamer*
