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
    params.append('fields', 'summary,status,priority,updated,sprint');
    params.append('maxResults', '20');
    
    const response = await client.get(`/search/jql?${params.toString()}`);
    
    const issues = response.data.issues;
    console.log(`\n📋 Found ${issues.length} tickets:\n`);
    
    issues.forEach(issue => {
      const priority = issue.fields.priority?.name || 'None';
      const sprint = extractSprintName(issue.fields.sprint);
      console.log(`   ${issue.key.padEnd(12)} ${issue.fields.status.name.padEnd(12)} ${priority.padEnd(8)} ${(sprint || '-').padEnd(20)} ${issue.fields.summary}`);
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

async function createSubtask(parentKey, summary, description) {
  const config = loadConfig();
  const client = createJiraClient(config);
  
  try {
    // First get the parent issue to extract project key
    const parentRes = await client.get(`/issue/${parentKey}`);
    const projectKey = parentRes.data.fields.project.key;
    
    // Parse description with markdown-like formatting into ADF
    const adfContent = parseDescriptionToADF(description);
    
    const response = await client.post('/issue', {
      fields: {
        project: { key: projectKey },
        parent: { key: parentKey },
        summary: summary,
        description: {
          type: 'doc',
          version: 1,
          content: adfContent
        },
        issuetype: { name: 'Sub-task' }
      }
    });
    
    console.log(`✅ Created subtask: ${response.data.key} - ${summary}`);
    return response.data.key;
  } catch (error) {
    console.error(`❌ Error creating subtask: ${error.response?.data?.errorMessages?.[0] || error.message}`);
    throw error;
  }
}

function parseDescriptionToADF(description) {
  const lines = description.split('\\n');
  const content = [];
  let currentParagraph = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === '') {
      // Empty line - flush current paragraph
      if (currentParagraph.length > 0) {
        content.push({ type: 'paragraph', content: currentParagraph });
        currentParagraph = [];
      }
    } else if (trimmed.match(/^\d+\./)) {
      // Numbered list item
      if (currentParagraph.length > 0) {
        content.push({ type: 'paragraph', content: currentParagraph });
        currentParagraph = [];
      }
      content.push({
        type: 'orderedList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: trimmed.replace(/^\d+\.\s*/, '') }]
          }]
        }]
      });
    } else if (trimmed.startsWith('- ')) {
      // Bullet point
      if (currentParagraph.length > 0) {
        content.push({ type: 'paragraph', content: currentParagraph });
        currentParagraph = [];
      }
      content.push({
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: trimmed.substring(2) }]
          }]
        }]
      });
    } else if (trimmed.endsWith(':') && !trimmed.includes(' ')) {
      // Header-like line (ends with colon, no spaces)
      if (currentParagraph.length > 0) {
        content.push({ type: 'paragraph', content: currentParagraph });
        currentParagraph = [];
      }
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: trimmed, marks: [{ type: 'strong' }] }]
      });
    } else {
      // Regular text
      if (currentParagraph.length > 0) {
        currentParagraph.push({ type: 'text', text: ' ' });
      }
      currentParagraph.push({ type: 'text', text: trimmed });
    }
  }
  
  // Flush remaining paragraph
  if (currentParagraph.length > 0) {
    content.push({ type: 'paragraph', content: currentParagraph });
  }
  
  return content.length > 0 ? content : [{ type: 'paragraph', content: [{ type: 'text', text: description }] }];
}

async function updateDescription(issueKey, description) {
  const config = loadConfig();
  const client = createJiraClient(config);
  
  try {
    const adfContent = parseDescriptionToADF(description);
    
    await client.put(`/issue/${issueKey}`, {
      fields: {
        description: {
          type: 'doc',
          version: 1,
          content: adfContent
        }
      }
    });
    console.log(`✅ Updated description for ${issueKey}`);
  } catch (error) {
    console.error(`❌ Error updating description: ${error.response?.data?.errorMessages?.[0] || error.message}`);
  }
}

function extractSprintName(sprintField) {
  if (!sprintField || !Array.isArray(sprintField) || sprintField.length === 0) {
    return null;
  }
  // Sprint field is an array of serialized strings like "com.atlassian.greenhopper.service.sprint.Sprint@...[name=Sprint 42,state=active,...]"
  const sprintStr = sprintField[0];
  const nameMatch = sprintStr.match(/name=([^,]+)/);
  return nameMatch ? nameMatch[1] : null;
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
    
  case 'subtask':
    // Usage: jiracli subtask <parent-key> "<summary>" "<description>"
    if (args.length < 3) {
      console.log('❌ Usage: jiracli subtask <parent-key> "<summary>" "<description>"');
      process.exit(1);
    }
    createSubtask(args[0], args[1], args[2]);
    break;
    
  case 'update-desc':
    // Usage: jiracli update-desc <issue-key> "<description>"
    if (args.length < 2) {
      console.log('❌ Usage: jiracli update-desc <issue-key> "<description>"');
      process.exit(1);
    }
    updateDescription(args[0], args.slice(1).join(' '));
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
  jiracli subtask <PARENT> "summary" "description"  Create subtask
  jiracli update-desc <KEY> "description"           Update issue description

Examples:
  jiracli view V2-5413
  jiracli comment V2-5413 "Fixed in PR #123"
  jiracli transition V2-5413 "In Progress"
`);
}
