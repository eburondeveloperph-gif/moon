/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import c from 'classnames';
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
  const {
    client,
    setConfig,
    connected,
    connect,
    disconnect,
    volume,
    speakerMuted,
    setSpeakerMuted
  } = useLiveAPIContext();
  const { systemPrompt, voice } = useSettings();
  const { tools, template } = useTools();
  const {
    isGeneratingTask,
    activeCueUrl,
    taskResult,
    setTaskResult,
    cameraEnabled,
    setCameraEnabled,
    cameraPreviewUrl,
    micLevel,
    isChatOpen,
    toggleChat,
  } = useUI();
  const turns = useLogStore(state => state.turns);
  const deferredTurns = useDeferredValue(turns);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [showPopUp, setShowPopUp] = useState(false);
  const [manualMessage, setManualMessage] = useState('');

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
  const isAgentDraft = latestTurn?.role === 'agent' && !latestTurn.isFinal;
  const isUserDraft = latestTurn?.role === 'user' && !latestTurn.isFinal;
  const statusLabel = connected ? (isAgentDraft ? 'Thinking' : 'Listening') : 'Idle';
  const liveTranscript =
    latestTurn && !latestTurn.isFinal && latestTurn.text.trim()
      ? latestTurn.text
      : connected
        ? 'Speak naturally. Beatrice is listening.'
        : 'Tap the microphone to start a voice session.';
  const orbEnergy = connected ? Math.max(0.08, micLevel, volume * 0.9) : 0;
  const orbScale = connected ? 1 + orbEnergy * 0.38 : 1;
  const orbShadow = connected ? 50 + orbEnergy * 110 : 50;

  const handleManualSend = () => {
    const text = manualMessage.trim();
    if (!text || !connected) return;

    useLogStore.getState().addTurn({
      role: 'user',
      text,
      isFinal: true,
    });
    client.send([{ text }], true);
    setManualMessage('');
  };

  return (
    <>
      <div className="voice-screen">
        <div className={c('top-status', { visible: connected || deferredTurns.length > 0 })}>
          {statusLabel}
        </div>

        <div className="orb-container">
          <div
            className={c('orb orb-react', {
              thinking: isAgentDraft,
              connecting: isUserDraft,
              active: connected,
            })}
            style={{
              transform: `scale(${orbScale})`,
              boxShadow: `0 0 ${orbShadow}px rgba(24, 139, 242, ${connected ? 0.35 + orbEnergy * 0.4 : 0.4})`,
            }}
          />
        </div>

        <div className="transcript-container">
          <div className={c('transcript', { interim: latestTurn && !latestTurn.isFinal })}>
            {liveTranscript}
          </div>
        </div>

        <div className="voice-meters">
          <div className="voice-meter-card">
            <span>Mic</span>
            <strong>{Math.round(micLevel * 100)}%</strong>
          </div>
          <div className="voice-meter-card">
            <span>Voice</span>
            <strong>{Math.round(volume * 100)}%</strong>
          </div>
        </div>

        <button
          className="btn-circle btn-settings-react"
          onClick={useUI.getState().toggleSidebar}
          title="Open settings"
        >
          <span className="material-symbols-outlined">tune</span>
        </button>

        <button
          className={c('btn-circle btn-mic-react', { stop: connected })}
          onClick={connected ? disconnect : connect}
          title={connected ? 'Stop session' : 'Start session'}
        >
          <span className="material-symbols-outlined">
            {connected ? 'stop' : 'mic'}
          </span>
        </button>

        <button
          className="btn-circle btn-chat-react"
          onClick={toggleChat}
          title="Open conversation"
        >
          <span className="material-symbols-outlined">
            {isChatOpen ? 'close' : 'chat_bubble'}
          </span>
        </button>
      </div>

      <div className={c('drawer chat-drawer', { open: isChatOpen })}>
        <div className="drawer-header">
          <h2>Conversation</h2>
          <button className="btn-close" onClick={toggleChat}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div
          className="drawer-content chat-history"
          ref={scrollRef}
          onScroll={handleTranscriptScroll}
        >
          {deferredTurns.length === 0 ? (
            <div className="chat-empty-state">Start a voice session to see the conversation here.</div>
          ) : (
            deferredTurns.map((t, i) => (
              <div
                key={i}
                className={c('chat-bubble', {
                  user: t.role === 'user',
                  assistant: t.role !== 'user',
                  interim: !t.isFinal,
                })}
              >
                {renderContent(t.text)}
              </div>
            ))
          )}
        </div>

        <div className="chat-input-area">
          <input
            type="text"
            value={manualMessage}
            onChange={event => setManualMessage(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                handleManualSend();
              }
            }}
            placeholder={connected ? 'Type a message...' : 'Start the session to chat'}
            disabled={!connected}
          />
          <button className="btn-send" onClick={handleManualSend} disabled={!connected}>
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>

      {showPopUp && <PopUp onClose={handleClosePopUp} />}
    </>
  );
}
