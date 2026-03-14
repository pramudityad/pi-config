---
name: pgcli
description: PostgreSQL CLI for querying databases, exploring schemas, and analyzing data. Use when the user asks about database contents, table structures, data exploration, debugging data issues, or running SQL queries.
---

# PostgreSQL CLI

Command-line interface for PostgreSQL database operations.

## Installation

```bash
cd ~/.pi/agent/skills/pi-skills/pgcli
npm install -g .
```

## Setup

### Add a connection profile

```bash
pgcli config add local
```

Enter: host, port, database, user, password, ssl, readonly.

Profiles stored in `~/.pgcli/config.json`.

## Usage

### Profile Management

```bash
pgcli config add <name>        # Add connection profile (interactive)
pgcli config remove <name>     # Remove a profile
pgcli config list              # List all profiles
pgcli config default <name>    # Set default profile
```

### Run Queries

```bash
pgcli query "SELECT * FROM users LIMIT 10"
pgcli query "SELECT * FROM users" --profile staging
pgcli query "SELECT * FROM users" -p staging
pgcli query "SELECT * FROM orders" --limit 50
pgcli query "SELECT * FROM orders" --limit 0    # No limit
```

Auto-LIMIT: SELECT queries without LIMIT get `LIMIT 100` by default.

### Schema Exploration

```bash
pgcli tables                        # List tables (public schema)
pgcli tables --schema auth          # Tables in specific schema
pgcli describe users                # Columns, types, indexes
pgcli indexes users                 # Indexes on table
pgcli schemas                       # List all schemas
```

### Common Flags

- `--profile, -p <name>` — Use specific profile (default: default profile)
- `--limit <n>` — Row limit for SELECT (default: 100, 0 = unlimited)
- `--schema <name>` — Schema filter (default: public)

## Safety

- **Read-only by default** — INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE are blocked when profile has `readonly: true`
- All output is JSON for easy parsing

## Output Format

All results are JSON:

```json
{
  "rows": [{"id": 1, "name": "John"}],
  "rowCount": 1,
  "duration": "12ms"
}
```

## Common Workflows

### Explore a database
```bash
pgcli schemas -p staging
pgcli tables -p staging
pgcli describe users -p staging
pgcli query "SELECT * FROM users ORDER BY created_at DESC" -p staging --limit 5
```

### Check migration
```bash
pgcli describe <table>
```

### Data analysis
```bash
pgcli query "SELECT status, COUNT(*) FROM orders GROUP BY status"
```

## Troubleshooting

**Connection refused:**
- Check host/port are correct
- Verify database is running
- Run `pgcli config list` to check profile settings

**Permission denied:**
- Check user/password
- Verify user has access to the database

**Read-only error:**
- Profile has `readonly: true` by default
- Edit `~/.pgcli/config.json` to set `readonly: false` if needed
