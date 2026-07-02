# Browser Tools — CDP Browser Automation

**Purpose:** Chrome DevTools Protocol (CDP) browser automation scripts for web interaction, scraping, and screenshots. Invoked via the `browser-tools` pi skill.

10 Node.js scripts + `package.json` + `node_modules`.

## File Conventions

- **Language:** Plain JavaScript (CommonJS — no TypeScript)
- **Entry point:** `SKILL.md` defines the skill; JS files are tool implementations
- **Naming:** `browser-<action>.js` — `browser-start.js`, `browser-nav.js`, `browser-eval.js`, `browser-screenshot.js`, `browser-cookies.js`, `browser-content.js`, `browser-pick.js`, `browser-hn-scraper.js`
- **Special scripts:** `upload-resume.mjs` (ESM, for a specific task)
- **CDP library:** Uses `puppeteer-core` or direct CDP via `chrome-remote-interface` (check `package.json`)

## Script Inventory

| Script | Purpose |
|--------|---------|
| `browser-start.js` | Launch headless browser session |
| `browser-nav.js` | Navigate to URL |
| `browser-eval.js` | Evaluate JavaScript in page context |
| `browser-screenshot.js` | Capture page screenshot |
| `browser-cookies.js` | Get/set cookies |
| `browser-content.js` | Extract page content |
| `browser-pick.js` | Interactive element picker |
| `browser-hn-scraper.js` | Hacker News scraper example |
| `upload-resume.mjs` | Resume upload automation |

## Architecture Patterns

- **Session lifecycle:** `browser-start.js` opens a CDP connection → subsequent scripts reuse the session → cleanup on disconnect
- **State sharing:** Browser session state (page objects, connections) shared via environment or temp files between script invocations
- **Error handling:** Scripts exit with non-zero code on failure

## Do's and Don'ts

- **Do** keep scripts focused — one action per script
- **Do** use `browser-start.js` first before other scripts
- **Don't** hardcode URLs or credentials — accept as CLI args or env vars
- **Don't** mix ESM and CJS in the same script (use `.mjs` for ESM, `.js` for CJS)
- **Don't** add browser automation logic to the `SKILL.md` — keep it in scripts

## Testing

No formal test framework. Test manually by running the scripts against a test page:

```bash
node browser-start.js
node browser-nav.js --url https://example.com
node browser-screenshot.js --output test.png
```
