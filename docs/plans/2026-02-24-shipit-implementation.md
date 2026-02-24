# ShipIt Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone Claude Code plugin that unifies the best of superpowers (TDD), GSD (state/task decomposition), and Ralph Loop (auto-loop) into 8 commands.

**Architecture:** Plugin follows Claude Code's standard structure: `.claude-plugin/plugin.json` manifest, `hooks/` for SessionStart and Stop hooks, `commands/` for slash commands, `agents/` for specialized AI agents, `skills/` for reference knowledge, `bin/` for CLI tooling, and `scripts/` for bash utilities. State lives in per-project `.shipit/` directories.

**Tech Stack:** Bash (hooks, scripts), Node.js (CLI tool), Markdown with YAML frontmatter (commands, agents, skills)

---

### Task 1: Plugin Manifest and Directory Structure

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `LICENSE`

**Step 1: Create plugin manifest**

```json
{
  "name": "shipit",
  "description": "Unified development plugin: auto-loop execution, TDD enforcement, persistent state, and smart task decomposition. One command to ship features.",
  "version": "1.0.0",
  "author": {
    "name": "tops"
  },
  "license": "MIT",
  "keywords": ["shipping", "tdd", "auto-loop", "task-decomposition", "state-management", "autonomous"]
}
```

Save to `.claude-plugin/plugin.json`.

**Step 2: Create LICENSE**

Create `LICENSE` with standard MIT license text, year 2026, author "tops".

**Step 3: Create empty directory structure**

```bash
mkdir -p hooks commands agents skills/shipit-core skills/tdd bin templates scripts
```

**Step 4: Commit**

```bash
git add .claude-plugin/plugin.json LICENSE
git commit -m "feat: add plugin manifest and license"
```

---

### Task 2: Hook Configuration and SessionStart Hook

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/session-start.sh`

**Step 1: Create hooks.json**

This registers both the SessionStart hook (injects shipit awareness) and the Stop hook (auto-loop).

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh",
            "async": false
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/stop-hook.sh"
          }
        ]
      }
    ]
  }
}
```

Save to `hooks/hooks.json`.

**Step 2: Create session-start.sh**

This injects the shipit-core skill content at session start so Claude knows about shipit commands.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read core skill content
core_content=$(cat "${PLUGIN_ROOT}/skills/shipit-core/SKILL.md" 2>&1 || echo "Error reading shipit-core skill")

# Escape string for JSON embedding
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

core_escaped=$(escape_for_json "$core_content")
session_context="<IMPORTANT>\nYou have ShipIt installed.\n\n${core_escaped}\n</IMPORTANT>"

cat <<EOF
{
  "additional_context": "${session_context}",
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "${session_context}"
  }
}
EOF

exit 0
```

Save to `hooks/session-start.sh`.

```bash
chmod +x hooks/session-start.sh
```

**Step 3: Commit**

```bash
git add hooks/hooks.json hooks/session-start.sh
git commit -m "feat: add hook configuration and session-start hook"
```

---

### Task 3: Stop Hook (Auto-Loop Mechanism)

**Files:**
- Create: `hooks/stop-hook.sh`

**Step 1: Create stop-hook.sh**

This is the core loop engine. It intercepts session exit, checks `.shipit/loop.md` state, and either continues the loop or lets Claude exit.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Check if shipit loop is active
LOOP_STATE_FILE=".shipit/loop.md"

if [[ ! -f "$LOOP_STATE_FILE" ]]; then
  exit 0
fi

# Parse YAML frontmatter
FRONTMATTER=$(sed -n '/^---$/,/^---$/{ /^---$/d; p; }' "$LOOP_STATE_FILE")
ACTIVE=$(echo "$FRONTMATTER" | grep '^active:' | sed 's/active: *//')
ITERATION=$(echo "$FRONTMATTER" | grep '^iteration:' | sed 's/iteration: *//')
MAX_ITERATIONS=$(echo "$FRONTMATTER" | grep '^max_iterations:' | sed 's/max_iterations: *//')
TASKS_TOTAL=$(echo "$FRONTMATTER" | grep '^tasks_total:' | sed 's/tasks_total: *//')
TASKS_COMPLETED=$(echo "$FRONTMATTER" | grep '^tasks_completed:' | sed 's/tasks_completed: *//')

# If not active, allow exit
if [[ "$ACTIVE" != "true" ]]; then
  exit 0
fi

# Validate numeric fields
for field_name in ITERATION MAX_ITERATIONS; do
  field_val="${!field_name}"
  if [[ ! "$field_val" =~ ^[0-9]+$ ]]; then
    echo "Warning: ShipIt loop state corrupted ($field_name='$field_val'). Stopping loop." >&2
    rm "$LOOP_STATE_FILE"
    exit 0
  fi
done

# Check max iterations
if [[ $MAX_ITERATIONS -gt 0 ]] && [[ $ITERATION -ge $MAX_ITERATIONS ]]; then
  echo "ShipIt: Max iterations ($MAX_ITERATIONS) reached. Tasks completed: ${TASKS_COMPLETED:-0}/${TASKS_TOTAL:-?}"
  rm "$LOOP_STATE_FILE"
  exit 0
fi

# Check if all tasks complete by reading STATE.md
STATE_FILE=".shipit/STATE.md"
if [[ -f "$STATE_FILE" ]]; then
  # Look for completion marker in STATE.md
  if grep -q '^status: complete' "$STATE_FILE" 2>/dev/null; then
    echo "ShipIt: All tasks complete!"
    rm "$LOOP_STATE_FILE"
    exit 0
  fi
fi

# Get transcript path and check for blocker signals
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path' 2>/dev/null || echo "")

if [[ -n "$TRANSCRIPT_PATH" ]] && [[ -f "$TRANSCRIPT_PATH" ]]; then
  # Check if last message contains a blocker signal
  LAST_LINE=$(grep '"role":"assistant"' "$TRANSCRIPT_PATH" | tail -1 || true)
  if [[ -n "$LAST_LINE" ]]; then
    LAST_OUTPUT=$(echo "$LAST_LINE" | jq -r '
      .message.content |
      map(select(.type == "text")) |
      map(.text) |
      join("\n")
    ' 2>/dev/null || echo "")

    # Check for explicit stop signal
    if echo "$LAST_OUTPUT" | grep -q '<shipit-done/>' 2>/dev/null; then
      rm "$LOOP_STATE_FILE"
      exit 0
    fi

    # Check for blocker signal
    if echo "$LAST_OUTPUT" | grep -q '<shipit-blocked>' 2>/dev/null; then
      rm "$LOOP_STATE_FILE"
      exit 0
    fi
  fi
fi

# Continue loop — increment iteration
NEXT_ITERATION=$((ITERATION + 1))

# Update iteration in state file atomically
TEMP_FILE="${LOOP_STATE_FILE}.tmp.$$"
sed "s/^iteration: .*/iteration: $NEXT_ITERATION/" "$LOOP_STATE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$LOOP_STATE_FILE"

# Extract the task description from after the frontmatter
TASK_TEXT=$(awk '/^---$/{i++; next} i>=2' "$LOOP_STATE_FILE")

# Build continuation prompt
CONTINUE_PROMPT="Continue working. Read .shipit/STATE.md for current position and .shipit/PLAN.md for the plan. Use TDD for implementation tasks. Update STATE.md after completing each task. When all tasks are done, output <shipit-done/> to exit the loop. If you hit a blocker that needs user input, output <shipit-blocked>description</shipit-blocked>."

SYSTEM_MSG="ShipIt iteration $NEXT_ITERATION | Tasks: ${TASKS_COMPLETED:-0}/${TASKS_TOTAL:-?} | To finish: <shipit-done/>"

jq -n \
  --arg prompt "$CONTINUE_PROMPT" \
  --arg msg "$SYSTEM_MSG" \
  '{
    "decision": "block",
    "reason": $prompt,
    "systemMessage": $msg
  }'

exit 0
```

