# ONE Ecosystem Strategy

> Building a thriving community and marketplace around voice-first computing

## Vision Statement

Create a vibrant ecosystem where users, developers, and creators collaborate to extend ONE's capabilities through:
- **Command Packs** - Shareable command collections
- **Workflow Templates** - Pre-built automation sequences
- **Addons** - Third-party extensions and integrations
- **Voice Packs** - Custom TTS voices and wake words
- **Community Contributions** - Open-source improvements

This ecosystem transforms ONE from a product into a **platform**.

---

## The Ecosystem Flywheel

```
    ┌─────────────────────────────────────────┐
    │                                         │
    │   More Users                            │
    │      ↓                                  │
    │   Attract Developers                    │
    │      ↓                                  │
    │   More Extensions/Content               │
    │      ↓                                  │
    │   More Value for Users                  │
    │      ↓                                  │
    │   More Users (loop)                     │
    │                                         │
    └─────────────────────────────────────────┘
```

To kickstart this flywheel, we need:
1. Strong SDK and tooling (low friction for creators)
2. Discovery mechanisms (users find great content)
3. Creator incentives (developers earn money/recognition)
4. Quality curation (maintain high standards)

---

## Phase 1: Foundation (v1.5 - Export/Import)

**Goal:** Enable basic sharing of commands and workflows

### Export Format

```json
// my-commands.one-export.json
{
  "version": "1.0.0",
  "type": "command-collection",
  "exported_at": "2025-03-15T10:30:00Z",
  "exported_by": "ONE v1.5.0",

  "metadata": {
    "name": "My Developer Commands",
    "description": "Commands I use daily for web development",
    "author": "jessesep",
    "tags": ["development", "git", "npm", "terminal"]
  },

  "commands": [
    {
      "id": "cmd_1234",
      "phrases": ["ship it", "deploy"],
      "action": {
        "type": "workflow",
        "steps": [
          { "action": "terminal:npm test" },
          { "action": "terminal:git add ." },
          { "action": "terminal:git commit -m 'chore: deploy'" },
          { "action": "terminal:git push" }
        ]
      },
      "context": { "app": "*" },
      "created_at": "2025-03-10T08:00:00Z",
      "success_count": 47
    }
  ],

  "privacy": {
    "includes_usage_stats": true,
    "includes_personal_data": false
  }
}
```

### Import Flow

```
User receives .one-export.json file
    ↓
Opens in ONE
    ↓
ONE shows preview:
  - "My Developer Commands" by jessesep
  - 5 commands
  - Tags: development, git, npm
    ↓
User reviews each command:
  ☐ ship it → Run tests and deploy
  ☑ nuke modules → rm -rf node_modules && npm i
  ☐ show errors → npm run lint
    ↓
User clicks "Import Selected"
    ↓
ONE checks for conflicts:
  ⚠️ "ship it" already exists
  → Choose: Replace, Keep Both, Skip
    ↓
Commands imported to personal dictionary
```

### User Stories

**As a developer**, I want to export my work-related commands so I can use them on my home machine.

**As a team lead**, I want to share our team's git workflow commands with new hires.

**As a power user**, I want to import community-curated command packs for my favorite apps.

---

## Phase 2: Package Format & Registry (v1.8)

**Goal:** Standardized packages with versioning and discovery

### Package Format

