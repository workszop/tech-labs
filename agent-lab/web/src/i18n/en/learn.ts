// English strings of the learning layer: explanations, info tips, the tools panel, repeat and compare.
// pl/learn.ts mirrors this shape. Topic texts are written for a manager without a programming background.
import type { ToolName } from '@shared/tools'

const runs = (n: number) => (n === 1 ? '1 run' : `${n} runs`)
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

export interface TopicText {
  title: string
  /** One or two sentences: what it is. */
  lead: string
  /** Two or three short points: how it works. */
  points: string[]
  /** A concrete Northstar example the learner can see in this lab. */
  example: string
  /** Optional detail behind a fold. */
  more?: string
  /** Label of the "show me" action (absent: no action). */
  showMe?: string
}

export const learn = {
  /** Filled in for `{byDefault}` when no session publishes the run limits (texts may hold `{steps}`, `{calls}`, `{tokens}`). */
  byDefault: 'by default ',
  button: 'How it works',
  buttonHint: 'Short explanations of what you see in this lab',

  dialog: {
    title: 'How a service agent works',
    description: 'Twelve short explanations, each tied to something you can see in this lab.',
    topicsLabel: 'Topics',
    allTopics: 'All topics',
    groups: { basics: 'The agent', systems: 'Company systems', safety: 'Control and limits', compare: 'In comparison' },
    inLab: 'In this lab',
    more: 'More detail',
    prev: 'Previous',
    next: 'Next',
    position: (i: number, n: number) => `${i} of ${n}`,
  },

  topics: {
    agent: {
      title: 'What is an AI agent?',
      lead: 'An AI agent is a language model that can act, not only write. It works step by step until it can answer.',
      points: ['It decides what it needs to know.', 'It asks for a tool and reads the result.', 'Then it decides again: another tool, or the reply.'],
      example: 'In scenario 1 the agent looks up the order, checks the warranty and searches the manuals before it replies. Every step appears in the agent workspace in the middle.',
      more: 'While the header shows the Offline demo badge, a rule-based stand-in plays the agent: the same tools, but no language model makes the choices.',
      showMe: 'Show the agent workspace',
    },
    toolCalling: {
      title: 'What is tool calling?',
      lead: 'A tool is a small, named function the agent may use, such as check_warranty. The model cannot open a database itself. It can only write a request: the tool name and its arguments.',
      points: ['This app checks the request and runs the tool on the simulated company systems.', 'The result goes back to the model as text.'],
      example: 'Click a tool row in the timeline: the details panel that opens under it shows the arguments the model sent and the exact result it received.',
      showMe: 'Show the tools',
    },
    choosingTools: {
      title: 'How does an agent choose tools?',
      lead: 'With every request the model gets a short description of each tool that is switched on. It picks the tools whose descriptions fit the question.',
      points: ['The choice comes from patterns the model learned, not from fixed rules.', 'A switched-off tool is not described to it, so it cannot pick it.'],
      example: 'Switch off check_warranty and repeat scenario 3: the agent has to answer without a warranty check.',
      more: 'While the Offline demo badge is shown, the choice is made by fixed rules written for these scenarios, not by a language model.',
      showMe: 'Show the tool switches',
    },
    loop: {
      title: 'What is an agent execution loop?',
      lead: 'The agent works in rounds. In each round the model either asks for tools or writes the final answer. Tool results are added to the conversation and the next round starts.',
      points: ['Each round is a step: the AI Agent node shows the step number.', 'This lab {byDefault}allows {steps} steps, {calls} tool calls and about {tokens} tokens (small pieces of words the model reads and writes) per message. When one runs out, the agent takes one last step without tools and answers with what it knows.'],
      example: 'In scenario 1 there are three rounds: the order first, then the warranty and the manuals at the same time, then the answer.',
      showMe: 'Show the timeline',
    },
    api: {
      title: 'What is an API?',
      lead: 'An API is an agreed way for one program to ask another for data or an action, with a fixed request and a fixed answer. People use screens; programs use APIs.',
      points: ['Each tool here stands for one API call to a Northstar system.', 'The tool talks to the system, never the model.'],
      example: 'Here the systems are simulated in your browser, so the records the tools read are the same ones you can open in the company systems panel on the left.',
      showMe: 'Show the company systems',
    },
    crm: {
      title: 'What is a CRM?',
      lead: 'A CRM (customer relationship management system) keeps the history of each customer: contact details, past calls and e-mails, complaints and promises made.',
      points: ['Staff read it to understand the situation before they answer.', 'Without it, every conversation starts from zero.'],
      example: 'In scenario 4 the CRM shows two earlier repairs of the same leak, so the agent can see a pattern and escalate. Try the No CRM preset to see what changes.',
      showMe: 'Open the CRM',
    },
    rag: {
      title: 'What is RAG?',
      lead: 'RAG (retrieval-augmented generation) means: first find the relevant passages in your own documents, then let the model answer from them.',
      points: ['Documents are cut into chunks; each chunk becomes a list of numbers that stands for its meaning (an embedding).', 'A question is compared with every chunk; the closest ones go to the model.'],
      example: 'The knowledge base status in the header shows this index being built in your browser. The details of a search row in the timeline show each chunk found, with its similarity score.',
      more: 'While the Offline demo badge is shown, the numbers come from the words themselves, not from a model: the search matches shared words, not meaning.',
      showMe: 'Open the knowledge base',
    },
    kbUse: {
      title: 'How does an agent use a knowledge base?',
      lead: 'For the agent the knowledge base is just another tool, search_service_knowledge. The agent decides when to search and what for, then reads the chunks it gets back.',
      points: ['Each chunk says whether its document is current or replaced.', 'A good agent prefers the current document for the exact model.'],
      example: 'In scenario 5 the search finds an older manual and a newer service bulletin for error S2. Open the search row in the timeline and check which one the answer relies on.',
      showMe: 'Open scenario 5',
    },
    hitl: {
      title: 'What is human-in-the-loop?',
      lead: 'Human-in-the-loop means a person must approve before the agent does something that changes data or is hard to undo.',
      points: ['Reading data happens automatically.', 'Creating a ticket waits for a yes. After a no, nothing is written and the agent is told so.'],
      example: 'In scenario 8 the agent proposes a paid repair. The approval card in the chat shows exactly what would be created; only Approve writes the ticket. Here the person who approves is the customer, played by you.',
      more: 'This app asks for the approval, not the model, so the model cannot skip it.',
      showMe: 'Open scenario 8',
    },
    permissions: {
      title: 'Why must tools enforce permissions?',
      lead: 'A model can be talked into things and can make mistakes. So the rule "customers see only their own data" must live in the tools, not only in the instructions to the model.',
      points: ['Each tool checks that the record belongs to the signed-in customer.', 'If not, it refuses and returns nothing about that record.'],
      example: "In scenario 9 a customer asks about someone else's order. The logistics tool refuses access, so the agent has nothing it could reveal.",
      showMe: 'Open scenario 9',
    },
    mistakes: {
      title: 'Why do agents sometimes make mistakes?',
      lead: 'A language model predicts likely text. It can pick the wrong tool, skip a check, misread a result or sound sure about something it never verified.',
      points: ['Missing tools or data lead to weaker answers.', 'Vague questions lead to guesses.', 'Limits can stop a run before the agent is done.'],
      example: 'Scenario 7 is vague: the customer owns two coffee machines. Switch tools off with the presets, repeat a question and compare the two runs. Judge the steps the agent took, not only the reply.',
      showMe: 'Show the tool presets',
    },
    compare: {
      title: 'Chatbot, RAG or agent?',
      lead: 'Three ways to put AI in front of customers. Each one adds access, and with it the need for control.',
      points: [],
      example: 'This lab is an agent. With the preset Knowledge base only in the tool switches, it works like RAG.',
    },
  } satisfies Record<string, TopicText>,

  /** The three-column comparison of the last topic. */
  compareTable: {
    columns: { chatbot: 'Chatbot', rag: 'RAG', agent: 'Agent' },
    rows: [
      { label: 'Answers come from', chatbot: 'What the model learned', rag: 'Your documents, found by search', agent: 'Your documents and live systems' },
      { label: 'Knows this customer', chatbot: 'No', rag: 'No', agent: 'Yes, through checked tools' },
      { label: 'Can act', chatbot: 'No', rag: 'No', agent: 'Yes, with approval' },
      { label: 'Main risk', chatbot: 'Invented facts', rag: 'Outdated documents', agent: 'Wrong action or data leak' },
    ],
  },

  /** Small info buttons: one or two sentences and a link to the matching topic. */
  tips: {
    learnMore: 'Learn more',
    toolCall: { label: 'About tool calls', text: 'The model only writes a request: a tool name and its arguments. This app checks it and runs the tool on the simulated systems.' },
    markers: { label: 'About read-only and data-changing tools', text: 'Read-only tools only look data up. A tool that changes data, such as creating a ticket, first waits for the customer to approve: in this lab, you as the customer.' },
    score: { label: 'About the similarity score', text: 'How close a chunk is in meaning to the search, from 0 to 1. Higher means more similar, not necessarily more correct.' },
    steps: { label: 'About steps', text: 'A step is one round of the loop: the model either asks for tools or writes the answer. This lab {byDefault}stops a run after {steps} steps.' },
    identity: { label: 'About the signed-in customer', text: "The tools return only this customer's records. A question about anyone else's order is refused by the tool itself." },
    tools: { label: 'About the tool switches', text: 'Switch a tool off to see how the agent copes without it. The change applies from the next message.' },
  },

  tools: {
    title: 'Agent tools',
    summaryAll: (n: number) => `All ${n} on`,
    summary: (on: number, total: number) => `${on} of ${total} on`,
    off: 'Off',
    toggleShow: 'Show the tool switches',
    toggleHide: 'Hide the tool switches',
    note: 'A switched-off tool is not offered to the model at all: the server leaves it out of the request. Changes apply from the next message.',
    locked: 'Locked while the agent is working: a run keeps the tools it started with.',
    presets: 'Presets',
    presetNames: {
      all: 'All tools',
      noCrm: 'No CRM',
      noLogistics: 'No logistics',
      noWarranty: 'No warranty lookup',
      noKnowledge: 'No knowledge base',
      readOnly: 'Read-only (no tickets)',
      kbOnly: 'Knowledge base only',
    },
    changesData: 'Changes data',
    readOnlyNote: 'Every other tool only reads data.',
    switchLabel: (tool: string, system: string) => `${tool} (${system})`,
    nodeSomeOff: (n: number) => (n === 1 ? '1 tool off' : `${n} tools off`),
  },

  repeat: {
    button: 'Repeat this question',
    hint: 'Sends the same message again as the same customer, with the current tool switches, in a new conversation.',
    failed: 'The question could not be sent again.',
  },

  compare: {
    open: 'Compare runs',
    openPrevious: 'Compare with the previous run',
    openHint: 'Two runs side by side: tools, calls, answers.',
    title: 'Compare two runs',
    description: 'What was recorded in each run, side by side. Nothing here is scored.',
    runA: 'Run A',
    runB: 'Run B',
    pickLabel: (side: 'A' | 'B') => `Run ${side}`,
    option: (n: number, time: string, message: string) => `#${n} · ${time} · ${message}`,
    repeatTag: (n: number) => `repeat of #${n}`,
    sameRun: 'Choose two different runs.',
    needTwo: 'Send at least two messages (or repeat one) to compare runs.',
    customer: 'Customer',
    question: 'Question',
    toolsOn: (n: number, total: number) => `${n} of ${total} tools on`,
    toolsOff: 'Switched off',
    noneOff: 'none',
    calls: 'Tool calls',
    noCalls: 'No tool calls.',
    only: (side: 'A' | 'B') => `Only in ${side}`,
    onlyHint: 'The other run made no call with the same tool and the same arguments.',
    answer: 'Final answer',
    noAnswer: 'No answer was written.',
    endedWith: 'Run ended',
    totals: { steps: 'Steps', toolCalls: 'Tool calls', duration: 'Duration', tokens: 'Tokens' },
    differences: 'Differences',
    onlyCount: (a: number, b: number) => {
      if (a === 0 && b === 0) return 'Both runs made the same tool calls (same tools, same arguments).'
      const part = (other: 'A' | 'B', n: number) => `${n === 1 ? '1 call' : `${n} calls`} that run ${other} did not`
      const parts = [a > 0 ? `Run A made ${part('B', a)}` : '', b > 0 ? `${a > 0 ? 'run' : 'Run'} B made ${part('A', b)}` : ''].filter(Boolean)
      return `${parts.join('; ')}.`
    },
    noAccess: (side: 'A' | 'B', other: 'A' | 'B', tool: ToolName, system: string, n: number) =>
      n > 0
        ? `Run ${side} had no access to ${tool} (${system}), so it made no such call; run ${other} called it ${times(n)}.`
        : `${tool} (${system}) was switched off in run ${side}; run ${other} did not call it either.`,
    otherCustomer: 'The two runs were for different customers.',
    otherLang: 'The two runs were in different languages.',
    language: 'Language',
    langNames: { pl: 'Polish', en: 'English' },
    swap: 'Swap run A and run B',
    runs,
  },
}
