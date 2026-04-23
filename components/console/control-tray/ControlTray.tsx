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
import { useLogStore, useUI } from '@/lib/state';
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
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraIntervalRef = useRef<number | null>(null);
  const connectedRef = useRef(false);

  const {
    client,
    connected,
    connect,
    disconnect,
    speakerMuted,
    setSpeakerMuted,
  } = useLiveAPIContext();
  const {
    cameraEnabled,
    setCameraEnabled,
    setCameraPreviewUrl,
  } = useUI();
  const setMicLevel = useUI.getState().setMicLevel;
  const clientRef = useRef(client);

  connectedRef.current = connected;
  clientRef.current = client;

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
      setMicLevel(0);
    }
  }, [connected, setMicLevel]);

  useEffect(() => {
    if (!cameraEnabled) {
      setCameraPreviewUrl(null);
    }
  }, [cameraEnabled, setCameraPreviewUrl]);

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

    const onVolume = (volume: number) => {
      setMicLevel(volume);
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
      audioRecorder.on('volume', onVolume);
      audioRecorder.start();
    } else {
      audioRecorder.stop();
      setMicLevel(0);
      if (dgConnection.current) {
        if (dgConnection.current.readyState === WebSocket.OPEN) {
          dgConnection.current.close();
        }
        dgConnection.current = null;
      }
    }
    return () => {
      audioRecorder.off('data', onData);
      audioRecorder.off('volume', onVolume);
      setMicLevel(0);
      if (dgConnection.current) {
        if (dgConnection.current.readyState === WebSocket.OPEN) {
          dgConnection.current.close();
        }
        dgConnection.current = null;
      }
    };
  }, [connected, client, muted, audioRecorder, setMicLevel]);

  useEffect(() => {
    let disposed = false;

    const stopCamera = () => {
      if (cameraIntervalRef.current) {
        window.clearInterval(cameraIntervalRef.current);
        cameraIntervalRef.current = null;
      }
      if (cameraVideoRef.current) {
        cameraVideoRef.current.pause();
        cameraVideoRef.current.srcObject = null;
        cameraVideoRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
      setCameraPreviewUrl(null);
    };

    if (!cameraEnabled) {
      stopCamera();
      return;
    }

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not available in this browser.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 360 },
          },
        });

        if (disposed) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        await video.play();

        cameraStreamRef.current = stream;
        cameraVideoRef.current = video;
        cameraCanvasRef.current = cameraCanvasRef.current ?? document.createElement('canvas');

        cameraIntervalRef.current = window.setInterval(() => {
          const liveVideo = cameraVideoRef.current;
          const canvas = cameraCanvasRef.current;
          if (!liveVideo || !canvas || liveVideo.readyState < 2) return;

          const width = Math.min(liveVideo.videoWidth || 640, 640);
          const aspectRatio = (liveVideo.videoHeight || 360) / (liveVideo.videoWidth || 640);
          const height = Math.max(180, Math.round(width * aspectRatio));
          const context = canvas.getContext('2d');
          if (!context) return;

          canvas.width = width;
          canvas.height = height;
          context.drawImage(liveVideo, 0, 0, width, height);

          const previewUrl = canvas.toDataURL('image/jpeg', 0.72);
          setCameraPreviewUrl(previewUrl);

          if (connectedRef.current) {
            clientRef.current.sendRealtimeInput([
              {
                mimeType: 'image/jpeg',
                data: previewUrl.split(',')[1],
              },
            ]);
          }
        }, 900);
      } catch (error) {
        console.error('Error starting camera preview:', error);
        setCameraEnabled(false);
      }
    };

    startCamera();

    return () => {
      disposed = true;
      stopCamera();
    };
  }, [cameraEnabled, setCameraEnabled, setCameraPreviewUrl]);

  const handleMicClick = () => {
    if (connected) {
      setMuted(!muted);
    } else {
      connect();
    }
  };

  const micButtonTitle = connected
    ? muted
      ? 'Unmute microphone'
      : 'Mute microphone'
    : 'Connect and start microphone';

  const connectButtonTitle = connected ? 'Stop streaming' : 'Start streaming';
  const speakerButtonTitle = speakerMuted ? 'Unmute speaker output' : 'Mute speaker output';
  const cameraButtonTitle = cameraEnabled ? 'Stop camera' : 'Start camera';

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
          onClick={() => setSpeakerMuted(!speakerMuted)}
          aria-label="Speaker Output"
          title={speakerButtonTitle}
        >
          <span className="material-symbols-outlined">
            {speakerMuted ? 'volume_off' : 'volume_up'}
          </span>
        </button>
        <button
          className={cn('action-button', { active: cameraEnabled })}
          onClick={() => setCameraEnabled(!cameraEnabled)}
          aria-label="Camera"
          title={cameraButtonTitle}
        >
          <span className="material-symbols-outlined">
            {cameraEnabled ? 'videocam' : 'videocam_off'}
          </span>
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