```yaml
# one-package.yaml (manifest)
package:
  name: developer-essentials
  version: 2.1.0
  author: one-community
  license: MIT
  homepage: https://github.com/one-community/developer-essentials

  description: |
    Essential voice commands for software developers.
    Includes git, npm, terminal, and IDE shortcuts.

  categories:
    - development
    - productivity

  keywords:
    - git
    - npm
    - vscode
    - terminal

  compatibility:
    one_version: ">=1.8.0"
    platforms:
      - macos
      - linux

  dependencies:
    - package: github-cli
      version: "^1.0.0"
      optional: true

commands:
  - id: git-status
    phrases: ["git status", "show git status", "what's changed"]
    action:
      type: terminal
      command: git status
    description: Show git repository status
    context:
      app: "*"

  - id: deploy-prod
    phrases: ["deploy to production", "ship to prod"]
    action:
      type: workflow
      steps:
        - confirm: "Deploy to production?"
        - terminal: npm run build
        - terminal: npm run test
        - terminal: npm run deploy:prod
    description: Full production deployment workflow
    context:
      app: "*"
    dangerous: true  # requires confirmation

workflows:
  - id: morning-dev-setup
    name: Morning Dev Setup
    trigger_phrases: ["start my dev day", "morning setup"]
    steps:
      - app:open Terminal
      - app:open "Visual Studio Code"
      - terminal: cd ~/projects/current
      - terminal: git pull
      - terminal: npm install
    speak: "Dev environment ready"

metadata:
  screenshots:
    - url: ./screenshots/demo.png
      caption: "Example commands in action"

  changelog:
    - version: 2.1.0
      date: 2025-03-20
      changes:
        - Added deploy-prod workflow
        - Fixed git-status context detection

    - version: 2.0.0
      date: 2025-03-01
      changes:
        - Breaking: Changed workflow format
        - Added morning-dev-setup workflow

  stats:
    downloads: 1247
    rating: 4.8
    reviews: 89
```

### Package Registry

Community-hosted package registry at `packages.one-voice.com`:

```javascript
// Registry API
GET  /api/packages                    // List all packages
GET  /api/packages/search?q=git       // Search packages
GET  /api/packages/:name              // Get package details
GET  /api/packages/:name/:version     // Get specific version
POST /api/packages                    // Publish package (auth required)
GET  /api/users/:username/packages    // User's packages
```

### Package Discovery UI

```
┌─────────────────────────────────────────────────────────────┐
│  ONE Package Browser                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Search: "git workflows"]                    [Categories ▼] │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🏆 Featured                                            │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │                                                        │ │
│  │  📦 Developer Essentials              ⭐ 4.8  📥 1.2k │ │
│  │     Git, npm, terminal commands                       │ │
│  │     by one-community                                  │ │
│  │     [Install]                                         │ │
│  │                                                        │ │
│  │  📦 Spotify Voice Control             ⭐ 4.9  📥 847  │ │
│  │     Full voice control for Spotify                    │ │
│  │     by @musiclover                                    │ │
│  │     [Install]                                         │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🔥 Trending This Week                                 │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  📦 Ableton Producer Pack      ⭐ 4.7  📥 234         │ │
│  │  📦 Browser Tab Manager        ⭐ 4.6  📥 189         │ │
│  │  📦 Calendar Quick Actions     ⭐ 4.8  📥 156         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Addon SDK (v2.0)

**Goal:** Enable third-party developers to create deep integrations

### SDK Architecture

```javascript
// @one/sdk - The official ONE SDK

// 1. Simple command registration
import { registerCommand } from '@one/sdk';

registerCommand({
  phrases: ['what time is it', 'tell me the time'],
  handler: async () => {
    const time = new Date().toLocaleTimeString();
    return {
      speak: `It's ${time}`,
      display: time
    };
  }
});

// 2. Context-aware commands
import { registerCommand, getContext } from '@one/sdk';

registerCommand({
  phrases: ['summarize this'],
  context: { app: 'Safari' },
  handler: async () => {
    const context = await getContext();
    const url = context.safari.currentUrl;
    const summary = await summarizeWebpage(url);
    return { speak: summary };
  }
});

// 3. Full addon class
import { OneAddon } from '@one/sdk';

export default class NotionAddon extends OneAddon {
  name = 'notion-voice';
  version = '1.0.0';

  async onLoad() {
    // Initialize addon
    this.notionAPI = new NotionAPI(this.getConfig('api_key'));

    // Register commands
    this.registerCommand({
      phrases: ['add to inbox', 'note this'],
      handler: this.addToInbox.bind(this)
    });

    this.registerCommand({
      phrases: ['open my tasks', 'show tasks'],
      handler: this.openTasks.bind(this)
    });
  }

