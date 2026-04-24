/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import c from 'clsx';
import PopUp from '../popup/PopUp';
import AudioVisualizer from './AudioVisualizer';
import ControlTray from '../../console/control-tray/ControlTray';
// FIX: Import LiveServerContent to correctly type the content handler.
import { LiveServerContent } from '@google/genai';
import { BEATRICE_BASE_PROMPT } from '@/lib/prompts/beatrice';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import {
  useSettings,
  useLogStore,
  useTools,
  useUI,
  ConversationTurn,
} from '@/lib/state';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, orderBy, getDocs, limit, serverTimestamp } from 'firebase/firestore';

const formatTimestamp = (date: Date) => {
  const pad = (num: number, size = 2) => num.toString().padStart(size, '0');
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const milliseconds = pad(date.getMilliseconds(), 3);
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

const mergeTranscriptText = (previousText: string, incomingText: string) => {
  const previous = previousText.trim();
  const incoming = incomingText.trim();

  if (!previous) return incomingText;
  if (!incoming) return previousText;

  if (incoming === previous) return previousText;
  if (incoming.startsWith(previous)) return incomingText;
  if (previous.startsWith(incoming)) return previousText;
  if (incoming.includes(previous)) return incomingText;
  if (previous.includes(incoming)) return previousText;

  const maxOverlap = Math.min(previous.length, incoming.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (previous.slice(-overlap) === incoming.slice(0, overlap)) {
      return `${previous}${incoming.slice(overlap)}`;
    }
  }

  const separator = /[\s([{'"-]$/.test(previous) || /^[\s.,!?;:)\]}'"-]/.test(incoming) ? '' : ' ';
  return `${previous}${separator}${incoming}`;
};

const renderContent = (text: string) => {
  // Split by ```json...``` code blocks
  const parts = text.split(/(`{3}json\n[\s\S]*?\n`{3})/g);

  return parts.map((part, index) => {
    if (part.startsWith('```json')) {
      const jsonContent = part.replace(/^`{3}json\n|`{3}$/g, '');
      return (
        <pre key={index}>
          <code>{jsonContent}</code>
        </pre>
      );
    }

    // Split by **bold** text
    const boldParts = part.split(/(\*\*.*?\*\*)/g);
    return boldParts.map((boldPart, boldIndex) => {
      if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
        return <strong key={boldIndex}>{boldPart.slice(2, -2)}</strong>;
      }
      return boldPart;
    });
  });
};


export default function StreamingConsole() {
  const { client, setConfig, connected, connect, disconnect, volume } = useLiveAPIContext();
  const { systemPrompt, voice } = useSettings();
  const { tools, template } = useTools();
  const {
    isGeneratingTask,
    activeCueUrl,
    taskResult,
    setTaskResult,
    cameraEnabled,
    cameraPreviewUrl,
    micLevel,
  } = useUI();
  const turns = useLogStore(state => state.turns);
  const deferredTurns = useDeferredValue(turns);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [showPopUp, setShowPopUp] = useState(true);

  const handleClosePopUp = () => {
    setShowPopUp(false);
  };

  // Set the configuration for the Live API
  useEffect(() => {
    const enabledTools = tools
      .filter(tool => tool.isEnabled)
      .map(tool => ({
        functionDeclarations: [
          {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        ],
      }));

    const finalSystemPrompt = template === 'beatrice'
      ? `${systemPrompt}\n\n${BEATRICE_BASE_PROMPT}`
      : systemPrompt;

    // Using `any` for config to accommodate `speechConfig`, which is not in the
    // current TS definitions but is used in the working reference example.
    const config: any = {
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: finalSystemPrompt,
          },
        ],
      },
      tools: enabledTools,
    };

    setConfig(config);
  }, [setConfig, systemPrompt, tools, voice, template]);

  useEffect(() => {
    const { addTurn, updateLastTurn } = useLogStore.getState();

    const handleInputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      if (last && last.role === 'user' && !last.isFinal) {
        updateLastTurn({
          text: mergeTranscriptText(last.text, text),
          isFinal,
        });
      } else {
        addTurn({ role: 'user', text, isFinal });
      }
    };

    const handleOutputTranscription = (text: string, isFinal: boolean) => {
      const turns = useLogStore.getState().turns;
      const last = turns[turns.length - 1];
      if (last && last.role === 'agent' && !last.isFinal) {
        updateLastTurn({
          text: mergeTranscriptText(last.text, text),
          isFinal,
        });
      } else {
        addTurn({ role: 'agent', text, isFinal });
      }
    };

    const onContent = (serverContent: LiveServerContent) => {
      const text =
        serverContent.modelTurn?.parts
          ?.map((p: any) => p.text)
          .filter(Boolean)
          .join(' ') ?? '';
      const groundingChunks = serverContent.groundingMetadata?.groundingChunks;

      if (!text && !groundingChunks) return;

      const turns = useLogStore.getState().turns;
      const last = turns.at(-1);

      if (last?.role === 'agent' && !last.isFinal) {
        const updatedTurn: Partial<ConversationTurn> = {
          text: mergeTranscriptText(last.text, text),
        };
        if (groundingChunks) {
          updatedTurn.groundingChunks = [
            ...(last.groundingChunks || []),
            ...(groundingChunks as any),
          ];
        }
        updateLastTurn(updatedTurn);
      } else {
        addTurn({ role: 'agent', text, isFinal: false, groundingChunks: groundingChunks as any });
      }
    };

    const handleTurnComplete = async () => {
      const last = useLogStore.getState().turns.at(-1);
      if (last && !last.isFinal) {
        updateLastTurn({ isFinal: true });
        
        // Sync final turn to Firebase
        try {
          await addDoc(collection(db, 'turns'), {
            role: last.role,
            text: last.text,
            timestamp: serverTimestamp(),
            isFinal: true
          });
          
          // If it's a significant turn, update "Knowledge" (Long Term Memory)
          if (last.text.length > 20) {
             await addDoc(collection(db, 'knowledge'), {
               content: last.text,
               timestamp: serverTimestamp(),
               source: last.role
             });
          }
        } catch (e) {
          console.error("Error syncing to Firebase:", e);
        }
      }
    };

    client.on('inputTranscription', handleInputTranscription);
    client.on('outputTranscription', handleOutputTranscription);
    client.on('content', onContent);
    client.on('turncomplete', handleTurnComplete);

    return () => {
      client.off('inputTranscription', handleInputTranscription);
      client.off('outputTranscription', handleOutputTranscription);
      client.off('content', onContent);
      client.off('turncomplete', handleTurnComplete);
    };
  }, [client]);

  // Load Long Term Memory / Previous Turns
  useEffect(() => {
    const loadMemory = async () => {
      try {
        const q = query(collection(db, 'turns'), orderBy('timestamp', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        const previousTurns: ConversationTurn[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          previousTurns.unshift({
            role: data.role,
            text: data.text,
            timestamp: data.timestamp?.toDate() || new Date(),
            isFinal: true
          });
        });
        
        if (previousTurns.length > 0) {
          useLogStore.setState({ turns: previousTurns });
        }
      } catch (e) {
        console.error("Error loading memory:", e);
      }
    };
    loadMemory();
  }, []);

  useEffect(() => {
    if (scrollRef.current && autoScrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [deferredTurns]);

  const handleTranscriptScroll = () => {
    const node = scrollRef.current;
    if (!node) return;

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    autoScrollRef.current = distanceFromBottom < 48;
  };

  const latestTurn = deferredTurns.at(-1);
  const liveTranscript =
    latestTurn && !latestTurn.isFinal && latestTurn.text.trim()
      ? latestTurn.text
      : connected
        ? 'Listening for speech and updating the transcript live.'
        : 'Press play to start live transcription.';

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* Live Transcription Bar */}
      <div className="dashboard-panel p-4 flex items-center gap-4">
        <span className="material-symbols-outlined text-dim">graphic_eq</span>
        <p className="text-sm text-muted font-medium">{liveTranscript}</p>
      </div>

      {/* Audio Dashboard Panel */}
      <div className="dashboard-panel dashboard-panel-lg audio-dashboard">
        {/* Play/Pause Toggle */}
        <button 
          onClick={connected ? disconnect : connect}
          className={c("w-20 h-20 rounded-full flex items-center justify-center shrink-0 border transition shadow-lg", {
            "bg-button border-blue-400/30 hover:bg-button-hover": !connected,
            "bg-red-900/20 border-red-500/30 hover:bg-red-900/40": connected
          })}
        >
          <span className="material-symbols-outlined text-3xl" style={{ color: connected ? '#ff3366' : '#3b82f6' }}>
            {connected ? 'stop' : 'play_arrow'}
          </span>
        </button>

        {/* Visualizer Placeholder */}
        <div className="flex-1 flex items-center gap-1.5 h-12 px-6">
          <AudioVisualizer />
        </div>

        {/* Stat Cards */}
        <div className="stat-cards">
          <div className="stat-card">
            <p className="text-[10px] text-dim uppercase font-semibold tracking-wider mb-1">Mic Input</p>
            <p className="text-2xl font-bold">{Math.round(micLevel * 100)}%</p>
          </div>
          <div className="stat-card">
            <p className="text-[10px] text-dim uppercase font-semibold tracking-wider mb-1">Voice Output</p>
            <p className="text-2xl font-bold">{Math.round(volume * 100)}%</p>
          </div>
          <div className="stat-card">
            <p className="text-[10px] text-dim uppercase font-semibold tracking-wider mb-1">Session</p>
            <p className="text-lg font-bold mt-1 text-muted">
              {connected ? 'Active' : 'Standby'}
            </p>
          </div>
        </div>
      </div>

      {/* Listening Status Area */}
      <div className="dashboard-panel dashboard-panel-lg flex-1 relative flex flex-col items-center justify-center overflow-hidden">
        <div className="glow-orb"></div>
        <div className="relative z-10 text-center">
          <h1 className="text-4xl font-semibold mb-3 tracking-tight">
            {connected ? 'Beatrice is listening' : 'Beatrice is resting'}
          </h1>
          <p className="text-muted">
            {connected ? 'Speak with confidence, Boss Joe. I am here for you.' : 'Press play to awaken Beatrice.'}
          </p>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="control-bar">
        <ControlTray />
        
        <button 
          onClick={connected ? disconnect : connect}
          className="flex items-center gap-2 bg-[#1A1C24] hover:bg-[#222530] border border-white/5 px-8 py-3 rounded-full text-sm font-medium transition mr-2"
        >
          <span className="material-symbols-outlined text-lg">
            {connected ? 'power_settings_new' : 'bolt'}
          </span>
          {connected ? 'Rest Beatrice' : 'Awaken Beatrice'}
        </button>
      </div>

      {showPopUp && <PopUp onClose={handleClosePopUp} />}
    </div>
  );
}
