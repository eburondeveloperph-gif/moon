/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import cn from 'classnames';

import { memo, ReactNode, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';
import { useSettings, useTools, useLogStore } from '@/lib/state';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';

export type ControlTrayProps = {
  children?: ReactNode;
};

function ControlTray({ children }: ControlTrayProps) {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  const { client, connected, connect, disconnect } = useLiveAPIContext();

  useEffect(() => {
    // FIX: Cannot find name 'connectButton'. Did you mean 'connectButtonRef'?
    if (!connected && connectButtonRef.current) {
      // FIX: Cannot find name 'connectButton'. Did you mean 'connectButtonRef'?
      connectButtonRef.current.focus();
    }
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      setMuted(false);
    }
  }, [connected]);

  const dgClient = useRef<any>(null);
  const dgConnection = useRef<any>(null);

  useEffect(() => {
    const onData = (base64: string) => {
      // Send to Gemini
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);

      // Send to Deepgram
      if (dgConnection.current) {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        dgConnection.current.send(bytes);
      }
    };

    const setupDeepgram = async () => {
      const apiKey = (import.meta as any).env.VITE_DEEPGRAM_API_KEY || '6330d8d2cf4c9f1343f306f1ebc00cb36780089c';
      const url = 'wss://api.deepgram.com/v1/listen?model=nova-3&language=nl-BE&smart_format=true&interim_results=true&endpointing=300';
      
      const socket = new WebSocket(url, ['token', apiKey]);
      dgConnection.current = socket;

      socket.onopen = () => console.log('Deepgram connection opened');
      socket.onclose = () => console.log('Deepgram connection closed');
      socket.onerror = (err: any) => console.error('Deepgram error:', err);
      
      socket.onmessage = async (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (transcript) {
          const { addTurn, updateLastTurn, turns } = useLogStore.getState();
          const last = turns[turns.length - 1];
          if (last && last.role === 'user' && !last.isFinal) {
            updateLastTurn({
              text: transcript,
              isFinal: data.is_final,
            });
          } else {
            addTurn({ role: 'user', text: transcript, isFinal: data.is_final });
          }

          // Sync final user turn to Firebase
          if (data.is_final) {
            try {
              await addDoc(collection(db, 'turns'), {
                role: 'user',
                text: transcript,
                timestamp: serverTimestamp(),
                isFinal: true
              });
            } catch (e) {
              console.error("Error syncing user turn to Firebase:", e);
            }
          }
        }
      };
    };

    if (connected && !muted && audioRecorder) {
      setupDeepgram();
      audioRecorder.on('data', onData);
      audioRecorder.start();
    } else {
      audioRecorder.stop();
      if (dgConnection.current) {
        if (dgConnection.current.readyState === WebSocket.OPEN) {
          dgConnection.current.close();
        }
        dgConnection.current = null;
      }
    }
    return () => {
      audioRecorder.off('data', onData);
      if (dgConnection.current) {
        if (dgConnection.current.readyState === WebSocket.OPEN) {
          dgConnection.current.close();
        }
        dgConnection.current = null;
      }
    };
  }, [connected, client, muted, audioRecorder]);

  const handleMicClick = () => {
    if (connected) {
      setMuted(!muted);
    } else {
      connect();
    }
  };

  const handleExportLogs = () => {
    const { systemPrompt, model } = useSettings.getState();
    const { tools } = useTools.getState();
    const { turns } = useLogStore.getState();

    const logData = {
      configuration: {
        model,
        systemPrompt,
      },
      tools,
      conversation: turns.map(turn => ({
        ...turn,
        // Convert Date object to ISO string for JSON serialization
        timestamp: turn.timestamp.toISOString(),
      })),
    };

    const jsonString = JSON.stringify(logData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `live-api-logs-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const micButtonTitle = connected
    ? muted
      ? 'Unmute microphone'
      : 'Mute microphone'
    : 'Connect and start microphone';

  const connectButtonTitle = connected ? 'Stop streaming' : 'Start streaming';

  return (
    <section className="control-tray">
      <nav className={cn('actions-nav')}>
        <button
          className={cn('action-button mic-button')}
          onClick={handleMicClick}
          title={micButtonTitle}
        >
          {!muted ? (
            <span className="material-symbols-outlined filled">mic</span>
          ) : (
            <span className="material-symbols-outlined filled">mic_off</span>
          )}
        </button>
        <button
          className={cn('action-button')}
          onClick={handleExportLogs}
          aria-label="Export Logs"
          title="Export session logs"
        >
          <span className="material-symbols-outlined">download</span>
        </button>
        <button
          className={cn('action-button')}
          onClick={useLogStore.getState().clearTurns}
          aria-label="Reset Chat"
          title="Reset session logs"
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>
        {children}
      </nav>

      <div className={cn('connection-container', { connected })}>
        <button
          ref={connectButtonRef}
          className={cn('action-button connect-toggle', { connected })}
          onClick={connected ? disconnect : connect}
          title={connectButtonTitle}
        >
          <span className="material-symbols-outlined filled">
            {connected ? 'pause' : 'play_arrow'}
          </span>
          <span>{connected ? 'Stop Beatrice' : 'Awaken Beatrice'}</span>
        </button>
      </div>
    </section>
  );
}

export default memo(ControlTray);