  async addToInbox({ transcript }) {
    await this.notionAPI.addPage({
      database: 'inbox',
      title: transcript,
      properties: {
        created: new Date(),
        source: 'voice'
      }
    });

    return { speak: 'Added to inbox' };
  }

  async openTasks() {
    const tasks = await this.notionAPI.query({
      database: 'tasks',
      filter: { status: { not_equals: 'Done' } }
    });

    await this.exec('app:open Notion');
    await this.exec('url:open https://notion.so/tasks');

    return {
      speak: `You have ${tasks.length} open tasks`,
      display: tasks.map(t => t.title).join('\n')
    };
  }

  onUnload() {
    // Cleanup
  }
}
```

### SDK API Surface

```typescript
// @one/sdk type definitions

interface OneAddon {
  name: string;
  version: string;
  description?: string;

  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
  onConfigChange?(config: Record<string, any>): Promise<void>;
}

interface CommandRegistration {
  phrases: string[];
  handler: CommandHandler;
  context?: ContextFilter;
  description?: string;
  examples?: string[];
}

type CommandHandler = (args: CommandArgs) => Promise<CommandResponse>;

interface CommandArgs {
  transcript: string;           // What user said
  normalizedTranscript: string; // Cleaned version
  context: Context;             // Current system context
  confidence: number;           // STT confidence (0-1)
}

interface CommandResponse {
  speak?: string;       // Text to speak back
  display?: string;     // Text to show in UI
  action?: Action;      // Action to execute
  defer?: boolean;      // Wait for user confirmation
}

interface Context {
  app: {
    name: string;       // Current focused app
    bundleId?: string;  // macOS bundle ID
    windowTitle?: string;
  };
  timestamp: Date;
  user: {
    id: string;
    preferences: Record<string, any>;
  };
}

// Utility functions
function registerCommand(command: CommandRegistration): void;
function unregisterCommand(id: string): void;
function getContext(): Promise<Context>;
function exec(action: string): Promise<void>;
function speak(text: string): Promise<void>;
function notify(title: string, body: string): Promise<void>;
function getConfig(key: string): any;
function setConfig(key: string, value: any): Promise<void>;
function log(level: 'info' | 'warn' | 'error', message: string): void;
```

### Example Addons

#### 1. Spotify Integration

```javascript
// one-addon-spotify
export default class SpotifyAddon extends OneAddon {
  name = 'spotify';

  async onLoad() {
    this.spotify = new SpotifyAPI(this.getConfig('access_token'));

    this.registerCommands([
      {
        phrases: ['play some music', 'music time'],
        handler: () => this.spotify.play()
      },
      {
        phrases: ['pause music', 'stop playing'],
        handler: () => this.spotify.pause()
      },
      {
        phrases: ['next song', 'skip'],
        handler: () => this.spotify.next()
      },
      {
        phrases: ['what is this', 'what song'],
        handler: async () => {
          const track = await this.spotify.getCurrentTrack();
          return { speak: `${track.name} by ${track.artist}` };
        }
      },
      {
        phrases: ['play {playlist}'],
        handler: async ({ slots }) => {
          await this.spotify.playPlaylist(slots.playlist);
          return { speak: `Playing ${slots.playlist}` };
        }
      }
    ]);
  }
}
```

#### 2. GitHub Integration

```javascript
// one-addon-github
export default class GitHubAddon extends OneAddon {
  name = 'github';

