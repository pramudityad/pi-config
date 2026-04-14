---
name: browser-use
description: Use when the user wants an AI agent to autonomously browse the web, fill forms, extract data from pages with unknown structure, compare information across sites, or perform multi-step web tasks that cannot be scripted with known DOM selectors. Triggers on phrases like "browse the web", "go to this site and find", "fill out this form", "compare prices", "research online", "extract data from website".
---

# browser-use — Autonomous Web Agent

## Overview

browser-use is an LLM-powered agent that autonomously browses websites. You describe the task in natural language, and it navigates, clicks, types, and extracts data on its own. Uses your **ZAI subscription** (same as Pi) — no additional API keys needed.

**Core principle:** Use browser-use when the DOM structure is unknown upfront. Use browser-tools when you know exactly what to interact with.

## Decision Guide: browser-use vs browser-tools

| Use browser-use | Use browser-tools |
|---|---|
| Task described in natural language | Known DOM interaction |
| DOM structure unknown upfront | You know exactly what to click |
| Multi-site navigation | Single-page scripted operation |
| Form filling from unstructured data | Fast DOM inspection via JS eval |
| Exploratory web research | CI/CD automation (no LLM cost) |
| "Go find X on the web" | "Click button #5 on this page" |

## Setup (one-time, already done)

```bash
cd {baseDir}
uv sync           # Install dependencies
uv run browser-use install  # Install Chromium
```

## Run an Agent Task

```bash
cd {baseDir} && uv run agent.py "Your task description here"
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--model` | `zai` | LLM: `zai`, `google`, `openai`, `anthropic`, `browser-use`, `ollama` |
| `--headless` | `true` | Show browser window (`false` to see it) |
| `--max-steps` | `30` | Maximum agent steps before stopping |
| `--vision` | `true` | Enable screenshot-based vision |

### Examples

```bash
# Simple extraction
uv run agent.py "Go to https://news.ycombinator.com and tell me the top post"

# Form filling
uv run agent.py "Go to https://example.com/form and fill in name: John, email: john@test.com"

# Multi-site comparison
uv run agent.py "Compare the price of iPhone 16 on amazon.com and bestbuy.com"

# Show the browser (for debugging)
uv run agent.py "Go to google.com and search for browser-use" --headless false

# Complex task with more steps
uv run agent.py "Go to Wikipedia, find the article about Python (programming language), and extract the current stable version number" --max-steps 15

# Use a different LLM
uv run agent.py "Find today's weather in Jakarta" --model google
```

## How It Works

1. Agent receives your natural language task
2. Opens Chromium browser
3. Repeatedly: reads page state → asks LLM what to do next → executes action
4. Actions include: navigate, click, type, scroll, extract text, done
5. Returns final result when task is complete or max steps reached

## Credentials

Uses your Pi subscription automatically. The agent reads `~/.pi/agent/auth.json` for the ZAI API key. No additional setup needed.

Supported models and their requirements:
- **zai** (default) — Uses Pi's ZAI subscription, no extra key needed
- **google** — Requires `GOOGLE_API_KEY` in `.env`
- **openai** — Requires `OPENAI_API_KEY` in `.env`
- **anthropic** — Requires `ANTHROPIC_API_KEY` in `.env`

## Common Patterns

### Extract Data from a Page
```bash
uv run agent.py "Go to https://example.com/products and list all product names and prices"
```

### Authenticated Task (reuse Chrome profile)
For tasks requiring login, use the browser-tools skill to start Chrome with your profile first, or use browser-use with `--headless false` and manually log in when the browser window appears.

### Limit Steps for Cost Control
```bash
uv run agent.py "Quick search for..." --max-steps 5
```

## Limitations

- **Not deterministic** — Same task may produce different results across runs
- **LLM cost per step** — Each step calls the LLM (~5-30 steps per task)
- **Rate limits** — ZAI subscription has usage limits
- **CAPTCHAs** — Cannot solve complex CAPTCHAs (cloud feature)
- **No session persistence** — Each run starts with a fresh browser

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `No API key` | Check `~/.pi/agent/auth.json` has `zai` entry |
| `Quota exceeded` | ZAI rate limit hit, wait or use `--model google` |
| `Invalid JSON` | LLM returned malformed response, usually recovers on retry |
| `Page readiness timeout` | Slow page load, usually still works |
| `Failed to complete task` | Try `--max-steps 20` or rephrase the task |

## File Structure

```
{baseDir}/
├── SKILL.md        # This file
├── agent.py        # Reusable agent runner
├── .env            # API keys (auto-managed)
├── pyproject.toml  # Python dependencies
└── .venv/          # Virtual environment
```