Save to `hooks/stop-hook.sh`.

```bash
chmod +x hooks/stop-hook.sh
```

**Step 2: Verify hook script has no syntax errors**

```bash
bash -n hooks/stop-hook.sh
```

Expected: No output (clean syntax)

**Step 3: Commit**

```bash
git add hooks/stop-hook.sh
git commit -m "feat: add stop hook for auto-loop mechanism"
```

---

### Task 4: State Management CLI Tool

**Files:**
- Create: `bin/shipit-tools.cjs`
- Create: `bin/shipit-tools.test.cjs`

**Step 1: Write the failing test**

```javascript
#!/usr/bin/env node
// bin/shipit-tools.test.cjs
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TOOL = path.join(__dirname, 'shipit-tools.cjs');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shipit-test-'));

function run(cmd, cwd = tmpDir) {
  return execSync(`node ${TOOL} ${cmd}`, { cwd, encoding: 'utf8' }).trim();
}

function setup() {
  fs.mkdirSync(path.join(tmpDir, '.shipit'), { recursive: true });
}

// Test: state init creates STATE.md and config.json
try {
  setup();
  run('state init "test-project"');
  const statePath = path.join(tmpDir, '.shipit', 'STATE.md');
  const configPath = path.join(tmpDir, '.shipit', 'config.json');
  console.assert(fs.existsSync(statePath), 'STATE.md should exist');
  console.assert(fs.existsSync(configPath), 'config.json should exist');
  const state = fs.readFileSync(statePath, 'utf8');
  console.assert(state.includes('test-project'), 'STATE.md should contain project name');
  console.log('PASS: state init');
} catch (e) {
  console.error('FAIL: state init -', e.message);
  process.exit(1);
}

// Test: state update modifies STATE.md fields
try {
  run('state update status "in_progress"');
  const state = fs.readFileSync(path.join(tmpDir, '.shipit', 'STATE.md'), 'utf8');
  console.assert(state.includes('status: in_progress'), 'status should be updated');
  console.log('PASS: state update');
} catch (e) {
  console.error('FAIL: state update -', e.message);
  process.exit(1);
}

// Test: state load returns JSON
try {
  const output = run('state load');
  const parsed = JSON.parse(output);
  console.assert(parsed.project === 'test-project', 'should parse project name');
  console.assert(parsed.status === 'in_progress', 'should parse status');
  console.log('PASS: state load');
} catch (e) {
  console.error('FAIL: state load -', e.message);
  process.exit(1);
}

// Test: plan create produces PLAN.md
try {
  run('plan create "Build auth" --tasks 3');
  const planPath = path.join(tmpDir, '.shipit', 'PLAN.md');
  console.assert(fs.existsSync(planPath), 'PLAN.md should exist');
  const plan = fs.readFileSync(planPath, 'utf8');
  console.assert(plan.includes('Build auth'), 'PLAN.md should contain task description');
  console.log('PASS: plan create');
} catch (e) {
  console.error('FAIL: plan create -', e.message);
  process.exit(1);
}

// Test: loop activate creates loop.md
try {
  run('loop activate "do the thing" --max-iterations 25');
  const loopPath = path.join(tmpDir, '.shipit', 'loop.md');
  console.assert(fs.existsSync(loopPath), 'loop.md should exist');
  const loop = fs.readFileSync(loopPath, 'utf8');
  console.assert(loop.includes('active: true'), 'should be active');
  console.assert(loop.includes('max_iterations: 25'), 'should have max iterations');
  console.log('PASS: loop activate');
} catch (e) {
  console.error('FAIL: loop activate -', e.message);
  process.exit(1);
}

// Test: loop deactivate removes loop.md
try {
  run('loop deactivate');
  const loopPath = path.join(tmpDir, '.shipit', 'loop.md');
  console.assert(!fs.existsSync(loopPath), 'loop.md should be removed');
  console.log('PASS: loop deactivate');
} catch (e) {
  console.error('FAIL: loop deactivate -', e.message);
  process.exit(1);
}

// Test: timestamp
try {
  const ts = run('timestamp');
  console.assert(/^\d{4}-\d{2}-\d{2}T/.test(ts), 'should be ISO format');
  console.log('PASS: timestamp');
} catch (e) {
  console.error('FAIL: timestamp -', e.message);
  process.exit(1);
}

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('\nAll tests passed!');
```

Save to `bin/shipit-tools.test.cjs`.

**Step 2: Run tests to verify they fail**

```bash
node bin/shipit-tools.test.cjs
```

