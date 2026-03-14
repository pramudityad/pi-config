#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(require('os').homedir(), '.jiracli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('❌ Jira CLI not configured. Run: jiracli config');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function createJiraClient(config) {
  const auth = Buffer.from(`${config.email}:${config.token}`).toString('base64');
  return axios.create({
    baseURL: `${config.baseUrl}/rest/api/3`,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

async function viewTicket(issueKey) {
  const config = loadConfig();
  const client = createJiraClient(config);
  
  try {
    const response = await client.get(`/issue/${issueKey}`);
    const issue = response.data;
    
    console.log(`\n📋 ${issue.key}: ${issue.fields.summary}`);
    console.log(`   Status: ${issue.fields.status.name}`);
    console.log(`   Type: ${issue.fields.issuetype.name}`);
    console.log(`   Priority: ${issue.fields.priority?.name || 'None'}`);
    console.log(`   Assignee: ${issue.fields.assignee?.displayName || 'Unassigned'}`);
    console.log(`   Reporter: ${issue.fields.reporter?.displayName || 'Unknown'}`);
    console.log(`   Created: ${issue.fields.created}`);
    console.log(`   Updated: ${issue.fields.updated}`);
    
    if (issue.fields.description) {
      console.log(`\n📝 Description:`);
      console.log(formatContent(issue.fields.description));
    }
    
    console.log(`\n🔗 ${config.baseUrl}/browse/${issueKey}\n`);
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.errorMessages?.[0] || error.message}`);
  }
}

async function listTickets(options = {}) {
  const config = loadConfig();
  const client = createJiraClient(config);
  
  let conditions = ['assignee = currentUser()'];
  
  if (options.status) {
    conditions.push(`status = "${options.status}"`);
  } else if (!options.sprint) {
    // Only exclude Done if not filtering by sprint (show all sprint tickets)
    conditions.push('status != Done');
  }
  
  if (options.sprint) {
    conditions.push('sprint in openSprints()');
  }
  
  const jql = options.jql || conditions.join(' AND ');
  
  try {
    // Use GET with query parameters instead of POST (API v3)
    const params = new URLSearchParams();
    params.append('jql', jql);
    params.append('fields', 'summary,status,priority,updated');
    params.append('maxResults', '20');
    
    const response = await client.get(`/search/jql?${params.toString()}`);
    
    const issues = response.data.issues;
    console.log(`\n📋 Found ${issues.length} tickets:\n`);
    
    issues.forEach(issue => {
      const priority = issue.fields.priority?.name || 'None';
      console.log(`   ${issue.key.padEnd(12)} ${issue.fields.status.name.padEnd(12)} ${priority.padEnd(8)} ${issue.fields.summary}`);
    });
    console.log();
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.errorMessages?.[0] || error.message}`);
  }
}

async function addComment(issueKey, comment) {
  const config = loadConfig();
  const client = createJiraClient(config);
  
  try {
    await client.post(`/issue/${issueKey}/comment`, {
      body: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: comment }]
        }]
      }
    });
    console.log(`✅ Comment added to ${issueKey}`);
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.errorMessages?.[0] || error.message}`);
  }
}

async function transitionTicket(issueKey, transitionName) {
  const config = loadConfig();
  const client = createJiraClient(config);
  
  try {
    // Get available transitions
    const transitionsRes = await client.get(`/issue/${issueKey}/transitions`);
    const transitions = transitionsRes.data.transitions;
    
    const transition = transitions.find(t => 
      t.name.toLowerCase() === transitionName.toLowerCase()
    );
    
    if (!transition) {
      console.log('❌ Available transitions:');
      transitions.forEach(t => console.log(`   - ${t.name}`));
      return;
    }
    
    await client.post(`/issue/${issueKey}/transitions`, {
      transition: { id: transition.id }
    });
    console.log(`✅ ${issueKey} transitioned to "${transition.name}"`);
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.errorMessages?.[0] || error.message}`);
  }
}

async function assignTicket(issueKey, assignee) {
  const config = loadConfig();
  const client = createJiraClient(config);
  
  try {
    await client.put(`/issue/${issueKey}/assignee`, {
      accountId: assignee === 'me' ? null : assignee
    });
    console.log(`✅ ${issueKey} assigned`);
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.errorMessages?.[0] || error.message}`);
  }
}

function formatContent(doc) {
  if (!doc || !doc.content) return '';
  return doc.content.map(c => {
    if (c.type === 'paragraph') {
      return c.content?.map(t => t.text || '').join('') || '';
    }
    return '';
  }).join('\n').substring(0, 500) + '...';
}

// CLI
const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'config':
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Jira base URL (e.g., https://cloudeatsgroup.atlassian.net): ', baseUrl => {
      readline.question('Your email: ', email => {
        readline.question('API token: ', token => {
          saveConfig({ baseUrl: baseUrl.trim(), email: email.trim(), token: token.trim() });
          console.log('✅ Configuration saved');
          readline.close();
        });
      });
    });
    break;
    
  case 'view':
    viewTicket(args[0]);
    break;
    
  case 'list':
    const options = {};
    if (args.includes('--status')) {
      const idx = args.indexOf('--status');
      options.status = args[idx + 1];
    }
    if (args.includes('--sprint')) {
      options.sprint = true;
    }
    listTickets(options);
    break;
    
  case 'comment':
    addComment(args[0], args.slice(1).join(' '));
    break;
    
  case 'transition':
    transitionTicket(args[0], args.slice(1).join(' '));
    break;
    
  case 'assign':
    assignTicket(args[0], args[1] || 'me');
    break;
    
  default:
    console.log(`
📋 Jira CLI

Usage:
  jiracli config                    Configure credentials
  jiracli view <KEY>                View ticket details
  jiracli list                      List your open tickets
  jiracli list --status "Done"      List tickets by status
  jiracli comment <KEY> <text>      Add comment
  jiracli transition <KEY> <name>   Transition ticket
  jiracli assign <KEY> [accountId]  Assign ticket

Examples:
  jiracli view V2-5413
  jiracli comment V2-5413 "Fixed in PR #123"
  jiracli transition V2-5413 "In Progress"
`);
}
