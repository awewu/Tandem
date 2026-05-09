export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  agentId?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  skills: string[];
  tools: string[];
  temperature: number;
  maxTokens: number;
}

export interface Task {
  id: string;
  title: string;
  schedule: string;
  prompt: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  lastRun?: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  installed: boolean;
  enabled: boolean;
}

export interface StreamChunk {
  content?: string;
  done?: boolean;
  error?: string;
}