Expected: FAIL (shipit-tools.cjs doesn't exist yet)

**Step 3: Write the implementation**

```javascript
#!/usr/bin/env node
// bin/shipit-tools.cjs
// Central CLI for ShipIt state management

const fs = require('fs');
const path = require('path');

const SHIPIT_DIR = '.shipit';

// ── Helpers ──

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function shipitPath(...parts) {
  return path.join(process.cwd(), SHIPIT_DIR, ...parts);
}

function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {}, body: '' };
  const meta = {};
  match[1].split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (/^\d+$/.test(val)) val = parseInt(val, 10);
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      meta[key] = val;
    }
  });
  const body = content.slice(match[0].length).trim();
  return { meta, body };
}

function writeFrontmatter(filePath, meta, body = '') {
  const lines = Object.entries(meta).map(([k, v]) => {
    if (typeof v === 'string' && v.includes(' ')) return `${k}: "${v}"`;
    return `${k}: ${v}`;
  });
  const content = `---\n${lines.join('\n')}\n---\n\n${body}\n`;
  fs.writeFileSync(filePath, content);
}

function updateFrontmatterField(filePath, field, value) {
  const content = fs.readFileSync(filePath, 'utf8');
  const regex = new RegExp(`^${field}:.*$`, 'm');
  let newVal = typeof value === 'string' && value.includes(' ') ? `${field}: "${value}"` : `${field}: ${value}`;
  let updated;
  if (regex.test(content)) {
    updated = content.replace(regex, newVal);
  } else {
    // Add field before closing ---
    updated = content.replace(/\n---/, `\n${newVal}\n---`);
  }
  fs.writeFileSync(filePath, updated);
}

function now() {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

// ── Commands ──

const commands = {
  'state': {
    'init': (args) => {
      const name = args[0] || 'unnamed-project';
      ensureDir(shipitPath());

      // STATE.md
      writeFrontmatter(shipitPath('STATE.md'), {
        project: name,
        status: 'idle',
        current_task: 0,
        total_tasks: 0,
        updated_at: now()
      }, `# ${name}\n\nNo active plan.`);

      // config.json
      const config = {
        tdd: true,
        auto_loop: true,
        max_iterations: 50,
        model_preference: 'balanced',
        auto_commit: true,
        parallel_execution: true,
        max_parallel_agents: 3
      };
      fs.writeFileSync(shipitPath('config.json'), JSON.stringify(config, null, 2));

      console.log(JSON.stringify({ ok: true, project: name }));
    },

    'load': () => {
      const statePath = shipitPath('STATE.md');
      if (!fs.existsSync(statePath)) {
        console.log(JSON.stringify({ error: 'No .shipit/STATE.md found' }));
        process.exit(1);
      }
      const { meta, body } = readFrontmatter(statePath);
      const configPath = shipitPath('config.json');
      let config = {};
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      console.log(JSON.stringify({ ...meta, config, body }));
    },

    'update': (args) => {
      const [field, value] = args;
      if (!field || value === undefined) {
        console.error('Usage: state update <field> <value>');
        process.exit(1);
      }
      const statePath = shipitPath('STATE.md');
      updateFrontmatterField(statePath, field, value);
      updateFrontmatterField(statePath, 'updated_at', now());
      console.log(JSON.stringify({ ok: true, field, value }));
    }
  },

  'plan': {
    'create': (args) => {
      const description = args[0] || 'Unnamed plan';
      let taskCount = 0;
      const tasksIdx = args.indexOf('--tasks');
      if (tasksIdx >= 0 && args[tasksIdx + 1]) {
        taskCount = parseInt(args[tasksIdx + 1], 10);
      }

      ensureDir(shipitPath());
      writeFrontmatter(shipitPath('PLAN.md'), {
        task: description,
        total_tasks: taskCount,
        completed_tasks: 0,
        created_at: now(),
        status: 'pending'
      }, `# Plan: ${description}\n\n<!-- Tasks will be filled by shipit-planner agent -->`);

      console.log(JSON.stringify({ ok: true, plan: description, tasks: taskCount }));
    }
  },

  'loop': {
    'activate': (args) => {
      const task = args[0] || '';
      let maxIter = 50;
      const maxIdx = args.indexOf('--max-iterations');
      if (maxIdx >= 0 && args[maxIdx + 1]) {
        maxIter = parseInt(args[maxIdx + 1], 10);
      }

      ensureDir(shipitPath());
      writeFrontmatter(shipitPath('loop.md'), {
        active: true,
        iteration: 1,
        max_iterations: maxIter,
        started_at: now(),
        tasks_total: 0,
        tasks_completed: 0
      }, task);

      console.log(JSON.stringify({ ok: true, max_iterations: maxIter }));
    },

    'deactivate': () => {
      const loopPath = shipitPath('loop.md');
      if (fs.existsSync(loopPath)) {
        fs.unlinkSync(loopPath);
      }
      console.log(JSON.stringify({ ok: true }));
    }
  },

  'timestamp': () => {
    console.log(now());
  }
};

// ── CLI Router ──

const args = process.argv.slice(2);
const cmd = args[0];
const sub = args[1];
const rest = args.slice(2);

if (cmd === 'timestamp') {
  commands.timestamp();
} else if (commands[cmd] && commands[cmd][sub]) {
  commands[cmd][sub](rest);
} else {
  console.error(`Usage: shipit-tools <command> <subcommand> [args]`);
  console.error(`Commands: state (init|load|update), plan (create), loop (activate|deactivate), timestamp`);
  process.exit(1);
}
```

Save to `bin/shipit-tools.cjs`.

**Step 4: Run tests to verify they pass**

```bash
node bin/shipit-tools.test.cjs
```

Expected: All tests passed!

**Step 5: Commit**

```bash
git add bin/shipit-tools.cjs bin/shipit-tools.test.cjs
git commit -m "feat: add shipit-tools CLI for state management"
```

---

### Task 5: Templates

**Files:**
- Create: `templates/project.md`
- Create: `templates/state.md`

**Step 1: Create project template**

```markdown
---
name: {{PROJECT_NAME}}
created_at: {{TIMESTAMP}}
---

# {{PROJECT_NAME}}

## What

<!-- One sentence: what does this project do? -->

## Core Value

<!-- The ONE thing that matters most -->

## Tech Stack

<!-- Key technologies -->

## Constraints

<!-- Hard limits, deadlines, requirements -->
```

Save to `templates/project.md`.

**Step 2: Create state template**

```markdown
---
project: {{PROJECT_NAME}}
status: idle
current_task: 0
total_tasks: 0
updated_at: {{TIMESTAMP}}
---

# {{PROJECT_NAME}}

