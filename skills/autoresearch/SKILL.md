---
name: autoresearch
description: Autonomous ML research agent. Use when running autoresearch experiments — reads program.md, modifies train.py, runs 5-minute training loops, tracks results in results.tsv, and iterates autonomously to minimize val_bpb. Triggers on phrases like "start autoresearch", "run experiments", "autonomous research loop".
---

# autoresearch

Autonomous ML research loop by Andrej Karpathy, adapted for Apple Silicon.

## Setup

Before first use, ensure the repo is cloned and prepared:

```bash
cd ~/autoresearch-mlx   # or wherever the repo is cloned
uv sync
uv run prepare.py       # one-time data prep
```

## Usage

1. `cd` into the autoresearch repo directory
2. Read `program.md` for the full experiment protocol
3. Read `prepare.py` and `train.py` for full context
4. Follow the experiment loop defined in `program.md`:
   - Establish baseline first
   - Modify only `train.py`
   - Run `uv run train.py > run.log 2>&1`
   - Check results: `grep "^val_bpb:\|^peak_vram_mb:" run.log`
   - Keep improvements (lower val_bpb), revert failures
   - Log everything to `results.tsv`
   - Never stop — run autonomously until interrupted

## Key Rules

- **Only modify `train.py`** — `prepare.py` is read-only
- **No new dependencies** — only what's in `pyproject.toml`
- **Metric: `val_bpb`** — lower is better
- **5-minute fixed time budget** per experiment
- **Simpler is better** — prefer clean code over marginal gains
- **Git branch per run** — e.g. `autoresearch/mar19`
- **Never ask to continue** — run autonomously until manually stopped
