#!/usr/bin/env node

const { configCommand } = require('./lib/config');
const { queryCommand } = require('./lib/query');
const { tablesCommand, describeCommand, indexesCommand, schemasCommand } = require('./lib/schema');

const [,, cmd, ...args] = process.argv;

// Parse --profile / -p flag from args
function parseProfile(args) {
  let profile = null;
  const cleaned = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' || args[i] === '-p') {
      profile = args[++i];
    } else {
      cleaned.push(args[i]);
    }
  }
  return { profile, args: cleaned };
}

// Parse --limit flag from args
function parseLimit(args) {
  let limit = 100;
  const cleaned = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit') {
      limit = parseInt(args[++i], 10);
    } else {
      cleaned.push(args[i]);
    }
  }
  return { limit, args: cleaned };
}

// Parse --schema flag from args
function parseSchema(args) {
  let schema = 'public';
  const cleaned = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--schema') {
      schema = args[++i];
    } else {
      cleaned.push(args[i]);
    }
  }
  return { schema, args: cleaned };
}

async function main() {
  try {
    switch (cmd) {
      case 'config': {
        const [subcmd, ...rest] = args;
        await configCommand(subcmd, rest);
        break;
      }
      case 'query': {
        const p = parseProfile(args);
        const l = parseLimit(p.args);
        const sql = l.args[0];
        if (!sql) {
          console.error(JSON.stringify({ error: 'Usage: pgcli query "SQL" [--profile name] [--limit n]' }));
          process.exit(1);
        }
        await queryCommand(sql, { profile: p.profile, limit: l.limit });
        break;
      }
      case 'tables': {
        const p = parseProfile(args);
        const s = parseSchema(p.args);
        await tablesCommand({ profile: p.profile, schema: s.schema });
        break;
      }
      case 'describe': {
        const p = parseProfile(args);
        const table = p.args[0];
        if (!table) {
          console.error(JSON.stringify({ error: 'Usage: pgcli describe <table> [--profile name]' }));
          process.exit(1);
        }
        await describeCommand(table, { profile: p.profile });
        break;
      }
      case 'indexes': {
        const p = parseProfile(args);
        const table = p.args[0];
        if (!table) {
          console.error(JSON.stringify({ error: 'Usage: pgcli indexes <table> [--profile name]' }));
          process.exit(1);
        }
        await indexesCommand(table, { profile: p.profile });
        break;
      }
      case 'schemas': {
        const p = parseProfile(args);
        await schemasCommand({ profile: p.profile });
        break;
      }
      default:
        console.log(`
pgcli — PostgreSQL CLI for Pi

Usage:
  pgcli config add <name>           Add connection profile
  pgcli config remove <name>        Remove a profile
  pgcli config list                 List all profiles
  pgcli config default <name>       Set default profile

  pgcli query "SQL"                 Run a query
  pgcli tables                      List tables
  pgcli describe <table>            Describe table structure
  pgcli indexes <table>             List indexes
  pgcli schemas                     List schemas

Flags:
  --profile, -p <name>              Use specific profile
  --limit <n>                       Row limit (default: 100, 0 = no limit)
  --schema <name>                   Schema filter (default: public)
`);
    }
  } catch (err) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

main();