No active plan.

## Recent Activity

<!-- Auto-updated by shipit -->

## Blockers

<!-- Any issues requiring user input -->
```

Save to `templates/state.md`.

**Step 3: Commit**

```bash
git add templates/project.md templates/state.md
git commit -m "feat: add project and state templates"
```

---

### Task 6: Core Skill and TDD Skill

**Files:**
- Create: `skills/shipit-core/SKILL.md`
- Create: `skills/tdd/SKILL.md`

**Step 1: Create shipit-core skill**

This is injected at SessionStart to make Claude aware of shipit.

```markdown
---
name: shipit-core
description: Core ShipIt plugin awareness - injected at session start
---

# ShipIt

ShipIt is your unified development plugin. It combines auto-loop execution, TDD enforcement, persistent state, and smart task decomposition into 8 commands.

## Commands

| Command | Purpose |
|---------|---------|
| `/shipit:go <task>` | Smart router — auto-detects complexity, plans, executes, loops until done |
| `/shipit:plan <desc>` | Quick brainstorm + plan — review before executing |
| `/shipit:init [name]` | Lightweight project setup — creates .shipit/ with PROJECT.md |
| `/shipit:resume` | Resume from last session — reads STATE.md and continues |
| `/shipit:status` | Show current progress — tasks, completion %, blockers |
| `/shipit:debug <issue>` | Systematic debugging with persistent state |
| `/shipit:done` | Verify + finish — runs tests, reviews diff, offers commit/PR |
| `/shipit:help` | Show usage guide |

## How It Works

1. **`/shipit:go`** is the main command. Use it for 90% of work.
2. It auto-detects task complexity (quick/medium/large) and routes accordingly.
3. For medium/large tasks, it spawns a planner agent to break work into atomic steps.
4. Each step is executed with TDD (test first, then implement, then verify).
5. An auto-loop keeps Claude working until all tasks complete or a blocker is hit.
6. State persists in `.shipit/` so you can resume across sessions.

## Auto-Loop Signals

- `<shipit-done/>` — Output this when all work is complete to exit the loop
- `<shipit-blocked>description</shipit-blocked>` — Output this when you need user input

## State Files

- `.shipit/PROJECT.md` — What we're building
- `.shipit/STATE.md` — Current position and progress
- `.shipit/PLAN.md` — Active plan with tasks
- `.shipit/config.json` — Preferences
- `.shipit/loop.md` — Loop state (auto-managed)

## Principles

1. **TDD by default** — Write the failing test first, always
2. **Atomic commits** — One commit per completed task
3. **Maximum autonomy** — Keep going until done or blocked
4. **Flat state** — No deep hierarchies, just the files you need
```

Save to `skills/shipit-core/SKILL.md`.

**Step 2: Create TDD skill**

This is a condensed version of the superpowers TDD skill, referenced by the executor agent.

```markdown
---
name: tdd
description: TDD reference for ShipIt executor — RED GREEN REFACTOR cycle
---

# TDD: Red-Green-Refactor

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Wrote code before the test? Delete it. Start over. No exceptions.

## The Cycle

### RED — Write Failing Test
- One test, one behavior
- Clear name describing what should happen
- Use real code, not mocks (unless truly unavoidable)
- Run it. Confirm it FAILS. Confirm it fails for the RIGHT reason.

### GREEN — Minimal Code
- Write the simplest code that makes the test pass
- No extra features, no refactoring, no "improvements"
- Run tests. ALL must pass.

### REFACTOR — Clean Up
- Only after green
- Remove duplication, improve names, extract helpers
- Keep tests green throughout

### COMMIT
- Atomic commit: `feat: <what-was-added>` or `fix: <what-was-fixed>`

## When TDD Doesn't Apply

- Config files, documentation, infrastructure
- Generated code, migrations
- Still VERIFY these work — just skip the red-green cycle

## Rationalizations That Mean "Start Over"

- "Too simple to test"
- "I'll test after"
- "Just this once"
- "Tests after achieve the same goals"
- "Already manually tested it"

All of these mean: delete code, start with the test.

## Verification Checklist

- [ ] Every new function has a test
- [ ] Watched each test fail before implementing
- [ ] Failed for expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass
- [ ] All tests pass
- [ ] No warnings or errors in test output
```

Save to `skills/tdd/SKILL.md`.

**Step 3: Commit**

```bash
git add skills/shipit-core/SKILL.md skills/tdd/SKILL.md
git commit -m "feat: add core and TDD skills"
```

---

### Task 7: Agent Definitions

**Files:**
- Create: `agents/shipit-planner.md`
- Create: `agents/shipit-executor.md`
- Create: `agents/shipit-verifier.md`
- Create: `agents/shipit-debugger.md`

**Step 1: Create shipit-planner agent**

```markdown
---
name: shipit-planner
description: |
  Breaks tasks into atomic implementation steps. Spawned by /shipit:go and /shipit:plan.
---

# ShipIt Planner

You are the ShipIt planner agent. Your job is to break a task into atomic, executable steps.

## Mandatory Initial Reads

Before doing ANYTHING, read these files if they exist:
1. `.shipit/PROJECT.md` — project context
2. `.shipit/STATE.md` — current state
3. `.shipit/config.json` — preferences

## Process

1. **Understand the task** — Read the task description carefully
2. **Analyze the codebase** — Use Glob and Grep to find relevant files, read them
3. **Classify complexity:**
   - Quick (1 file, <30 min): 1 task
   - Medium (2-5 files): 2-4 tasks
   - Large (6+ files): 4-8 tasks
4. **Write PLAN.md** — Each task must have:
   - Clear description (what to do)
   - Files to modify (exact paths)
   - Acceptance criteria (how to verify)
   - Whether TDD applies (yes for code, no for config/docs)

## Output Format

Write `.shipit/PLAN.md` with this structure:

```
---
task: "<original task description>"
total_tasks: <N>
completed_tasks: 0
created_at: "<ISO timestamp>"
status: pending
complexity: quick|medium|large
---

# Plan: <task description>

## Task 1: <name>
- **Files:** <exact paths>
- **Do:** <what to implement>
- **TDD:** yes|no
- **Verify:** <how to confirm it works>

## Task 2: <name>
...
```

## Rules

