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
