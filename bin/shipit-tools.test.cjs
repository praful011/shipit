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
