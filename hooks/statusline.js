#!/usr/bin/env node
// Claude Code Statusline - ShipIt Edition
// Shows: brand | git branch+changes | task name | tdd phase | elapsed | loop | model | dir | context

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const SEP = ' \u2502 ';

function git(cmd, dir) {
  try {
    return execSync(`git ${cmd}`, { cwd: dir, encoding: 'utf8', timeout: 2000, stdio: ['pipe','pipe','pipe'] }).trim();
  } catch (e) { return ''; }
}

function elapsed(startIso) {
  if (!startIso) return '';
  const ms = Date.now() - new Date(startIso).getTime();
  if (ms < 0 || isNaN(ms)) return '';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  const rm = min % 60;
  return `${hr}h${rm > 0 ? rm + 'm' : ''}`;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const session = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;
    const homeDir = os.homedir();
    const dirname = path.basename(dir);

    // --- Context bar ---
    let ctx = '';
    if (remaining != null) {
      const rem = Math.round(remaining);
      const rawUsed = Math.max(0, Math.min(100, 100 - rem));
      const used = Math.min(100, Math.round((rawUsed / 80) * 100));
      const filled = Math.floor(used / 10);
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
      if (used < 63)       ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
      else if (used < 81)  ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
      else if (used < 95)  ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      else                 ctx = ` \x1b[5;31m\u{1F480} ${bar} ${used}%\x1b[0m`;
    }

    // --- Git branch + changes ---
    let gitInfo = '';
    const branch = git('rev-parse --abbrev-ref HEAD', dir);
    if (branch) {
      const changed = git('status --porcelain', dir);
      const count = changed ? changed.split('\n').filter(l => l.trim()).length : 0;
      const branchDisplay = branch.length > 20 ? branch.slice(0, 18) + '..' : branch;
      if (count > 0) {
        gitInfo = `\x1b[35m\u2387 ${branchDisplay}\x1b[0m \x1b[33m+${count}\x1b[0m`;
      } else {
        gitInfo = `\x1b[35m\u2387 ${branchDisplay}\x1b[0m`;
      }
    }

    // --- ShipIt state from .shipit/STATE.md ---
    let shipitProgress = '';
    let taskName = '';
    let tddPhase = '';
    let elapsedTime = '';
    const stateFile = path.join(dir, '.shipit', 'STATE.md');
    if (fs.existsSync(stateFile)) {
      try {
        const content = fs.readFileSync(stateFile, 'utf8');
        const get = (key) => { const m = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm')); return m ? m[1].trim() : ''; };

        const status = get('status');
        const current = get('current_task');
        const total = get('total_tasks');
        const tdd = get('tdd_phase');
        const startedAt = get('started_at');

        // Progress: 🚀 2/5 or ✔ done
        if (status === 'executing' && current && total) {
          shipitProgress = `\x1b[36m\u{1F680} ${current}/${total}\x1b[0m`;
        } else if (status === 'complete') {
          shipitProgress = `\x1b[32m\u2714 done\x1b[0m`;
        } else if (status) {
          shipitProgress = `\x1b[36m${status}\x1b[0m`;
        }

        // TDD phase: 🔴 RED / 🟢 GREEN / 🔵 REFACTOR
        if (tdd) {
          const phase = tdd.toUpperCase();
          if (phase === 'RED')          tddPhase = `\x1b[31m\u25CF RED\x1b[0m`;
          else if (phase === 'GREEN')   tddPhase = `\x1b[32m\u25CF GREEN\x1b[0m`;
          else if (phase === 'REFACTOR') tddPhase = `\x1b[34m\u25CF REFACTOR\x1b[0m`;
          else                          tddPhase = `\x1b[2m${phase}\x1b[0m`;
        }

        // Elapsed time
        if (startedAt) {
          const e = elapsed(startedAt);
          if (e) elapsedTime = `\x1b[2m\u23F1 ${e}\x1b[0m`;
        }
      } catch (e) {}
    }

    // --- Task name from PLAN.md ---
    if (shipitProgress) {
      const planFile = path.join(dir, '.shipit', 'PLAN.md');
      if (fs.existsSync(planFile)) {
        try {
          const planContent = fs.readFileSync(planFile, 'utf8');
          const stateContent = fs.readFileSync(stateFile, 'utf8');
          const currentMatch = stateContent.match(/^current_task:\s*(\d+)/m);
          if (currentMatch) {
            const taskNum = parseInt(currentMatch[1], 10);
            // Match "## Task N:" or "### N." or "- [ ] N." patterns
            const patterns = [
              new RegExp(`^##+ (?:Task )?${taskNum}[.:\\s]+(.+)$`, 'm'),
              new RegExp(`^${taskNum}[.)\\s]+(.+)$`, 'm'),
              new RegExp(`^- \\[.\\] (?:Task )?${taskNum}[.:\\s]+(.+)$`, 'm'),
            ];
            for (const pat of patterns) {
              const m = planContent.match(pat);
              if (m) {
                const name = m[1].trim();
                taskName = name.length > 30 ? name.slice(0, 28) + '..' : name;
                break;
              }
            }
          }
        } catch (e) {}
      }
    }

    // --- Loop state ---
    let loopInfo = '';
    const loopFile = path.join(dir, '.shipit', 'loop.md');
    if (fs.existsSync(loopFile)) {
      try {
        const loopContent = fs.readFileSync(loopFile, 'utf8');
        const activeMatch = loopContent.match(/^active:\s*(.+)$/m);
        const iterMatch = loopContent.match(/^iteration:\s*(.+)$/m);
        const maxMatch = loopContent.match(/^max_iterations:\s*(.+)$/m);
        if (activeMatch && activeMatch[1].trim() === 'true' && iterMatch) {
          const iter = iterMatch[1].trim();
          const max = maxMatch ? maxMatch[1].trim() : '?';
          loopInfo = `\x1b[33m\u{1F501} ${iter}/${max}\x1b[0m`;
        }
      } catch (e) {}
    }

    // --- Active todo task ---
    let todoTask = '';
    const todosDir = path.join(homeDir, '.claude', 'todos');
    if (session && fs.existsSync(todosDir)) {
      try {
        const files = fs.readdirSync(todosDir)
          .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0) {
          const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
          const inProgress = todos.find(t => t.status === 'in_progress');
          if (inProgress) todoTask = inProgress.activeForm || '';
        }
      } catch (e) {}
    }

    // --- Assemble output ---
    const segments = [];

    // Brand (always)
    segments.push('\x1b[1;36mShipIt\x1b[0m');

    // Git branch + changes
    if (gitInfo) segments.push(gitInfo);

    // Task name from PLAN.md or active todo
    if (taskName) segments.push(`\x1b[1m${taskName}\x1b[0m`);
    else if (todoTask) segments.push(`\x1b[1m${todoTask}\x1b[0m`);

    // Progress (🚀 2/5)
    if (shipitProgress) segments.push(shipitProgress);

    // TDD phase (● RED/GREEN/REFACTOR)
    if (tddPhase) segments.push(tddPhase);

    // Loop (🔁 3/50)
    if (loopInfo) segments.push(loopInfo);

    // Elapsed (⏱ 12m)
    if (elapsedTime) segments.push(elapsedTime);

    // Model | Dir | Context (always)
    segments.push(`\x1b[2m${model}\x1b[0m`);
    segments.push(`\x1b[2m${dirname}\x1b[0m${ctx}`);

    process.stdout.write(segments.join(SEP));
  } catch (e) {
    // Silent fail — never break the statusline
  }
});
