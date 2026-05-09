export interface HermesTool {
  id: string;
  name: string;
  description: string;
  category: string;
  commands: string[];
  noApiKey?: boolean;
}

export const HERMES_TOOLS: HermesTool[] = [
  { id: 'web_search', name: 'Web Search & Scraping', description: 'Search the web and extract page content', category: 'web', commands: ['web_search', 'web_extract'], noApiKey: true },
  { id: 'browser', name: 'Browser Automation', description: 'Navigate, click, type, scroll on web pages', category: 'web', commands: ['navigate', 'click', 'type', 'scroll'] },
  { id: 'terminal', name: 'Terminal & Processes', description: 'Execute shell commands and manage processes', category: 'system', commands: ['terminal', 'process'] },
  { id: 'file', name: 'File Operations', description: 'Read, write, patch, and search files', category: 'system', commands: ['read', 'write', 'patch', 'search'] },
  { id: 'execute_code', name: 'Code Execution', description: 'Run code in a sandboxed environment', category: 'code', commands: ['execute_code'] },
  { id: 'vision_analyze', name: 'Vision / Image Analysis', description: 'Analyze images and visual content', category: 'media', commands: ['vision_analyze'], noApiKey: true },
  { id: 'image_generate', name: 'Image Generation', description: 'Generate images from text prompts', category: 'media', commands: ['image_generate'] },
  { id: 'mixture_of_agents', name: 'Mixture of Agents', description: 'Combine multiple agents for complex tasks', category: 'agent', commands: ['mixture_of_agents'], noApiKey: true },
  { id: 'text_to_speech', name: 'Text-to-Speech', description: 'Convert text to spoken audio', category: 'media', commands: ['text_to_speech'] },
  { id: 'skills_mgmt', name: 'Skills Management', description: 'List, view, and manage skills', category: 'agent', commands: ['skills'] },
  { id: 'todo', name: 'Task Planning', description: 'Create and manage todo lists', category: 'productivity', commands: ['todo'] },
  { id: 'memory', name: 'Memory', description: 'Persistent memory across sessions', category: 'agent', commands: ['memory'] },
  { id: 'session_search', name: 'Session Search', description: 'Search past conversations', category: 'agent', commands: ['session_search'] },
  { id: 'clarify', name: 'Clarifying Questions', description: 'Ask the user for clarification', category: 'agent', commands: ['clarify'] },
  { id: 'delegate_task', name: 'Task Delegation', description: 'Delegate work to sub-agents', category: 'agent', commands: ['delegate_task'] },
  { id: 'cronjob', name: 'Cron Jobs', description: 'Schedule recurring tasks', category: 'system', commands: ['cronjob'] },
  { id: 'send_message', name: 'Cross-Platform Messaging', description: 'Send messages to Discord, Telegram, etc.', category: 'messaging', commands: ['send_message'] },
  { id: 'rl_training', name: 'RL Training', description: 'Tinker-Atropos reinforcement learning tools', category: 'ml', commands: ['rl_training'], noApiKey: true },
  { id: 'homeassistant', name: 'Home Assistant', description: 'Smart home device control', category: 'iot', commands: ['homeassistant'], noApiKey: true },
  { id: 'spotify', name: 'Spotify', description: 'Playback, search, playlists, library control', category: 'media', commands: ['spotify'] },
  { id: 'yuanbao', name: 'Yuanbao', description: 'Group info, member queries, DM', category: 'messaging', commands: ['yuanbao'] },
];

export const TOOL_CATEGORIES = Array.from(new Set(HERMES_TOOLS.map((t) => t.category)));
