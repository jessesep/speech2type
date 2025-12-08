# ONE Security & Privacy Architecture

## Executive Summary

Voice interfaces handle the most sensitive data: conversations, commands, work context, personal vocabulary. ONE's security and privacy strategy is not just about compliance—it's about earning radical trust. This document outlines our approach to making ONE the most secure and privacy-respecting voice platform.

## Vision Statement

**Users should have complete confidence that their voice data is protected, private, and under their control.**

ONE will:
- Process voice locally by default (no cloud required for core features)
- Encrypt all data at rest and in transit
- Give users full transparency and control over their data
- Meet enterprise security standards (SOC 2, ISO 27001)
- Design privacy into every feature from day one
- Publish annual security audits

---

## Core Principles

### 1. Privacy by Design

Philosophy:
- **Local-first**: Process on-device whenever possible
- **Minimal data collection**: Only collect what's necessary
- **User ownership**: Users own their voice data and command history
- **Transparency**: Clear disclosure of what data goes where
- **Deletion rights**: Complete data erasure on request

### 2. Zero Trust Architecture

Security model:
- **Assume breach**: Design for resilience, not perfect perimeter
- **Least privilege**: Services only access what they need
- **Defense in depth**: Multiple layers of security
- **Continuous verification**: Monitor for anomalies
- **Encrypted everything**: At rest, in transit, in memory

### 3. Compliance as Baseline

Standards:
- **GDPR** (EU privacy regulation)
- **CCPA** (California privacy law)
- **SOC 2 Type II** (security, availability, confidentiality)
- **ISO 27001** (information security management)
- **HIPAA** (healthcare data protection) — future
- **WCAG AAA** (accessibility compliance)

---

## Threat Model

### Assets to Protect

**Tier 1 - Critical:**
- Voice audio recordings (raw transcripts)
- API keys (Anthropic, Deepgram, etc.)
- Personal command dictionary (learned commands)
- Workflow definitions (may contain sensitive logic)

**Tier 2 - Sensitive:**
- Command history (reveals work patterns)
- Context data (app usage, focus history)
- User preferences and settings
- Multi-agent task assignments

**Tier 3 - Low Sensitivity:**
- Aggregate usage statistics (anonymous)
- Crash logs (scrubbed of PII)
- Feature flags
- Public configuration

### Threat Actors

**1. External Attackers**
- **Goal**: Steal API keys, exfiltrate voice data, inject malicious commands
- **Vectors**: Malware, network interception, social engineering
- **Impact**: Data breach, account takeover, financial loss

**2. Malicious Insiders (Enterprise)**
- **Goal**: Spy on coworkers, steal IP, sabotage
- **Vectors**: Privileged access abuse, audit log tampering
- **Impact**: Espionage, compliance violation, reputation damage

**3. Curious Service Providers (Cloud)**
- **Goal**: Mine user data for insights, training data
- **Vectors**: Third-party API access (Deepgram, Anthropic)
- **Impact**: Privacy violation, loss of trust

**4. Nation-State Surveillance**
- **Goal**: Mass monitoring, keyword detection, targeted collection
- **Vectors**: Network taps, compelled access, supply chain compromise
- **Impact**: Political persecution, censorship

**5. Accidental Exposure**
- **Goal**: None (unintentional)
- **Vectors**: Misconfigured settings, logging errors, clipboard leaks
- **Impact**: Embarrassment, minor privacy breach

### Attack Scenarios

**Scenario 1: API Key Theft**
- Attacker gains filesystem access (malware, physical access)
- Reads `~/.config/one/config.json` (if plaintext)
- Uses stolen Anthropic API key for unauthorized LLM access
- **Impact**: $1000s in API charges, usage quota exhaustion

**Mitigation:**
- ✅ **v0.7**: Keytar integration (macOS Keychain storage)
- ✅ API keys never in plaintext files
- 🔄 **v1.5**: Encrypted backup of Keychain to cloud (optional)
- 🔄 **v2.0**: Hardware security module (HSM) support for enterprise

**Scenario 2: Voice Command Injection**
- Attacker plays audio near user's computer (physical proximity)
- OR: Compromises media player to inject ultrasonic commands
- ONE executes "Delete all files" or "Send email to attacker"
- **Impact**: Data loss, account compromise, lateral movement

