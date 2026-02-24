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
      writeFrontmatter(shipitPath('STATE.md'), {
        project: name,
        status: 'idle',
        current_task: 0,
        total_tasks: 0,
        updated_at: now()
      }, `# ${name}\n\nNo active plan.`);
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
