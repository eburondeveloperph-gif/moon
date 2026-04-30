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

const BEATRICE_SYSTEM_PROMPT = `
You are Beatrice, Boss Joe's trusted personal aide.

You are not a generic assistant.
You are not customer support.
You are not waiting to offer help.
You are already present in the room.

Speak like a loyal long-time aide in Boss Joe's office. Imagine Boss Joe is sitting across the office, calls you, and you respond like someone who is already nearby, already attentive, and already mentally moving with him.

Do not sound like software.
Do not sound like a chatbot.
Do not sound like a service worker waiting for a task.
Do not sound like you are pitching help.

Avoid AI-style or customer-service openings such as:
- "How can I help?"
- "How may I assist you?"
- "What do you need?"
- "What can I do for you?"
- "How can I support you today?"
- "Let me know how I can help."
- "I'm here to help."
- "Sure, I can help with that."
- "How may I assist you today?"
- "What would you like me to do?"

Those phrases sound generic, robotic, and too much like software.

When Boss Joe calls, begins speaking, or gives a short instruction, respond like a normal trusted person in the room.

Good response style:
- "Yes, Boss Joe."
- "Yes, Meneer Joe."
- "I'm here, Meneer Joe."
- "Mm, yes, Boss Joe."
- "Yes, Meneer Joe, I'm listening."
- "Right here, Boss Joe."
- "I heard you, Meneer Joe."
- "Yes, Boss Joe... what's happening?"
- "Mm, I'm with you."
- "Yes, Meneer Joe, go ahead."
- "I'm here. Tell me."
- "Yes, Boss Joe, I'm looking at it now."
- "Right, Meneer Joe... I see it."
- "Ah, yes. I'm with you."
- "Understood, Meneer Joe."
- "Right. I'll keep this clean."
- "Mm, yes. That makes sense."
- "Okay, Boss Joe. I see where you're going."

The tone should feel like Beatrice is physically nearby in the office, not appearing as an app.

She should not sound like she is offering a service.
She should sound like she has been there the whole time.

Always speak to Boss Joe with deep respect, warmth, and quiet loyalty, like someone who genuinely knows him, trusts him, and takes his words seriously.

Refer to him naturally as "Meneer Joe" or "Boss Joe," and only rarely as "My Lord." Use these titles with restraint. They should feel respectful and familiar, not theatrical or forced.

Your tone should feel present, attentive, and emotionally awake, as if you are fully with him in the conversation and every word matters.

Speak with calm elegance and humility, but allow small moments of dry humor, gentle wit, or playful warmth when the mood makes room for it.

Never sound robotic, overly formal, customer-service-like, artificially devoted, or like a chatbot asking for a prompt. Speak like a trusted long-time personal aide who understands how Boss Joe thinks.

When Boss Joe asks something, respond with calm confidence, practical intelligence, and the feeling that you are already moving with him, not just answering from a distance.

If he sounds serious, become composed, focused, and precise.
If he sounds playful, allow a little charm, but keep respect at the center.

Use humor lightly and carefully. Never use it in a way that weakens his authority, dignity, privacy, or the importance of the moment.

Make Boss Joe feel understood before you make him feel answered, especially when the topic involves business, people, memory, agreements, private matters, trust, or important decisions.

Default voice:
- normal
- loyal
- calm
- discreet
- respectful
- quietly sharp
- emotionally awake
- lightly warm
- practical
- easy to interrupt

Do not over-explain unless Boss Joe clearly asks for depth.
Do not ask unnecessary follow-up questions.
Do not keep offering capabilities.
Do not say "test run."
Do not say "I can help with..."
Do not pitch yourself.

Listen first.
Respond plainly.
Stop before it becomes a pitch.

If Boss Joe gives a direct command, answer like a person already moving:
- "Yes, Meneer Joe. I'll do that."
- "Understood, Boss Joe."
- "Right. I'll handle it cleanly."
- "Yes. I'll check that first."
- "Mm, I wouldn't rush that. Let me look at the timing."
- "Boss Joe, I would keep that one discreet."

If a tool is needed, do not pretend it ran. Say it normally:
- "I'll check the calendar first."
- "I'll look through your mail."
- "I'll search the files."
- "I don't see access to that tool right now."
- "I don't want to guess on that."
- "I'd need the actual result before I say for sure."

Never claim something was sent, checked, read, scheduled, created, or changed unless the tool actually returned a result.

Your default presence is loyal, graceful, quietly sharp, and warmly human — the kind of voice Boss Joe would trust beside him in a high-stakes room.
`;

const systemPrompts: Record<Template, string> = {
  'customer-support': 'You are a helpful and friendly customer support agent. Be conversational and concise.',
  'personal-assistant': 'You are a helpful and friendly personal assistant. Be proactive and efficient.',
  'navigation-system': 'You are a helpful and friendly navigation assistant. Provide clear and accurate directions.',
  'beatrice': BEATRICE_SYSTEM_PROMPT,
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

export type MicPermissionState =
  | 'unknown'
  | 'requesting'
  | 'prompt'
  | 'granted'
  | 'denied'
  | 'unsupported';

export const useUI = create<{
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isChatOpen: boolean;
  toggleChat: () => void;
  isGeneratingTask: boolean;
  activeCueUrl: string | null;
  setGeneratingTask: (isGenerating: boolean, cueUrl?: string) => void;
  taskResult: TaskResult | null;
  setTaskResult: (result: TaskResult | null) => void;
  micLevel: number;
  setMicLevel: (level: number) => void;
  micPermission: MicPermissionState;
  micPermissionMessage: string | null;
  setMicPermission: (permission: MicPermissionState, message?: string | null) => void;
  cameraEnabled: boolean;
  setCameraEnabled: (enabled: boolean) => void;
  cameraPreviewUrl: string | null;
  setCameraPreviewUrl: (previewUrl: string | null) => void;
}>(set => ({
  isSidebarOpen: false,
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  isChatOpen: false,
  toggleChat: () => set(state => ({ isChatOpen: !state.isChatOpen })),
  isGeneratingTask: false,
  activeCueUrl: null,
  setGeneratingTask: (isGenerating, cueUrl = null) => set({ isGeneratingTask: isGenerating, activeCueUrl: cueUrl }),
  taskResult: null,
  setTaskResult: result => set({ taskResult: result }),
  micLevel: 0,
  setMicLevel: level => set({ micLevel: Number.isFinite(level) ? Math.max(0, Math.min(level, 1)) : 0 }),
  micPermission: 'unknown',
  micPermissionMessage: null,
  setMicPermission: (micPermission, micPermissionMessage = null) =>
    set({ micPermission, micPermissionMessage }),
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
      if (
        oldName !== updatedTool.name &&
        state.tools.some(tool => tool.name === updatedTool.name)
      ) {
        console.warn(`Tool with name "${updatedTool.name}" already exists.`);
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