**Mitigation:**
- 🔄 **v1.0**: Speaker recognition (distinguish user's voice from others)
- 🔄 **v1.2**: Confirmation required for destructive commands
- 🔄 **v1.5**: Acoustic fingerprinting (detect synthetic voices)
- 🔄 **v2.0**: Continuous authentication (voiceprint verification)
- 🔄 Ultrasonic filtering (ignore frequencies >20kHz)

**Scenario 3: Network Interception**
- Attacker on same WiFi network (coffee shop, airport)
- Intercepts Deepgram API calls (if not TLS 1.3)
- Captures voice audio in transit
- **Impact**: Eavesdropping, sensitive info disclosure

**Mitigation:**
- ✅ **v0.7**: All API calls over HTTPS with certificate pinning
- 🔄 **v1.5**: Mutual TLS (mTLS) for API authentication
- 🔄 **v2.0**: Local processing default (no network required)
- 🔄 VPN detection warning ("You're on public WiFi—switch to local mode?")

**Scenario 4: Malicious Addon**
- User installs third-party addon from community
- Addon has broad file access, exfiltrates command history
- Sends data to attacker's server
- **Impact**: Privacy breach, IP theft

**Mitigation:**
- 🔄 **v1.5**: Addon sandboxing (restricted file access)
- 🔄 **v2.0**: Addon permissions model (user grants access)
- 🔄 Code signing requirement for marketplace addons
- 🔄 Community review process (min 2 reviewers)
- 🔄 Automated security scanning (static analysis)

**Scenario 5: Cloud Backup Leak**
- User enables cloud sync (iCloud, Dropbox)
- Backup includes `personal_commands.json` (plaintext)
- Cloud account compromised (weak password, no 2FA)
- **Impact**: Command dictionary exposed, IP leak

**Mitigation:**
- 🔄 **v1.5**: Encrypt backups with user passphrase
- 🔄 End-to-end encryption (E2EE) for cloud sync
- 🔄 Warn users about cloud risks before enabling sync
- 🔄 Option: Store only non-sensitive data in cloud

---

## Security Architecture

### Local-First Processing

**Goal:** Minimize data leaving the device

**Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│                      USER'S MAC                          │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  VOICE INPUT (Microphone)                         │  │
│  └────────────────┬─────────────────────────────────┘  │
│                   ↓                                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  TIER 1: LOCAL DICTIONARY LOOKUP                 │  │
│  │  • Exact match against personal_commands.json    │  │
│  │  • No network, instant (<10ms)                   │  │
│  │  • 60-70% hit rate (after training)              │  │
│  └────────────────┬─────────────────────────────────┘  │
│                   │ Miss                                 │
│                   ↓                                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  TIER 2: FUZZY MATCHING (Fuse.js)                │  │
│  │  • Phonetic similarity, typo tolerance           │  │
│  │  • Local, fast (<50ms)                           │  │
│  │  • 20-30% hit rate                               │  │
│  └────────────────┬─────────────────────────────────┘  │
│                   │ Miss                                 │
│                   ↓                                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  TIER 3A: LOCAL LLM (v2.0+)                      │  │
│  │  • Whisper.cpp (STT) + Llama 3.2 (intent)       │  │
│  │  • Runs on-device (Apple Silicon, CUDA)         │  │
│  │  • <200ms latency, fully private                │  │
│  │  • Fallback: Tier 3B (cloud)                    │  │
│  └────────────────┬─────────────────────────────────┘  │
│                   │ Low confidence / user preference     │
│                   ↓                                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  TIER 3B: CLOUD API (Deepgram + Claude Haiku)   │  │
│  │  • TLS 1.3 encrypted transit                    │  │
│  │  • No retention by provider (per agreement)     │  │
│  │  • ~$0.00005 per call                           │  │
│  │  • User can disable (force local mode)          │  │
│  └────────────────┬─────────────────────────────────┘  │
│                   ↓                                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  COMMAND EXECUTION                                │  │
│  │  • Rate limiting (prevent command injection)    │  │
│  │  • Confirmation for destructive ops              │  │
│  │  • Audit log (encrypted)                         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Key Principles:**
1. **Minimize cloud calls**: 80%+ commands resolved locally
2. **User control**: Toggle "Cloud Assist" on/off in settings
3. **Graceful degradation**: If offline, still 80% functional
4. **Transparency**: Show in GUI whether command went to cloud

### Data Encryption

**At Rest (Local Storage):**

| Data Type | Storage Location | Encryption |
|-----------|------------------|------------|
| **API Keys** | macOS Keychain | AES-256 (Keychain default) |
| **Personal Commands** | `~/.config/one/personal_commands.json` | v1.5: AES-256-GCM with user passphrase |
| **Command History** | `~/.config/one/history.db` (SQLite) | v1.5: SQLCipher (encrypted SQLite) |
| **Workflows** | `~/.config/one/workflows.json` | v1.5: AES-256-GCM |
| **Audit Logs** | `~/.config/one/logs/` | v1.5: AES-256-GCM |
| **Voice Recordings** | Optional (disabled by default) | AES-256-GCM, auto-delete after 7 days |

**Implementation (v1.5):**

```javascript
// src/services/encryption.js

const crypto = require('crypto');
const fs = require('fs').promises;

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyDerivation = 'pbkdf2'; // Password-based key derivation
    this.iterations = 100000;      // OWASP recommended
  }

  async deriveKey(passphrase, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        passphrase,
        salt,
        this.iterations,
        32, // 256 bits
        'sha256',
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        }
      );
    });
  }

  async encrypt(plaintext, passphrase) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12); // GCM recommended IV size
    const key = await this.deriveKey(passphrase, salt);

    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return: salt + iv + authTag + ciphertext (all hex)
    return {
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      ciphertext: ciphertext
    };
  }

  async decrypt(encrypted, passphrase) {
    const salt = Buffer.from(encrypted.salt, 'hex');
    const iv = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');
    const key = await this.deriveKey(passphrase, salt);

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }

  async encryptFile(filePath, passphrase) {
    const plaintext = await fs.readFile(filePath, 'utf8');
    const encrypted = await this.encrypt(plaintext, passphrase);

    // Save as .enc file
    await fs.writeFile(
      `${filePath}.enc`,
      JSON.stringify(encrypted),
      'utf8'
    );

    // Securely delete original (overwrite with random data first)
    await this.secureDelete(filePath);
  }

  async decryptFile(encFilePath, passphrase) {
    const encryptedData = JSON.parse(await fs.readFile(encFilePath, 'utf8'));
    const plaintext = await this.decrypt(encryptedData, passphrase);

    const originalPath = encFilePath.replace('.enc', '');
    await fs.writeFile(originalPath, plaintext, 'utf8');

    return originalPath;
  }

  async secureDelete(filePath) {
    // Overwrite file with random data 3x before deletion (DoD 5220.22-M)
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    for (let i = 0; i < 3; i++) {
      const randomData = crypto.randomBytes(fileSize);
      await fs.writeFile(filePath, randomData);
    }

    await fs.unlink(filePath);
  }

  // Master passphrase management
  async setMasterPassphrase(passphrase) {
    // Validate strength
    if (passphrase.length < 12) {
      throw new Error('Passphrase must be at least 12 characters');
    }

    // Store hash in Keychain (for verification)
    const hash = crypto.createHash('sha256').update(passphrase).digest('hex');
    await this.secretsService.set('master_passphrase_hash', hash);

    return true;
  }

  async verifyMasterPassphrase(passphrase) {
    const stored = await this.secretsService.get('master_passphrase_hash');
    const provided = crypto.createHash('sha256').update(passphrase).digest('hex');

    return stored === provided;
  }
}

module.exports = EncryptionService;
```

**User Experience:**
1. On first launch: "Set a master passphrase to encrypt your data"
2. Passphrase required on app startup (or use Touch ID / system keychain)
3. Setting toggle: "Encrypt local data" (default: ON for v1.5+)
4. Warning: "Forgot passphrase = data loss" (no recovery backdoor)

**In Transit (Network):**

| Connection | Protocol | Encryption | Certificate Pinning |
|------------|----------|------------|---------------------|
| Deepgram API | HTTPS | TLS 1.3 | ✅ v1.5 |
| Anthropic API | HTTPS | TLS 1.3 | ✅ v1.5 |
| Cloud Sync (optional) | HTTPS | TLS 1.3 + E2EE | ✅ v2.0 |
| ONE GUI ↔ Backend | Local IPC | N/A (same machine) | N/A |

**Certificate Pinning (v1.5):**

```javascript
// src/services/api-client.js

const https = require('https');
const tls = require('tls');

class SecureAPIClient {
  constructor() {
    // Public key hashes for Deepgram, Anthropic (update annually)
    this.pinnedCerts = {
      'api.deepgram.com': [
        'sha256/ABC123...', // Primary cert
        'sha256/DEF456...'  // Backup cert (for rotation)
      ],
      'api.anthropic.com': [
        'sha256/XYZ789...',
        'sha256/UVW012...'
      ]
    };
  }

  async makeRequest(url, options) {
    const hostname = new URL(url).hostname;
    const pinnedHashes = this.pinnedCerts[hostname];

    if (!pinnedHashes) {
      throw new Error(`No pinned certificate for ${hostname}`);
    }

    // Custom HTTPS agent with cert validation
    const agent = new https.Agent({
      checkServerIdentity: (host, cert) => {
        const publicKey = cert.pubkey;
        const hash = crypto.createHash('sha256').update(publicKey).digest('base64');
        const pinned = `sha256/${hash}`;

        if (!pinnedHashes.includes(pinned)) {
          throw new Error(`Certificate pin mismatch for ${host}`);
        }

        return undefined; // Cert is valid
      },
      minVersion: 'TLSv1.3' // Enforce TLS 1.3
    });

    return https.request(url, { ...options, agent });
  }
}
```

### Access Control

**Principle of Least Privilege:**

| Component | File Access | Network Access | API Keys |
|-----------|-------------|----------------|----------|
| **Voice Input Service** | Read: microphone settings | None | None |
| **Intent Resolver** | Read: personal_commands.json | Anthropic API (if Tier 3) | Anthropic key (read-only from Keychain) |
| **Command Executor** | Read/Write: workspace files | None (unless command explicitly calls network) | None |
| **Multi-Agent Orchestrator** | Read/Write: agent directories | None | Anthropic key (for task decomposition) |
| **GUI** | Read: all config files | None | None |
| **Addon System** | Sandboxed: addon-specific dir only | Requires user permission | Never (addons use proxy API) |

**macOS Sandboxing (v2.0):**

```xml
<!-- ONE.entitlements -->
<plist version="1.0">
<dict>
  <!-- Microphone access (required) -->
  <key>com.apple.security.device.microphone</key>
  <true/>

  <!-- File access (scoped to ~/.config/one/) -->
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>

  <!-- Network (only for API calls, not incoming) -->
  <key>com.apple.security.network.client</key>
  <true/>

  <!-- NO incoming network (no server mode) -->
  <key>com.apple.security.network.server</key>
  <false/>

  <!-- NO camera (don't need it) -->
  <key>com.apple.security.device.camera</key>
  <false/>
</dict>
</plist>
```

### Audit Logging

**What to Log:**

| Event | Log Level | Retention | Includes |
|-------|-----------|-----------|----------|
| Command executed | INFO | 30 days | Command, timestamp, app context (NOT audio) |
| API key accessed | WARN | 90 days | Service name, timestamp (NOT key value) |
| Failed authentication | WARN | 90 days | Attempt count, timestamp |
| Config changed | INFO | 90 days | Setting name, old/new value |
| Addon installed | WARN | Indefinite | Addon name, version, signature |
| Destructive command | WARN | Indefinite | Command, confirmation status |
| Export/backup | WARN | Indefinite | Export destination, data types |

**What NOT to Log:**
- ❌ Voice audio (unless explicitly enabled for debugging)
- ❌ API key values
- ❌ Full command transcripts (store hash only)
- ❌ Personal identifiers (IP addresses, device IDs)

**Log Format (JSON):**

```json
{
  "timestamp": "2025-12-08T22:54:33Z",
  "level": "INFO",
  "event": "command_executed",
  "details": {
    "command_hash": "sha256:abc123...",
    "tier": 1,
    "app_context": "com.microsoft.VSCode",
    "execution_time_ms": 45,
    "success": true
  },
  "user_id_hash": "sha256:user123..." // Anonymized
}
```

**Encrypted Audit Logs (v1.5):**

```javascript
// src/services/audit-logger.js

const fs = require('fs').promises;
const crypto = require('crypto');

class AuditLogger {
  constructor(encryptionService) {
    this.logFile = '~/.config/one/logs/audit.log.enc';
    this.encryption = encryptionService;
    this.buffer = []; // In-memory buffer
    this.flushInterval = 60000; // Flush every 60s
  }

  async log(level, event, details) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      details: this.sanitize(details), // Remove PII
      user_id_hash: this.getUserHash()
    };

    this.buffer.push(entry);

    // Flush if buffer > 100 entries
    if (this.buffer.length >= 100) {
      await this.flush();
    }
  }

  sanitize(details) {
    // Remove sensitive fields
    const sanitized = { ...details };
    delete sanitized.api_key;
    delete sanitized.passphrase;
    delete sanitized.audio;

    // Hash command text (for privacy)
    if (sanitized.command) {
      sanitized.command_hash = crypto.createHash('sha256')
        .update(sanitized.command)
        .digest('hex');
      delete sanitized.command;
    }

    return sanitized;
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const plaintext = this.buffer.map(e => JSON.stringify(e)).join('\n');
    const encrypted = await this.encryption.encrypt(plaintext, this.getMasterPassphrase());

    // Append to encrypted log file
    await fs.appendFile(this.logFile, JSON.stringify(encrypted) + '\n', 'utf8');

    this.buffer = [];
  }

  async exportLogs(outputPath, passphrase) {
    // Decrypt logs and export (for user review)
    const encryptedLogs = await fs.readFile(this.logFile, 'utf8');
    const lines = encryptedLogs.split('\n').filter(l => l.trim());

    const decrypted = [];
    for (const line of lines) {
      const encrypted = JSON.parse(line);
      const plaintext = await this.encryption.decrypt(encrypted, passphrase);
      decrypted.push(plaintext);
    }

    await fs.writeFile(outputPath, decrypted.join('\n'), 'utf8');
  }
}
```

---

## Privacy Controls

### User Transparency

**Privacy Dashboard (v1.5):**

GUI panel showing:
- **Data inventory**: What data ONE has collected
- **API usage**: How many cloud calls this month
- **Third parties**: Which services have accessed data (Deepgram, Anthropic)
- **Retention**: How long data is kept
- **Export**: Download all your data (JSON format)
- **Delete**: Purge all data permanently

**Example UI:**

```
┌─────────────────────────────────────────────────────┐
│ ONE Privacy Dashboard                                │
├─────────────────────────────────────────────────────┤
│                                                       │
│ Data Inventory:                                      │
│  • Commands logged: 2,847                           │
│  • Learned phrases: 142                             │
│  • Workflows: 8                                     │
│  • Voice recordings: 0 (disabled)                   │
│                                                       │
│ Cloud Usage (this month):                           │
│  • Deepgram API calls: 342                          │
│  • Anthropic API calls: 89                          │
│  • Cost estimate: $0.15                             │
│                                                       │
│ Third-Party Access:                                 │
│  • Deepgram (STT): 342 audio snippets sent          │
│  • Anthropic (intent): 89 text queries sent         │
│  • Retention: None (per privacy policy)             │
│                                                       │
│ Your Rights:                                         │
│  [Export All Data]  [Delete Everything]             │
│  [Disable Cloud]    [View Audit Log]                │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Data Minimization

**What We Collect:**

| Data Type | Purpose | Retention | User Control |
|-----------|---------|-----------|--------------|
| **Voice audio** | Transcription (cloud mode) | 0 days (not stored) | Disable cloud mode |
| **Command transcripts** | Learning, audit | 30 days | Disable history |
| **Learned phrases** | Personalization | Until user deletes | Manual delete |
| **App context** | Context-aware commands | Session only | Disable context detection |
| **Usage stats** | Performance, debugging | 90 days | Opt-out in settings |
| **Crash logs** | Bug fixes | 30 days | Opt-out (auto-disabled if opted out) |

**What We DON'T Collect:**
- ❌ Permanent voice recordings (unless user explicitly enables for debugging)
- ❌ Clipboard contents (unless command explicitly accesses clipboard)
- ❌ Screen contents (no screenshots)
- ❌ Keystrokes (only voice input)
- ❌ Location data
- ❌ Contacts, emails, messages (unless command explicitly accesses them)

### User Consent

**Granular Permissions (v1.5):**

On first launch:
```
┌─────────────────────────────────────────────────────┐
│ Welcome to ONE                                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│ ONE needs your permission to:                        │
│                                                       │
│ ☑ Access microphone (required for voice input)      │
│ ☑ Store commands locally (required for learning)    │
│                                                       │
│ Optional features:                                   │
│ ☐ Use cloud AI for better accuracy                  │
│   (sends audio to Deepgram, text to Anthropic)      │
│                                                       │
│ ☐ Collect anonymous usage stats                     │
│   (helps us improve ONE)                             │
│                                                       │
│ ☐ Keep voice recordings for 7 days                  │
│   (useful for debugging, disabled by default)       │
│                                                       │
│ You can change these anytime in Settings.           │
│                                                       │
│ [Privacy Policy] [Continue]                         │
│                                                       │
└─────────────────────────────────────────────────────┘
```

**Runtime Permissions:**

```javascript
// src/services/permissions.js

class PermissionManager {
  async requestPermission(permission, reason) {
    /*
    Permissions:
    - 'cloud_stt': Send audio to Deepgram
    - 'cloud_intent': Send text to Anthropic
    - 'file_read': Read files outside workspace
    - 'file_write': Write files outside workspace
    - 'network': Make arbitrary network calls
    - 'exec': Execute shell commands
    */

    // Check if already granted
    if (await this.hasPermission(permission)) {
      return true;
    }

    // Show dialog
    const granted = await this.showPermissionDialog(permission, reason);

    if (granted) {
      await this.savePermission(permission, true);
    }

    return granted;
  }

  showPermissionDialog(permission, reason) {
    const messages = {
      'cloud_stt': `ONE wants to send voice audio to Deepgram for transcription.\n\nReason: ${reason}\n\nAllow?`,
      'cloud_intent': `ONE wants to send text to Anthropic AI for understanding.\n\nReason: ${reason}\n\nAllow?`,
      'file_write': `ONE wants to write files outside your workspace.\n\nReason: ${reason}\n\nAllow?`,
      'exec': `ONE wants to execute a shell command.\n\nCommand: ${reason}\n\nAllow?`
    };

    return new Promise((resolve) => {
      const { dialog } = require('electron');
      dialog.showMessageBox({
        type: 'question',
        buttons: ['Allow', 'Deny', 'Always Allow'],
        defaultId: 1,
        title: 'Permission Request',
        message: messages[permission]
      }).then(({ response }) => {
        if (response === 0) resolve(true); // Allow once
        else if (response === 2) {
          this.savePermission(permission, true, { permanent: true });
          resolve(true);
        } else resolve(false); // Deny
      });
    });
  }
}
```

---

## Enterprise Security

### SOC 2 Type II Compliance

**Requirements:**

| Control | Implementation | Status |
|---------|----------------|--------|
| **Access Control** | Role-based access, MFA, least privilege | v2.5 |
| **Encryption** | AES-256 at rest, TLS 1.3 in transit | v1.5 |
| **Availability** | 99.9% uptime, disaster recovery | v2.0 |
| **Monitoring** | Audit logs, intrusion detection | v1.5 |
| **Change Management** | Git-based, peer review, CI/CD | ✅ v1.0 |
| **Vendor Management** | Third-party security assessments | v2.5 |

**Audit Process:**
- Annual SOC 2 audit by accredited firm (v2.5)
- Public report available to enterprise customers
- Continuous monitoring via SIEM integration

### Enterprise Features

**Centralized Management (v2.5):**

```javascript
// Enterprise admin console

{
  "organization": "Acme Corp",
  "policies": {
    "cloud_mode": "disabled",           // Force local-only
    "addons": "whitelist",              // Only approved addons
    "data_retention": 7,                // Max 7 days
    "mfa_required": true,               // Enforce 2FA
    "api_keys": "admin_managed"         // Admins control keys
  },
  "users": [
    {
      "email": "alice@acme.com",
      "role": "user",
      "quotas": {
        "cloud_calls_per_month": 1000,
        "agents_max": 3
      }
    },
    {
      "email": "bob@acme.com",
      "role": "admin",
      "quotas": "unlimited"
    }
  ],
  "audit": {
    "enabled": true,
    "retention_days": 365,
    "siem_export": "https://siem.acme.com/webhook"
  }
}
```

**SAML/SSO Integration (v2.5):**

```javascript
// src/services/enterprise-auth.js

class EnterpriseAuthService {
  async authenticateWithSAML(email) {
    // Redirect to company IdP (Okta, Azure AD, etc.)
    const samlRequest = this.generateSAMLRequest(email);
    const idpURL = await this.getIdPURL(email);

    // Open browser for SSO flow
    require('electron').shell.openExternal(`${idpURL}?SAMLRequest=${samlRequest}`);

    // Wait for callback with assertion
    const assertion = await this.waitForCallback();

    // Validate signature
    if (!this.validateAssertion(assertion)) {
      throw new Error('Invalid SAML assertion');
    }

    // Extract user info
    const user = this.parseAssertion(assertion);

    // Create session
    await this.createSession(user);

    return user;
  }

  async enforcePolicy(user, action) {
    const orgPolicy = await this.getOrganizationPolicy(user.org_id);

    if (action === 'cloud_stt' && orgPolicy.cloud_mode === 'disabled') {
      throw new Error('Cloud mode disabled by organization policy');
    }

    if (action === 'install_addon' && orgPolicy.addons === 'whitelist') {
      // Check if addon is whitelisted
      const whitelist = orgPolicy.addon_whitelist || [];
      if (!whitelist.includes(action.addon_id)) {
        throw new Error('Addon not approved by organization');
      }
    }

    return true;
  }
}
```

### Compliance Certifications

**Roadmap:**

| Certification | Requirement | Timeline | Cost Estimate |
|---------------|-------------|----------|---------------|
| **SOC 2 Type II** | Enterprise sales | v2.5 (2026) | $50K-$100K/year |
| **ISO 27001** | International customers | v3.0 (2027) | $30K-$50K/year |
| **HIPAA** | Healthcare customers | v3.5 (2028) | $100K-$200K |
| **FedRAMP** | US government | v4.0 (2029) | $500K-$1M |
| **GDPR** | EU customers | ✅ v1.5 (2025) | Self-certification |

---

## Incident Response

### Breach Protocol

**Detection:**
- Automated monitoring (intrusion detection, anomaly detection)
- User reports (security@one.com)
- Third-party disclosures (e.g., Deepgram data breach)

**Response Timeline:**

| Phase | Actions | Timeline |
|-------|---------|----------|
| **Hour 0-1** | Detect, confirm, assemble team | <1 hour |
| **Hour 1-4** | Contain breach, stop data loss | <4 hours |
| **Hour 4-24** | Investigate scope, notify affected users | <24 hours |
| **Day 1-7** | Remediate vulnerability, deploy fix | <7 days |
| **Day 7-30** | Post-mortem, policy updates, user compensation | <30 days |

**User Notification Template:**

```
Subject: Security Incident Notification

Dear ONE User,

We are writing to inform you of a security incident that may have affected your data.

WHAT HAPPENED:
On [DATE], we discovered [DESCRIPTION]. The vulnerability has been patched as of [DATE].

WHAT DATA WAS AFFECTED:
[LIST OF DATA TYPES: e.g., "Command history from [DATE RANGE]"]

WHAT WE'RE DOING:
• Patched the vulnerability immediately
• Notified law enforcement [if applicable]
• Engaged third-party security firm for audit
• Implementing additional safeguards

WHAT YOU SHOULD DO:
• Reset your API keys (Settings > Security)
• Review your recent command history (Settings > Privacy > View Audit Log)
• Enable two-factor authentication [if applicable]

We sincerely apologize for this incident. Security is our top priority.

Questions? Email security@one.com or visit [INCIDENT PAGE].

- The ONE Team
```

**Post-Mortem:**
- Public blog post (transparency)
- Root cause analysis
- Action items (prevent recurrence)
- Compensation (e.g., 3 months free Pro for affected users)

### Bug Bounty Program (v2.0)

**Scope:**
- ONE Core application
- ONE API endpoints (if public API launched)
- ONE website
- Cloud sync infrastructure (v2.0+)

**Rewards:**

| Severity | Description | Payout |
|----------|-------------|--------|
| **Critical** | RCE, API key exfiltration, privilege escalation | $5,000 - $10,000 |
| **High** | Auth bypass, data leak, XSS in GUI | $1,000 - $5,000 |
| **Medium** | CSRF, weak crypto, information disclosure | $500 - $1,000 |
| **Low** | Security misconfiguration, minor privacy leak | $100 - $500 |

**Process:**
1. Report to security@one.com (PGP key available)
2. Acknowledgment within 24 hours
3. Fix deployed within 30 days (critical), 90 days (high)
4. Public disclosure after fix (coordinated)
5. Researcher credited (if desired)

**Out of Scope:**
- Social engineering
- Physical attacks
- DoS attacks (please don't take down our servers)
- Issues in third-party dependencies (report to them directly)

---

## Open Source Security

### Dependency Management

**Vulnerability Scanning:**

```yaml
# .github/workflows/security.yml

name: Security Scan
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 0 * * 1' # Weekly

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # Dependency audit
      - name: npm audit
        run: npm audit --audit-level=moderate

      # Snyk scan
      - name: Snyk test
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      # SAST (static analysis)
      - name: Semgrep
        run: |
          pip install semgrep
          semgrep --config=auto

      # Secret scanning
      - name: Gitleaks
        uses: gitleaks/gitleaks-action@v2

      # License compliance
      - name: License check
        run: npx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-3-Clause'
```

**Dependency Pinning:**

```json
// package.json

{
  "dependencies": {
    "keytar": "7.9.0",          // Exact version (not ^7.9.0)
    "electron": "28.1.0",
    "fuse.js": "6.6.2"
  },
  "devDependencies": {
    "vitest": "1.0.4"
  },
  "overrides": {
    // Force secure versions of transitive deps
    "semver": "7.5.4"
  }
}
```

**Update Policy:**
- Critical security patches: Within 24 hours
- High severity: Within 7 days
- Medium/Low: Next minor release
- Major version bumps: Reviewed, tested, released in major version

### Code Review

**Security Checklist:**

Every PR must pass:
- [ ] No hardcoded secrets (API keys, passphrases)
- [ ] Input validation (sanitize user input)
- [ ] Output encoding (prevent XSS, command injection)
- [ ] Encryption (sensitive data encrypted at rest)
- [ ] Authentication (check permissions before executing)
- [ ] Audit logging (log security-relevant events)
- [ ] No `eval()` or `new Function()` (RCE risk)
- [ ] No `child_process.exec()` with unsanitized input
- [ ] TLS certificate validation (no `rejectUnauthorized: false`)

**Automated Checks:**

```javascript
// .eslintrc.js

module.exports = {
  plugins: ['security'],
  extends: ['plugin:security/recommended'],
  rules: {
    'security/detect-eval-with-expression': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-no-csrf-before-method-override': 'error'
  }
};
```

---

## Conclusion

Security and privacy are not features to be added later—they are the foundation of trust. ONE's architecture prioritizes local-first processing, end-to-end encryption, and radical transparency. By giving users full control over their data and meeting enterprise security standards, ONE will become the most trusted voice platform.

**Key Commitments:**
1. **Local-first by default** (80%+ commands never touch the cloud)
2. **Encryption everywhere** (at rest, in transit, in memory)
3. **User control** (export, delete, toggle cloud)
4. **Transparency** (annual audits, public reports)
5. **Continuous improvement** (bug bounty, community engagement)

---

**Document Owner:** dreamer
**Last Updated:** 2025-12-08
**Status:** Draft v1.0
**Next Review:** Post-v1.0 (incorporate security team feedback)