- YAGNI — only what's needed, nothing more
- Each task should be completable in one atomic commit
- Prefer modifying existing files over creating new ones
- Order tasks by dependency (earlier tasks don't depend on later ones)
- If a task is unclear, include a note for the executor

## After Writing

Update `.shipit/STATE.md`:
- Set `status: planned`
- Set `total_tasks: <N>`
- Set `current_task: 1`
```

Save to `agents/shipit-planner.md`.

**Step 2: Create shipit-executor agent**

```markdown
---
name: shipit-executor
description: |
  Executes tasks from PLAN.md with TDD enforcement. Spawned by /shipit:go.
---

# ShipIt Executor

You are the ShipIt executor agent. You implement one task at a time using TDD.

## Mandatory Initial Reads

Before doing ANYTHING, read these files:
1. `.shipit/PLAN.md` — the plan with all tasks
2. `.shipit/STATE.md` — which task you're on
3. `.shipit/config.json` — preferences (TDD enabled?, auto-commit?)

## Process

1. **Find your task** — Read STATE.md to get `current_task` number, find that task in PLAN.md
2. **Understand context** — Read the files listed in the task
3. **Execute with TDD** (if task has TDD: yes):
   a. **RED** — Write a failing test. Run it. Confirm it fails correctly.
   b. **GREEN** — Write minimal code to pass. Run tests. All must pass.
   c. **REFACTOR** — Clean up if needed. Tests still pass.
4. **Execute without TDD** (if task has TDD: no):
   a. Make the change
   b. Verify it works (run relevant commands)
5. **Commit** — Atomic commit with descriptive message
6. **Update STATE.md**:
   - Increment `completed_tasks`
   - Increment `current_task`
   - Update `updated_at`
   - If all tasks done, set `status: complete`

## TDD Hard Gate

If TDD is enabled in config AND the task has TDD: yes:
- You CANNOT mark the task complete without test output showing PASS
- You MUST have run the test and seen it fail BEFORE writing implementation
- If you wrote code first, delete it and start over

## Commit Format

```
feat: <task-name>

- <key change 1>
- <key change 2>
```

For bug fixes use `fix:`, for tests use `test:`, for docs use `docs:`.

## Deviation Rules

- **Typo/small fix needed:** Fix it inline, note in commit message
- **Task is wrong/impossible:** Update PLAN.md with a note, skip to next task
- **Blocker requiring user input:** Output `<shipit-blocked>description of blocker</shipit-blocked>` and stop
- **All tasks done:** Output `<shipit-done/>` to signal completion

## After Last Task

When `current_task > total_tasks`:
1. Set STATE.md `status: complete`
2. Output `<shipit-done/>`
```

Save to `agents/shipit-executor.md`.

**Step 3: Create shipit-verifier agent**

```markdown
---
name: shipit-verifier
description: |
  Validates completed work against the original task intent. Spawned by /shipit:done.
---

# ShipIt Verifier

You verify that completed work actually achieves what was requested.

## Mandatory Initial Reads

1. `.shipit/PLAN.md` — what was planned
2. `.shipit/STATE.md` — current state

## Process

1. **Read the original task** from PLAN.md frontmatter
2. **Run ALL tests** — the full test suite, not just new tests
3. **Review the diff** — `git diff` from before the work started
4. **Check coverage:**
   - Does every new function have a test?
   - Do the tests actually verify the intended behavior?
   - Are there edge cases that were missed?
5. **Verify intent:**
   - Does the code actually do what was requested?
   - Are there any leftover TODOs or incomplete sections?
   - Is there any debug/temporary code?

## Output

Report to the user:

```
## Verification Report

**Task:** <original task>
**Status:** PASS | FAIL

### Tests
- Total: X | Passed: Y | Failed: Z

### Coverage
- New functions with tests: X/Y
- Edge cases covered: [list]

### Issues (if any)
1. <issue description>
2. <issue description>

### Recommendation
<commit / fix issues first / needs more tests>
```
```

Save to `agents/shipit-verifier.md`.

**Step 4: Create shipit-debugger agent**

```markdown
---
name: shipit-debugger
description: |
  Systematic debugging with persistent state. Spawned by /shipit:debug.
---

# ShipIt Debugger

You debug issues using the scientific method. Your state persists in `.shipit/debug/DEBUG.md`.

## Mandatory Initial Reads

1. `.shipit/debug/DEBUG.md` — previous debugging state (if exists)
2. `.shipit/PROJECT.md` — project context
3. `.shipit/STATE.md` — current state

## The Iron Law

```
NEVER GUESS. ALWAYS VERIFY.
```

Changing code without understanding the root cause creates new bugs.

## Process

### Phase 1: Reproduce
- Confirm the bug exists with a concrete reproduction
- Write down exact steps, exact error message
- If you can't reproduce it, investigate further before changing anything

### Phase 2: Hypothesize
- Form 2-3 specific hypotheses about the root cause
- Rank by likelihood
- Write them to DEBUG.md

### Phase 3: Test Hypotheses
For each hypothesis (most likely first):
1. Design a test that would confirm or refute it
2. Run the test
3. Record result in DEBUG.md
4. If confirmed: proceed to fix
5. If refuted: move to next hypothesis

### Phase 4: Fix
1. Write a failing test that reproduces the bug
2. Fix the root cause (not symptoms)
3. Verify the test passes
4. Run full test suite
5. Commit: `fix: <what was fixed>`

## DEBUG.md Format

```markdown
---
issue: "<description>"
status: investigating | fixing | resolved
started_at: "<timestamp>"
---

# Debug: <issue>

## Reproduction
<exact steps and error>

## Hypotheses
1. [TESTING] <hypothesis> — <evidence so far>
2. [PENDING] <hypothesis>
3. [REFUTED] <hypothesis> — <why>

## Tested
- <what was tested> → <result>

## Root Cause
<once found>

## Fix
<what was changed and why>
```

## Rules

- NEVER change code to "see if it helps"
- ONE change at a time
- Document everything in DEBUG.md
- If stuck after 3 hypotheses, step back and gather more data
```

Save to `agents/shipit-debugger.md`.

**Step 5: Commit**

```bash
git add agents/shipit-planner.md agents/shipit-executor.md agents/shipit-verifier.md agents/shipit-debugger.md
git commit -m "feat: add planner, executor, verifier, and debugger agents"
```

---

### Task 8: Loop Setup Script

**Files:**
- Create: `scripts/setup-loop.sh`

**Step 1: Create the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# ShipIt Loop Setup Script
# Creates .shipit/loop.md state file for the auto-loop mechanism

SHIPIT_DIR=".shipit"
TOOL_PATH="${CLAUDE_PLUGIN_ROOT}/bin/shipit-tools.cjs"

# Parse arguments
TASK_PARTS=()
MAX_ITERATIONS=50

while [[ $# -gt 0 ]]; do
  case $1 in
    --max-iterations)
      if [[ -z "${2:-}" ]] || [[ ! "$2" =~ ^[0-9]+$ ]]; then
        echo "Error: --max-iterations requires a positive integer" >&2
        exit 1
      fi
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    *)
      TASK_PARTS+=("$1")
      shift
      ;;
  esac
done

TASK="${TASK_PARTS[*]}"

if [[ -z "$TASK" ]]; then
  echo "Error: No task description provided" >&2
  echo "Usage: /shipit:go <task description> [--max-iterations N]" >&2
  exit 1
fi

# Create .shipit directory if needed
mkdir -p "$SHIPIT_DIR"

# Create loop state file
cat > "${SHIPIT_DIR}/loop.md" <<EOF
---
active: true
iteration: 1
max_iterations: ${MAX_ITERATIONS}
started_at: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
tasks_total: 0
tasks_completed: 0
---

${TASK}
EOF

cat <<EOF
ShipIt loop activated!

Task: ${TASK}
Max iterations: ${MAX_ITERATIONS}
State: ${SHIPIT_DIR}/loop.md

The auto-loop is now active. Claude will keep working until:
- All tasks are complete (<shipit-done/>)
- A blocker is hit (<shipit-blocked>...</shipit-blocked>)
- Max iterations reached (${MAX_ITERATIONS})
EOF
```

Save to `scripts/setup-loop.sh`.

```bash
chmod +x scripts/setup-loop.sh
```

**Step 2: Verify no syntax errors**

```bash
bash -n scripts/setup-loop.sh
```

Expected: No output (clean)

**Step 3: Commit**

```bash
git add scripts/setup-loop.sh
git commit -m "feat: add loop setup script"
```

---

### Task 9: Commands — go, plan, init

**Files:**
- Create: `commands/go.md`
- Create: `commands/plan.md`
- Create: `commands/init.md`

**Step 1: Create /shipit:go command**

```markdown
---
name: shipit:go
description: Smart router — auto-detects task complexity, plans, executes with TDD, loops until done
argument-hint: "<task description> [--max-iterations N]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Execute a task end-to-end with maximum autonomy. Auto-detect complexity, plan if needed, execute with TDD, loop until complete.
</objective>

<process>

## Step 1: Load Context

Read these files if they exist (silently skip if missing):
- `.shipit/PROJECT.md`
- `.shipit/STATE.md`
- `.shipit/config.json`

## Step 2: Analyze Task Complexity

Examine the codebase to understand what the task requires:
- Use Glob and Grep to find relevant files
- Read key files to understand the current state
- Classify complexity:
  - **Quick** (1 file, simple change): Execute directly
  - **Medium** (2-5 files, clear scope): Auto-plan into 2-4 tasks
  - **Large** (6+ files, complex): Plan into 4-8 tasks, consider parallel execution

## Step 3: Plan (Medium/Large Only)

For medium and large tasks, spawn a `shipit-planner` agent:

```
Task(subagent_type="shipit-planner", prompt="Plan this task: $ARGUMENTS\n\nContext from STATE.md and PROJECT.md: [include relevant context]")
```

Wait for the planner to write `.shipit/PLAN.md`.

## Step 4: Initialize State

If `.shipit/STATE.md` doesn't exist, create it:
```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/shipit-tools.cjs state init "<project-name>"
```

Update STATE.md with:
- `status: executing`
- `current_task: 1`
- `total_tasks: <from PLAN.md>`

## Step 5: Activate Auto-Loop

```bash
${CLAUDE_PLUGIN_ROOT}/scripts/setup-loop.sh "$ARGUMENTS" --max-iterations <from config or 50>
```

## Step 6: Execute Tasks

For each task in PLAN.md:

**If quick task (no PLAN.md needed):**
- Apply TDD directly (if config.tdd is true and task involves code)
- Write failing test → implement → verify → commit
- Update STATE.md: `status: complete`
- Output `<shipit-done/>`

**If planned tasks:**
Spawn `shipit-executor` agent for the current task:
```
Task(subagent_type="shipit-executor", prompt="Execute task N from .shipit/PLAN.md")
```

After executor completes, check STATE.md. If more tasks remain, continue (the loop will handle re-entry).

## Step 7: Verify (After All Tasks)

When all tasks complete, spawn `shipit-verifier`:
```
Task(subagent_type="shipit-verifier", prompt="Verify the completed work against the original task: $ARGUMENTS")
```

If verification passes: output `<shipit-done/>`
If verification fails: create fix tasks in PLAN.md and continue

</process>
```

Save to `commands/go.md`.

**Step 2: Create /shipit:plan command**

```markdown
---
name: shipit:plan
description: Quick brainstorm + plan — review before executing
argument-hint: "<task description>"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Create a plan for a task and present it for user approval before execution.
</objective>

<process>

## Step 1: Load Context

Read `.shipit/PROJECT.md`, `.shipit/STATE.md`, `.shipit/config.json` if they exist.

## Step 2: Quick Brainstorm

Ask the user at most 1-2 clarifying questions if the task is ambiguous. Use AskUserQuestion with multiple-choice options. If the task is clear, skip questions entirely.

## Step 3: Analyze Codebase

Use Glob and Grep to find relevant files. Read key files to understand existing patterns and architecture.

## Step 4: Create Plan

Spawn `shipit-planner` agent:
```
Task(subagent_type="shipit-planner", prompt="Plan this task: $ARGUMENTS\n\n[Include codebase context]")
```

## Step 5: Present Plan

Read `.shipit/PLAN.md` and present a summary to the user:
- Number of tasks
- Key files to modify
- Estimated complexity
- Any risks or trade-offs

Ask: "Ready to execute? Or want changes?"

## Step 6: On Approval

Route to `/shipit:go` with the existing plan:
- The plan is already in `.shipit/PLAN.md`
- `/shipit:go` will detect the existing plan and execute it

</process>
```

Save to `commands/plan.md`.

**Step 3: Create /shipit:init command**

```markdown
---
name: shipit:init
description: Lightweight project setup — creates .shipit/ with PROJECT.md
argument-hint: "[project-name]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---

<objective>
Initialize a project with minimal ceremony. Create .shipit/ directory with PROJECT.md and config.
</objective>

<process>

## Step 1: Scan Existing Codebase

If there are existing files in the working directory:
- Use Glob to find package.json, Cargo.toml, go.mod, requirements.txt, etc.
- Read them to detect tech stack
- Look at directory structure (src/, lib/, app/, etc.)

## Step 2: Ask Essential Questions

Use AskUserQuestion to ask at most 2-3 questions:

1. "What does this project do?" (open-ended, or skip if obvious from README/package.json)
2. "What's the core value — the ONE thing that matters most?" (open-ended)
3. "Any constraints I should know about?" (optional, skip if none obvious)

## Step 3: Create State

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/shipit-tools.cjs state init "$ARGUMENTS"
```

## Step 4: Write PROJECT.md

Create `.shipit/PROJECT.md` (under 50 lines) with:
- Project name
- What it does (1-2 sentences)
- Core value
- Tech stack (detected + confirmed)
- Constraints (if any)

## Step 5: Confirm

Tell the user:
- Project initialized at `.shipit/`
- Show what was created
- Suggest: "Run `/shipit:go <task>` to start working"

</process>
```

Save to `commands/init.md`.

**Step 4: Commit**

```bash
git add commands/go.md commands/plan.md commands/init.md
git commit -m "feat: add go, plan, and init commands"
```

---

### Task 10: Commands — resume, status, debug, done, help

**Files:**
- Create: `commands/resume.md`
- Create: `commands/status.md`
- Create: `commands/debug.md`
- Create: `commands/done.md`
- Create: `commands/help.md`

**Step 1: Create /shipit:resume command**

```markdown
---
name: shipit:resume
description: Resume from last session — reads STATE.md and continues
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
---

<objective>
Resume work from a previous session by reading persistent state.
</objective>

<process>

## Step 1: Load State

Read `.shipit/STATE.md`. If it doesn't exist, tell the user "No previous session found. Run `/shipit:init` or `/shipit:go <task>` to start."

## Step 2: Show Summary

Display:
- Project name
- Last task status
- Tasks completed / total
- Last updated timestamp

## Step 3: Resume

If `status: executing` and PLAN.md exists:
- Show which task was in progress
- Ask: "Continue from task N?" (default: yes)
- On yes: activate loop and continue execution (same as `/shipit:go`)

If `status: complete`:
- Tell user: "Previous task is complete. Run `/shipit:go <new-task>` for the next one."

If `status: idle` or `status: planned`:
- If PLAN.md exists: "You have a pending plan. Run `/shipit:go` to execute it."
- Otherwise: "No active work. Run `/shipit:go <task>` to start."

</process>
```

Save to `commands/resume.md`.

**Step 2: Create /shipit:status command**

```markdown
---
name: shipit:status
description: Show current progress — tasks, completion percentage, blockers
allowed-tools:
  - Read
  - Bash
  - Glob
---

<objective>
Display a quick progress dashboard.
</objective>

<process>

## Step 1: Load State

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/shipit-tools.cjs state load
```

If no state exists, show: "No active project. Run `/shipit:init` to set up."

## Step 2: Display Dashboard

Format as:

```
## ShipIt Status

**Project:** <name>
**Status:** <idle | planned | executing | complete>
**Progress:** <completed>/<total> tasks (<percentage>%)
**Last Updated:** <timestamp>

### Active Plan
<task description from PLAN.md or "No active plan">

### Current Task
Task <N>: <description> [<status>]

### Recent Commits
<last 3 git commits, one-line format>

### Loop
<active (iteration N/max) | inactive>
```

Use `git log --oneline -3` for recent commits.
Check `.shipit/loop.md` for loop status.

</process>
```

Save to `commands/status.md`.

**Step 3: Create /shipit:debug command**

```markdown
---
name: shipit:debug
description: Systematic debugging with persistent state across sessions
argument-hint: "<issue description>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
---

<objective>
Debug an issue using the scientific method with state that persists across context resets.
</objective>

<process>

## Step 1: Check for Existing Debug Session

Read `.shipit/debug/DEBUG.md` if it exists. If it has an active investigation, resume from where it left off.

## Step 2: Initialize Debug State

If no existing session, create `.shipit/debug/DEBUG.md`:

```bash
mkdir -p .shipit/debug
```

Write DEBUG.md with:
- Issue description from $ARGUMENTS
- Status: investigating
- Empty hypotheses, tested, root cause sections

## Step 3: Spawn Debugger

Spawn `shipit-debugger` agent:
```
Task(subagent_type="shipit-debugger", prompt="Debug this issue: $ARGUMENTS")
```

The debugger will:
1. Reproduce the issue
2. Form hypotheses
3. Test them systematically
4. Find root cause
5. Fix with TDD
6. Update DEBUG.md throughout

## Step 4: Activate Loop (Optional)

If auto_loop is enabled in config, activate the loop so debugging continues autonomously:
```bash
${CLAUDE_PLUGIN_ROOT}/scripts/setup-loop.sh "Debug: $ARGUMENTS" --max-iterations 30
```

</process>
```

Save to `commands/debug.md`.

**Step 4: Create /shipit:done command**

```markdown
---
name: shipit:done
description: Verify + finish — runs tests, reviews diff, offers commit/PR/branch
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Verify completed work and offer finishing options (commit, PR, branch).
</objective>

<process>

## Step 1: Deactivate Loop

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/shipit-tools.cjs loop deactivate
```

## Step 2: Run Verification

Spawn `shipit-verifier` agent:
```
Task(subagent_type="shipit-verifier", prompt="Verify completed work. Original task from .shipit/PLAN.md")
```

## Step 3: Show Results

Display the verifier's report to the user.

## Step 4: Offer Finishing Options

If verification passes, ask the user:

1. **Commit** — Stage and commit all changes with a summary message
2. **Create PR** — Push to a new branch and create a pull request
3. **Keep working** — Don't finish yet, there's more to do
4. **Just report** — Show what was done but don't commit

## Step 5: Execute Choice

Based on user's choice:
- **Commit:** `git add -A && git commit -m "<summary>"`
- **PR:** Create branch, push, `gh pr create`
- **Keep working:** Do nothing, user will continue
- **Report:** Show diff summary and exit

## Step 6: Clean Up State

Update `.shipit/STATE.md`:
- Set `status: complete`
- Update `updated_at`

Output `<shipit-done/>` to exit any active loop.

</process>
```

Save to `commands/done.md`.

**Step 5: Create /shipit:help command**

```markdown
---
name: shipit:help
description: Show ShipIt usage guide and available commands
allowed-tools: []
---

Display this help text to the user:

```
# ShipIt — Unified Development Plugin

## Commands

### /shipit:go <task>
The main command. Auto-detects task complexity and executes with TDD.
Examples:
  /shipit:go add user authentication with JWT
  /shipit:go fix the login bug where sessions expire early
  /shipit:go refactor the payment module to use Stripe SDK v3

### /shipit:plan <description>
Create a plan and review it before executing.
Examples:
  /shipit:plan redesign the database schema for multi-tenancy

### /shipit:init [name]
Set up a new project. Creates .shipit/ with PROJECT.md and config.
Examples:
  /shipit:init my-saas-app

### /shipit:resume
Resume work from a previous session.

### /shipit:status
Show current progress dashboard.

### /shipit:debug <issue>
Systematic debugging with persistent state.
Examples:
  /shipit:debug login returns 403 after password reset

### /shipit:done
Verify work and finish (commit, PR, or just report).

### /shipit:help
This help text.

## How It Works

1. /shipit:go auto-detects task complexity (quick/medium/large)
2. For medium/large tasks, it creates a plan with atomic steps
3. Each step is executed with TDD (test first, then implement)
4. An auto-loop keeps going until all tasks complete
5. State persists in .shipit/ so you can resume across sessions

## State Files (.shipit/)

- PROJECT.md — What the project is about
- STATE.md — Current progress and position
- PLAN.md — Active plan with tasks
- config.json — Preferences (TDD, loop, parallelism)
- loop.md — Auto-loop state (managed automatically)
- debug/DEBUG.md — Debugging session state

## Configuration (.shipit/config.json)

  tdd: true          — Enforce TDD (default: true)
  auto_loop: true    — Enable auto-loop (default: true)
  max_iterations: 50 — Max loop iterations (default: 50)
  auto_commit: true  — Commit after each task (default: true)
```
```

Save to `commands/help.md`.

**Step 6: Commit**

```bash
git add commands/resume.md commands/status.md commands/debug.md commands/done.md commands/help.md
git commit -m "feat: add resume, status, debug, done, and help commands"
```

---

### Task 11: README

**Files:**
- Create: `README.md`

**Step 1: Create README**

```markdown
# ShipIt

A unified Claude Code plugin that combines the best of [superpowers](https://github.com/obra/superpowers) (TDD, debugging), [GSD](https://github.com/get-shit-done) (state persistence, task decomposition), and [Ralph Loop](https://github.com/anthropics/claude-plugins-official) (auto-loop execution) into one streamlined workflow.

## Install

```bash
# From the Claude Code CLI:
/install-plugin /path/to/shipit
```

Or copy the `shipit/` directory to your Claude Code plugins cache.

## Quick Start

```
/shipit:go add user authentication with JWT tokens
```

That's it. ShipIt will:
1. Analyze your codebase
2. Break the task into atomic steps
3. Execute each step with TDD
4. Auto-loop until everything's done
5. Verify the result

## Commands

| Command | Purpose |
|---------|---------|
| `/shipit:go <task>` | Main command — plans + executes + loops |
| `/shipit:plan <desc>` | Plan first, review, then execute |
| `/shipit:init [name]` | Set up project state |
| `/shipit:resume` | Continue from last session |
| `/shipit:status` | Progress dashboard |
| `/shipit:debug <issue>` | Systematic debugging |
| `/shipit:done` | Verify and finish |
| `/shipit:help` | Usage guide |

## How It Works

- **Smart Routing:** `/shipit:go` auto-detects task complexity (quick/medium/large) and plans accordingly
- **TDD by Default:** Every code change goes through RED-GREEN-REFACTOR
- **Auto-Loop:** A Stop hook keeps Claude working until tasks complete or a blocker is hit
- **Persistent State:** `.shipit/` directory tracks progress across sessions
- **Atomic Commits:** One commit per completed task

## Configuration

Edit `.shipit/config.json`:

```json
{
  "tdd": true,
  "auto_loop": true,
  "max_iterations": 50,
  "auto_commit": true,
  "parallel_execution": true,
  "max_parallel_agents": 3
}
```

## License

MIT
```

Save to `README.md`.

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with installation and usage guide"
```

---

### Task 12: Final Verification

**Step 1: Verify complete file structure**

```bash
find . -type f -not -path './.git/*' | sort
```

Expected output should match the design document structure:
```
./.claude-plugin/plugin.json
./LICENSE
./README.md
./agents/shipit-debugger.md
./agents/shipit-executor.md
./agents/shipit-planner.md
./agents/shipit-verifier.md
./bin/shipit-tools.cjs
./bin/shipit-tools.test.cjs
./commands/debug.md
./commands/done.md
./commands/go.md
./commands/help.md
./commands/init.md
./commands/plan.md
./commands/resume.md
./commands/status.md
./docs/plans/2026-02-24-shipit-implementation.md
./docs/plans/2026-02-24-shipit-plugin-design.md
./hooks/hooks.json
./hooks/session-start.sh
./hooks/stop-hook.sh
./scripts/setup-loop.sh
./skills/shipit-core/SKILL.md
./skills/tdd/SKILL.md
./templates/project.md
./templates/state.md
```

**Step 2: Run CLI tool tests**

```bash
node bin/shipit-tools.test.cjs
```

Expected: All tests passed!

**Step 3: Verify all bash scripts have no syntax errors**

```bash
bash -n hooks/session-start.sh && bash -n hooks/stop-hook.sh && bash -n scripts/setup-loop.sh && echo "All scripts OK"
```

Expected: All scripts OK

**Step 4: Verify all scripts are executable**

```bash
ls -la hooks/session-start.sh hooks/stop-hook.sh scripts/setup-loop.sh | awk '{print $1, $NF}'
```

Expected: All should show `-rwxr-xr-x` (or at least `x` permission)

**Step 5: Final commit with implementation plan**

```bash
git add docs/plans/2026-02-24-shipit-implementation.md
git commit -m "docs: add implementation plan"
```
