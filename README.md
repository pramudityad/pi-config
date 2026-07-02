# Pi Configuration

My custom [pi](https://github.com/marioishikawa/pi) coding agent configuration.

## Structure

```
.
├── agents/           # Custom agent definitions (11 agents)
├── skills/           # Custom skills for specialized tasks
│   ├── browser-use/  # Autonomous web agent (LLM-driven)
│   ├── clickup/
│   ├── ecc-*/        # ECC organization standards (6 skills)
│   ├── pi-skills/    # Built-in pi skills (10 skills)
│   └── superpowers/  # Development superpowers (13 skills)
├── extensions/       # TypeScript extensions
├── prompts/          # Prompt templates
└── settings.json     # Pi settings
```

## Setup

This repo is symlinked to `~/.pi/agent`:

```bash
# The setup is already done:
ls -la ~/.pi/agent  # → points to ~/git/pi-config
```

## Workflow

Since this is symlinked, any changes made by pi are immediately tracked by git:

```bash
cd ~/git/pi-config

# See what pi changed
git status

# Review changes
git diff

# Commit
git add .
git commit -m "feat: update agent configuration"
```

## Security

- `auth.json` is gitignored and contains API keys
- It stays in `~/.pi/agent/` (symlinked location) but is not tracked
- Never commit secrets!

## Agents

| Agent | Purpose |
|-------|---------|
| `ecc-architect` | System architecture design |
| `ecc-backend-reviewer` | Backend code review |
| `ecc-build-error-resolver` | Fix build errors |
| `ecc-database-reviewer` | PostgreSQL review: queries, schema, indexes, RLS |
| `ecc-e2e-runner` | E2E test execution |
| `ecc-refactor-cleaner` | Code refactoring |
| `ecc-security-reviewer` | Security audits |
| `planner` | Task planning |
| `reviewer` | General code review |
| `scout` | Project exploration |
| `worker` | Task execution |

## Skills

### ECC Standards
- `ecc-api-design` - REST API conventions
- `ecc-backend-patterns` - Node.js/Express patterns
- `ecc-coding-standards` - TypeScript/React standards
- `ecc-e2e-testing` - Playwright testing
- `ecc-frontend-patterns` - React/Next.js patterns
- `ecc-security-review` - Security audit checklist

### Superpowers
- `brainstorming` - Feature exploration
- `dispatching-parallel-agents` - Parallel task execution
- `executing-plans` - Plan execution
- `finishing-development` - Completion workflows
- `git-worktrees` - Isolated development
- `receiving-code-review` - Handle PR feedback
- `requesting-code-review` - PR preparation
- `subagent-development` - Multi-agent tasks
- `systematic-debugging` - Debug methodology
- `test-driven-development` - TDD workflows
- `using-skills` - Skill usage guidelines
- `verification-before-completion` - Pre-completion checks
- `writing-plans` - Plan creation
- `writing-skills` - Skill development

### Browser & Web
- `web_search` / `web_read` - Web search + URL→markdown via the `pi-search-hub` extension (multi-backend, auto-fallback, RRF combine)
- `browser-use` - Autonomous web agent (LLM-driven browsing)
- `browser-tools` - Scripted browser automation (CDP)

### Pi Skills
- `gccli` - Google Calendar
- `gdcli` - Google Drive
- `gmcli` - Gmail
- `jiracli` - Jira CLI
- `pgcli` - PostgreSQL
- `transcribe` - Audio transcription
- `vscode` - VS Code integration
- `youtube-transcript` - YouTube transcripts
