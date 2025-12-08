# Multi-Agent Development Setup

This project uses a multi-agent Claude orchestration system for parallel development.

## Active Agents

### Supervisor
- **Role**: Coordination and task assignment
- **Scope**: All files (read-only, assigns work)
- **Responsibilities**: Break down features, assign tasks, resolve conflicts, review work

### Thinker
- **Role**: Planning, vision, documentation
- **Scope**: `.planning/`, `docs/`
- **Current Work**: Phase 2 planning (Training Mode, Learning Loop)
- **Completed**:
  - VISION.md
  - AI-COMMAND-SYSTEM.md
  - TRAINING-MODE.md
  - ROADMAP.md
  - SECURE-STORAGE.md
  - PERSONAL-DICTIONARY.md
  - LEARNING-LOOP.md

### Builder
- **Role**: Implementation and code changes
- **Scope**: `src/`, `gui/`, `addons/`, `swift/`
- **Current Work**: Phase 1.1 (Secure Storage with keytar)
- **Completed**:
  - Phase 1.3: IntentResolver service
  - Phase 1.4: Transcript pipeline integration

## Starting the Team

### Terminal 1 - Supervisor
```bash
cd /Users/jessesep/Downloads/hear-0.7/speech2type
claude "/project-open speech2type"
```

### Terminal 2 - Thinker
```bash
cd /Users/jessesep/Downloads/hear-0.7/speech2type
claude "/agent-start thinker"
```

### Terminal 3 - Builder
```bash
cd /Users/jessesep/Downloads/hear-0.7/speech2type
claude "/agent-start builder"
```

## Communication

Agents communicate via inbox files at `~/.claude/multiagent/inbox/`:
- `supervisor.jsonl` - Messages to supervisor
- `thinker.jsonl` - Messages to thinker
- `builder.jsonl` - Messages to builder

## File Ownership

| Directory | Owner | Purpose |
|-----------|-------|---------|
| `.planning/` | thinker | Specs, designs, roadmaps |
| `docs/` | thinker | User documentation |
| `src/` | builder | Core application code |
| `gui/` | builder | GUI components |
| `addons/` | builder | Plugin system |
| `swift/` | builder | Native macOS code |

## Workflow

1. User talks to **Supervisor** only
2. Supervisor breaks down work and assigns to agents
3. Thinker writes specs, Builder implements
4. Agents message supervisor with progress/questions
5. Supervisor reviews and coordinates

## Saving/Restoring

```bash
# Save current state before closing
/project-save speech2type

# Restore later
/project-open speech2type
```
