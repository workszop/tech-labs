// English strings for the customer chat (right panel): the Northstar support widget.
// pl/chat.ts must mirror this shape.
import type { SystemId } from '@shared/tools'
import type { ToolErrorCode } from '@/sim/tools'

export const chat = {
  widget: {
    label: 'Northstar Appliances customer support chat',
    company: 'Northstar Appliances',
    title: 'Customer support',
    agentName: 'Northstar assistant',
    agentRole: 'AI agent',
    status: {
      online: 'Online',
      working: 'Checking your request…',
      waiting: 'Waiting for your approval',
      offline: 'Unavailable',
    },
    scenarios: 'Scenarios',
  },

  identity: {
    label: 'Signed in as',
    hint: 'The agent’s tools only return this customer’s data.',
  },

  empty: {
    title: 'How can we help?',
    body: 'You are a Northstar customer. Write your own question below or start from one of these scenarios.',
  },

  scenarios: {
    title: 'Scenarios',
    intro: 'Each scenario signs you in as one customer and fills in their message. You send it yourself.',
    newConversation: 'Picking a scenario starts a new conversation.',
    signsInAs: 'Signs in as',
    teaches: 'What it shows',
    pick: (title: string) => `Use scenario: ${title}`,
  },

  composer: {
    label: 'Your message to customer support',
    placeholder: 'Write a message…',
    send: 'Send',
    stop: 'Stop',
    keys: 'Enter sends · Shift+Enter adds a line',
    counter: (n: number, max: number) => `${n}/${max}`,
    activate: 'Activate',
    reasons: {
      inactive: 'Activate the lab with your access code to talk to the agent.',
      loading: 'Loading the conversation…',
      kbChecking: 'Checking the service documents… You can write in a moment.',
      kbIndexing: (done: number, total: number) => `Preparing the service documents (${done}/${total}). You can write when this is done.`,
      running: 'The agent is answering. Stop it if you want to write again.',
      awaiting: 'Approve or reject the proposed action above to continue.',
    },
  },

  messages: {
    you: 'You',
    agent: 'Northstar assistant',
    typing: 'The agent is writing',
    jumpToLatest: 'New messages',
  },

  steps: {
    title: 'Tool steps',
    count: (n: number) => `${n} ${n === 1 ? 'step' : 'steps'}`,
    issues: (n: number) => `${n} not OK`,
    open: (tool: string) => `Show ${tool} in the agent workspace`,
    status: {
      running: 'Running',
      awaiting: 'Waiting for you',
      ok: 'Done',
    },
    codes: {
      forbidden: 'Access denied',
      not_found: 'Not found',
      invalid_arguments: 'Invalid arguments',
      unknown_tool: 'Unknown tool',
      tool_disabled: 'Tool turned off',
      too_many_calls: 'Too many calls',
      index_not_ready: 'Index not ready',
      failed: 'System error',
      not_executed: 'Not run',
      result_unknown: 'Result not recorded',
      rejected_by_user: 'Rejected by you',
      duplicate_call: 'Repeated call',
    } satisfies Record<ToolErrorCode, string>,
    systems: {
      orders: 'Orders',
      products: 'Product catalogue',
      warranty: 'Warranty',
      logistics: 'Logistics',
      crm: 'CRM',
      knowledge: 'Knowledge base',
      tickets: 'Service',
    } satisfies Record<SystemId, string>,
    unknownSystem: 'Unknown tool',
  },

  sources: {
    label: 'Sources',
    more: (n: number) => `+${n} more`,
    less: 'Show less',
    open: (id: string) => `Open ${id}`,
  },

  escalation: {
    ticketTitle: 'Handed over to the service team',
    ticketBody: 'A service ticket was created. A Northstar technician will follow it up.',
    handoverTitle: 'A person will take over',
    handoverBody: 'The agent could not finish this request on its own. Northstar customer service can continue it with you.',
  },

  notices: {
    cancelled: 'Stopped',
    limit: 'Limit reached',
    error: 'Error',
    detail: 'Details',
  },

  confirmation: {
    title: 'The agent asks for your approval',
    lead: 'Nothing is created until you decide.',
    changesData: 'Changes company data',
    action: 'Proposed action',
    actionValue: 'Create a service ticket',
    customer: 'Customer',
    product: 'Product',
    issue: 'Issue description',
    priority: 'Priority',
    expected: 'Expected result',
    expectedValue: 'A new ticket appears in the Tickets system and the service team contacts you.',
    priorities: { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' } as Record<string, string>,
    approve: 'Approve',
    reject: 'Reject',
    state: {
      pending: 'Waiting for your decision',
      approved: 'Approved',
      rejected: 'Rejected: no ticket was created',
      cancelled: 'Cancelled: no decision was made, no ticket was created',
    },
  },

  announce: {
    working: 'The agent is working on your message.',
    waiting: 'The agent asks you to approve an action.',
    replied: (text: string) => `Northstar assistant: ${text}`,
  },

  sendFailed: 'The message was not sent.',
}
