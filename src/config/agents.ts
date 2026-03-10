// BELIEVE Content — Agent Registry

export const AGENTS = {
  SCOUT: {
    name: 'SCOUT',
    role: 'Intelligence Gathering',
    description: 'Scrapes watchlist Facebook pages for 美业 content, extracts engagement data and topics',
  },
  IRIS: {
    name: 'IRIS',
    role: 'AI Intelligence & Voice',
    description: 'Rewrites content in Daniel\'s voice (70% Mandarin / 30% English), generates image prompts',
    model: 'claude-opus-4-6',
  },
  IMAGEN: {
    name: 'IMAGEN',
    role: 'Image Generation',
    description: 'Generates images via Imagen 4.0 based on IRIS image prompts',
  },
  PHANTOM: {
    name: 'PHANTOM',
    role: 'Browser Automation',
    description: 'Playwright-based Facebook posting, handles login sessions and publishing flow',
  },
  STAGE: {
    name: 'STAGE',
    role: 'Dashboard & UX',
    description: 'Approval dashboard for Daniel — review and approve content before publishing',
  },
} as const;

export type AgentName = keyof typeof AGENTS;
