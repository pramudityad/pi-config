# browser-use Skill Design

## Context

We have `browser-tools` (CDP-based, scripted, deterministic). We need `browser-use` (LLM-driven, autonomous, exploratory) for tasks where the DOM structure is unknown upfront.

## Decision: Adopt (not build)

- browser-use: 87K stars, MIT, Python, mature
- No equivalent in Node.js ecosystem at this quality level
- Complements browser-tools (different use cases)

## Skill Design

### Triggering Conditions (when to use THIS skill vs browser-tools)

| Use browser-use | Use browser-tools |
|---|---|
| Task is described in natural language | Task is a known DOM interaction |
| DOM structure unknown upfront | You know exactly what to click |
| Multi-site navigation needed | Single-page scripted operation |
| Form filling from unstructured data | Fast DOM inspection |
| Exploratory web research | CI/CD automation (no LLM cost) |

### Architecture

```
User → Pi → SKILL.md (decision guide)
                ↓
        browser-use CLI / Python script
                ↓
        LLM (ChatBrowserUse / existing keys)
                ↓
        Chromium via CDP
```

### Skill Components

1. `SKILL.md` — Triggering conditions, patterns, decision guide
2. `setup.sh` — One-time setup (uv, browser-use, Chromium)
3. `agent.py` — Reusable async agent runner script
4. `.env.example` — Required API keys

### LLM Choice

Use existing API keys already in `~/.pi/agent/auth.json`:
- OpenAI, Anthropic, or Google keys already configured
- Default to `ChatOpenAI` (most likely available)
- No new dependency on ChatBrowserUse API key unless user opts in

### Setup Requirements

- Python >= 3.11
- uv (Python package manager)
- Chromium (installed via `browser-use install`)
- One LLM API key (OpenAI / Anthropic / Google)

### Common Patterns to Cover

1. Single task: "Find X on the web"
2. Form filling: "Fill this form with my data"
3. Multi-site comparison: "Compare X across sites"
4. Authenticated task: "Check my account page"
5. Data extraction: "Get all items from this page"

### Not In Scope

- Replacing browser-tools (it stays for scripted tasks)
- Cloud/paid features of browser-use (optional, documented)
- MCP integration (future consideration)

## Verification

- [ ] Skill triggers correctly on autonomous web task descriptions
- [ ] Setup is one command
- [ ] First agent run succeeds
- [ ] Decision guide correctly routes to browser-tools vs browser-use
