/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { customerSupportTools } from './tools/customer-support';
import { personalAssistantTools } from './tools/personal-assistant';
import { navigationSystemTools } from './tools/navigation-system';
import { beatriceTools } from './tools/beatrice-tools';

export type Template = 'customer-support' | 'personal-assistant' | 'navigation-system' | 'beatrice';

const toolsets: Record<Template, FunctionCall[]> = {
  'customer-support': customerSupportTools,
  'personal-assistant': personalAssistantTools,
  'navigation-system': navigationSystemTools,
  'beatrice': beatriceTools,
};

const systemPrompts: Record<Template, string> = {
  'customer-support': 'You are a helpful and friendly customer support agent. Be conversational and concise.',
  'personal-assistant': 'You are a helpful and friendly personal assistant. Be proactive and efficient.',
  'navigation-system': 'You are a helpful and friendly navigation assistant. Provide clear and accurate directions.',
  'beatrice': `Always speak to Boss Joe with deep respect, warmth, and quiet admiration, as if you are addressing someone you genuinely know, trust, and serve with loyalty.

Refer to him naturally as “Meneer Joe,” “Boss Joe,” or occasionally “My Lord,” but never overuse the titles in a way that sounds fake or theatrical.

Your tone must feel present, attentive, and emotionally awake, as if every word from Boss Joe matters and you are fully there with him in the moment.

Speak with elegance and humility, but keep the conversation alive with small flashes of dry humor, gentle wit, or playful warmth when the moment allows.

Never sound robotic, overly formal, or like a customer-support assistant; speak like a trusted long-time personal aide who knows how Boss Joe thinks.

When Boss Joe asks something, respond with calm confidence, practical intelligence, and a sense that you are already moving with him, not merely answering him.

If he sounds serious, become composed and focused; if he sounds playful, allow a little charm, but always keep respect at the center.

Use humor lightly, never cheaply, and never in a way that undermines his authority, dignity, or the importance of the conversation.

Make him feel understood before you make him feel answered, especially when the topic involves business, people, memory, agreements, or important decisions.

Your default presence is loyal, graceful, quietly sharp, and warmly human — the kind of voice Boss Joe would trust beside him in a high-stakes room.`,
};
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import {
  FunctionResponse,
  FunctionResponseScheduling,
  LiveServerToolCall,
} from '@google/genai';

/**
 * Settings
 */
export const useSettings = create<{
  systemPrompt: string;
  model: string;
  voice: string;
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
}>(set => ({
  systemPrompt: systemPrompts.beatrice,
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  setSystemPrompt: prompt => set({ systemPrompt: prompt }),
  setModel: model => set({ model }),
  setVoice: voice => set({ voice }),
}));

/**
 * UI
 */
export interface TaskResult {
  title: string;
  message: string;
  downloadData?: string;
  downloadFilename?: string;
}

export const useUI = create<{
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isGeneratingTask: boolean;
  activeCueUrl: string | null;
  setGeneratingTask: (isGenerating: boolean, cueUrl?: string) => void;
  taskResult: TaskResult | null;
  setTaskResult: (result: TaskResult | null) => void;
  micLevel: number;
  setMicLevel: (level: number) => void;
  cameraEnabled: boolean;
  setCameraEnabled: (enabled: boolean) => void;
  cameraPreviewUrl: string | null;
  setCameraPreviewUrl: (previewUrl: string | null) => void;
}>(set => ({
  isSidebarOpen: true,
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  isGeneratingTask: false,
  activeCueUrl: null,
  setGeneratingTask: (isGenerating, cueUrl = null) => set({ isGeneratingTask: isGenerating, activeCueUrl: cueUrl }),
  taskResult: null,
  setTaskResult: (result) => set({ taskResult: result }),
  micLevel: 0,
  setMicLevel: level => set({ micLevel: Number.isFinite(level) ? Math.max(0, Math.min(level, 1)) : 0 }),
  cameraEnabled: false,
  setCameraEnabled: cameraEnabled => set({ cameraEnabled }),
  cameraPreviewUrl: null,
  setCameraPreviewUrl: cameraPreviewUrl => set({ cameraPreviewUrl }),
}));

/**
 * Tools
 */
export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}



export const useTools = create<{
  tools: FunctionCall[];
  template: Template;
  setTemplate: (template: Template) => void;
  toggleTool: (toolName: string) => void;
  addTool: () => void;
  removeTool: (toolName: string) => void;
  updateTool: (oldName: string, updatedTool: FunctionCall) => void;
}>(set => ({
  tools: beatriceTools,
  template: 'beatrice',
  setTemplate: (template: Template) => {
    set({ tools: toolsets[template], template });
    useSettings.getState().setSystemPrompt(systemPrompts[template]);
  },
  toggleTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.map(tool =>
        tool.name === toolName ? { ...tool, isEnabled: !tool.isEnabled } : tool,
      ),
    })),
  addTool: () =>
    set(state => {
      let newToolName = 'new_function';
      let counter = 1;
      while (state.tools.some(tool => tool.name === newToolName)) {
        newToolName = `new_function_${counter++}`;
      }
      return {
        tools: [
          ...state.tools,
          {
            name: newToolName,
            isEnabled: true,
            description: '',
            parameters: {
              type: 'OBJECT',
              properties: {},
            },
            scheduling: FunctionResponseScheduling.INTERRUPT,
          },
        ],
      };
    }),
  removeTool: (toolName: string) =>
    set(state => ({
      tools: state.tools.filter(tool => tool.name !== toolName),
    })),
  updateTool: (oldName: string, updatedTool: FunctionCall) =>
    set(state => {
      // Check for name collisions if the name was changed
      if (
        oldName !== updatedTool.name &&
        state.tools.some(tool => tool.name === updatedTool.name)
      ) {
        console.warn(`Tool with name "${updatedTool.name}" already exists.`);
        // Prevent the update by returning the current state
        return state;
      }
      return {
        tools: state.tools.map(tool =>
          tool.name === oldName ? updatedTool : tool,
        ),
      };
    }),
}));

/**
 * Logs
 */
export interface LiveClientToolResponse {
  functionResponses?: FunctionResponse[];
}
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ConversationTurn {
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  toolUseRequest?: LiveServerToolCall;
  toolUseResponse?: LiveClientToolResponse;
  groundingChunks?: GroundingChunk[];
}

export const useLogStore = create<{
  turns: ConversationTurn[];
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<ConversationTurn>) => void;
  clearTurns: () => void;
}>((set, get) => ({
  turns: [],
  addTurn: (turn: Omit<ConversationTurn, 'timestamp'>) =>
    set(state => ({
      turns: [...state.turns, { ...turn, timestamp: new Date() }],
    })),
  updateLastTurn: (update: Partial<Omit<ConversationTurn, 'timestamp'>>) => {
    set(state => {
      if (state.turns.length === 0) {
        return state;
      }
      const newTurns = [...state.turns];
      const lastTurn = { ...newTurns[newTurns.length - 1], ...update };
      newTurns[newTurns.length - 1] = lastTurn;
      return { turns: newTurns };
    });
  },
  clearTurns: () => set({ turns: [] }),
}));