  async onLoad() {
    this.gh = new Octokit({ auth: this.getConfig('token') });

    this.registerCommands([
      {
        phrases: ['show my pull requests', 'my PRs'],
        handler: async () => {
          const prs = await this.gh.pulls.list({
            owner: 'me',
            state: 'open'
          });
          return {
            speak: `You have ${prs.length} open pull requests`,
            display: prs.map(pr => `#${pr.number}: ${pr.title}`).join('\n')
          };
        }
      },
      {
        phrases: ['create issue {title}'],
        handler: async ({ slots }) => {
          const issue = await this.gh.issues.create({
            owner: this.getConfig('default_owner'),
            repo: this.getConfig('default_repo'),
            title: slots.title
          });
          return { speak: `Created issue #${issue.number}` };
        }
      }
    ]);
  }
}
```

#### 3. Home Assistant Integration

```javascript
// one-addon-homeassistant
export default class HomeAssistantAddon extends OneAddon {
  name = 'homeassistant';

  async onLoad() {
    this.ha = new HomeAssistantAPI({
      url: this.getConfig('ha_url'),
      token: this.getConfig('ha_token')
    });

    this.registerCommands([
      {
        phrases: ['turn on {device}', 'lights on'],
        handler: async ({ slots }) => {
          await this.ha.turnOn(slots.device || 'lights');
          return { speak: 'Done' };
        }
      },
      {
        phrases: ['set thermostat to {temp}'],
        handler: async ({ slots }) => {
          await this.ha.setTemperature('thermostat', slots.temp);
          return { speak: `Set to ${slots.temp} degrees` };
        }
      },
      {
        phrases: ['good night'],
        handler: async () => {
          await this.ha.runScene('goodnight');
          return { speak: 'Good night' };
        }
      }
    ]);
  }
}
```

---

## Phase 4: Marketplace (v2.2)

**Goal:** Monetization and creator economy

### Monetization Options

#### 1. Free Packages
- Community contributions
- Open source
- Attribution required

#### 2. Paid Packages
- One-time purchase ($0.99 - $49.99)
- Creator sets price
- ONE takes 30% (similar to app stores)
- Refund window: 14 days

#### 3. Subscription Packages
- Monthly/yearly subscriptions
- For packages with ongoing costs (API usage)
- Creator sets price
- ONE takes 30%

#### 4. Donations
- "Pay what you want"
- Sponsor creators via GitHub Sponsors integration
- ONE takes 0% (encourages community)

### Creator Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Creator Dashboard - @jessesep                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 Overview                                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Total Downloads: 1,247                                │ │
│  │  Total Revenue: $347.20                                │ │
│  │  Avg Rating: 4.8 ⭐                                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  📦 Your Packages                                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Developer Essentials        v2.1.0                    │ │
│  │  Downloads: 1,247  Revenue: $0 (free)                  │ │
│  │  Rating: 4.8 ⭐ (89 reviews)                           │ │
│  │  [Edit] [Analytics] [Reviews]                          │ │
│  │                                                        │ │
│  │  Spotify Premium Control     v1.3.0                    │ │
│  │  Downloads: 347  Revenue: $347.20 ($0.99 each)         │ │
│  │  Rating: 4.9 ⭐ (47 reviews)                           │ │
│  │  [Edit] [Analytics] [Reviews]                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  💰 Earnings (Last 30 Days)                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Spotify Premium Control:  $127.40                     │ │
│  │  Payout on: Dec 15, 2025                               │ │
│  │  [View Details] [Payout Settings]                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [+ Create New Package]                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Review System

```yaml
# Review structure
review:
  user: "@musiclover"
  package: "spotify-voice-control"
  version: "1.3.0"
  rating: 5
  title: "Game changer for music control"
  body: |
    I use this every day while working. Being able to control Spotify
    without leaving my keyboard is amazing. The voice recognition is
    spot-on and it works with all my playlists.

  helpful_count: 23
  created_at: "2025-03-15T14:30:00Z"

  creator_response:
    body: "Thanks! Glad you're enjoying it. v1.4 will add liked songs support!"
    created_at: "2025-03-15T18:00:00Z"
```

### Quality Standards

All marketplace packages must:

1. **Pass automated tests**
   - No malicious code
   - No network calls without disclosure
   - No file system access beyond ~/.config/one/
   - Command phrases don't conflict with core commands

2. **Meet documentation requirements**
   - Clear description
   - List of all commands
   - Required permissions
   - Privacy policy (if collecting data)

3. **Versioning compliance**
   - Semantic versioning (major.minor.patch)
   - Changelog for each version
   - Breaking changes clearly marked

4. **User safety**
   - Dangerous commands require confirmation
   - No auto-execution of destructive actions
   - Clear warnings for system-level operations

---

## Community Programs

### 1. ONE Ambassador Program

Select power users to:
- Create educational content
- Provide support in forums
- Test beta features
- Receive early access + swag

**Benefits:**
- Ambassador badge in forums
- Free ONE Pro subscription
- Direct line to product team
- Annual summit invitation

### 2. Bounty Program

Community can propose features with bounties:

```
Feature Request: "Linux Support"
Bounty: $500 (community-funded)
Status: In Progress by @linux-dev
Deadline: 2025-06-30
```

When completed and merged:
- Developer receives bounty
- Funders receive contributor badge

### 3. Educational Partnership

Partner with:
- Bootcamps (give students free ONE Pro)
- Universities (research collaborations)
- Online courses (integration tutorials)

**Goal:** Build next generation of voice-first developers

---

## Ecosystem Governance

### Decision Making

```
Core ONE Team
    ↓
  Decides: Core features, API design, breaking changes

Community Advisory Board (5-7 members)
    ↓
  Advises on: Marketplace policies, SDK direction, community needs

Community (GitHub Discussions)
    ↓
  Proposes: Feature requests, bug reports, package ideas
```

### Package Review Process

1. **Automated Review** (instant)
   - Security scan
   - Code quality check
   - Test coverage > 50%

2. **Human Review** (24-48 hours)
   - ONE team reviews for quality
   - Checks documentation
   - Tests functionality

3. **Community Feedback** (ongoing)
   - Users report issues
   - Ratings and reviews
   - Package can be unlisted if quality drops

### Dispute Resolution

For conflicts (trademark issues, code plagiarism, policy violations):

1. User reports issue
2. ONE team investigates (7 days)
3. Decision communicated to both parties
4. Appeal process available (reviewed by board)

---

## Success Metrics

### Year 1 (v1.5 - v2.0)
- 50+ community packages
- 10,000+ package downloads
- 100+ active addon developers
- 5,000+ ONE users

### Year 2 (v2.0 - v2.5)
- 200+ community packages
- 100,000+ package downloads
- 500+ active addon developers
- 25,000+ ONE users
- $50k+ creator earnings

### Year 3 (v2.5+)
- 500+ community packages
- 1M+ package downloads
- 2,000+ active addon developers
- 100,000+ ONE users
- $500k+ creator earnings

---

## Open Questions

1. **Curation vs Open**
   - Should marketplace be fully open or curated?
   - How do we balance quality with accessibility?

2. **Revenue Share**
   - Is 30% fair, or should it be lower for small creators?
   - Should ONE take 0% initially to kickstart ecosystem?

3. **Package Discovery**
   - Algorithm-based (like YouTube) or editorial (like Product Hunt)?
   - How do we prevent gaming the system?

4. **Cross-Platform Packages**
   - Should packages work on all platforms or can they be platform-specific?
   - How do we handle platform-specific commands?

5. **Enterprise Packages**
   - Should we allow private enterprise packages?
   - What's the pricing model for team-wide deployments?

---

## Next Steps

1. **Implement Export/Import** (v1.5) - Get basic sharing working
2. **Design Package Format** - Finalize YAML schema
3. **Build Registry Infrastructure** - Backend for package hosting
4. **Create SDK** - Developer tools and documentation
5. **Launch Beta Marketplace** - Invite 10-20 creators for early access
6. **Gather Feedback** - Iterate based on creator needs
7. **Public Launch** - Open marketplace to all

---

*Last updated: 2025-12-08 by dreamer*
