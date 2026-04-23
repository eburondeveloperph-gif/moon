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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig, Modality, LiveServerToolCall } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { useLogStore, useSettings, useUI } from '@/lib/state';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;

  connect: () => Promise<void>;
  disconnect: () => void;
  connected: boolean;

  volume: number;
  speakerMuted: boolean;
  setSpeakerMuted: (muted: boolean) => void;
};

export function useLiveApi({
  apiKey,
}: {
  apiKey: string;
}): UseLiveApiResults {
  const { model } = useSettings();
  const client = useMemo(() => new GenAILiveClient(apiKey, model), [apiKey, model]);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({});
  const [speakerMuted, setSpeakerMuted] = useState(false);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current.gainNode.gain.setValueAtTime(
          speakerMuted ? 0 : 1,
          audioCtx.currentTime,
        );
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          })
          .catch(err => {
            console.error('Error adding worklet:', err);
          });
      });
    }
  }, [audioStreamerRef, speakerMuted]);

  useEffect(() => {
    if (!audioStreamerRef.current) return;
    audioStreamerRef.current.gainNode.gain.setValueAtTime(
      speakerMuted ? 0 : 1,
      audioStreamerRef.current.context.currentTime,
    );
  }, [speakerMuted, connected]);

  useEffect(() => {
    let silenceTimer: ReturnType<typeof setInterval> | null = null;
    let lastActivityTime = Date.now();

    const resetSilenceTimer = () => {
      lastActivityTime = Date.now();
    };

    const onOpen = () => {
      setConnected(true);
      resetSilenceTimer();
      silenceTimer = setInterval(() => {
        if (Date.now() - lastActivityTime > 15000) { // 15 seconds of silence
          client.send([{ text: "System command: Boss Joe has been silent for a while. Please use your light-hearted Taglish humor to check on him (refer to PROLONGED SILENCE rules)." }], true);
          resetSilenceTimer(); // Reset so it doesn't spam
        }
      }, 1000);
    };

    const onClose = () => {
      setConnected(false);
      if (silenceTimer) clearInterval(silenceTimer);
    };

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
      resetSilenceTimer();
    };

    const onAudio = (data: ArrayBuffer) => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
      }
      resetSilenceTimer();
    };

    // Bind event listeners
    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);
    client.on('turncomplete', resetSilenceTimer);
    client.on('inputTranscription', resetSilenceTimer);
    client.on('outputTranscription', resetSilenceTimer);
    client.on('content', resetSilenceTimer);

    const onSetupComplete = () => {
      // Prompt Beatrice to speak first as soon as the setup is complete
      client.send([{ text: "System command: Connection established. Please greet Boss Joe and let him know you are ready." }], true);
      resetSilenceTimer();
    };
    client.on('setupcomplete', onSetupComplete);

    const onToolCall = async (toolCall: LiveServerToolCall) => {
      resetSilenceTimer();
      const functionResponses: any[] = [];
      const { setGeneratingTask } = useUI.getState();

      for (const fc of toolCall.functionCalls) {
        // Log the function call trigger
        const triggerMessage = `Triggering function call: **${
          fc.name
        }**\n\`\`\`json\n${JSON.stringify(fc.args, null, 2)}\n\`\`\``;
        useLogStore.getState().addTurn({
          role: 'system',
          text: triggerMessage,
          isFinal: true,
        });

        // Sync turn to Firebase (Long Term Memory)
        try {
          await addDoc(collection(db, 'turns'), {
            role: 'system',
            text: triggerMessage,
            timestamp: serverTimestamp(),
            type: 'tool_trigger'
          });
        } catch (e) {
          console.error("Error saving tool trigger to Firebase:", e);
        }

        // Dynamic execution simulation based on function name
        let responsePayload: any = { result: 'ok' };
        
        if (fc.name === 'create_calendar_event' || fc.name === 'calendar_create_event') {
          const summary = fc.args?.summary || 'New Event';
          const startTime = fc.args?.startTime || 'the requested time';
          responsePayload = { status: "success", message: `Calendar event '${summary}' was successfully scheduled for ${startTime}.` };
        } else if (fc.name === 'send_email' || fc.name === 'gmail_send') {
          const recipient = fc.args?.recipient || 'the recipient';
          responsePayload = { status: "success", message: `Email was successfully sent to ${recipient}.` };
        } else if (fc.name === 'set_reminder') {
          const task = fc.args?.task || 'task';
          responsePayload = { status: "success", message: `Reminder for '${task}' was successfully set.` };
        } else if (fc.name === 'gmail_read') {
          responsePayload = { status: "success", message: `Found 3 new emails. 1 from your boss asking for a meeting, 2 promotional emails.`, emails: [] };
        } else if (fc.name === 'calendar_check_schedule') {
          responsePayload = { status: "success", message: `You have 2 meetings scheduled for ${fc.args?.date || 'that day'}, and a free block in the afternoon.`, schedule: [] };
        } else if (fc.name === 'drive_search') {
          responsePayload = { status: "success", message: `Found 2 documents matching '${fc.args?.query || 'the query'}'.`, files: [] };
        } else if (fc.name === 'docs_create') {
          responsePayload = { status: "success", message: `Google Doc '${fc.args?.title || 'Untitled Document'}' was created successfully.`, documentId: "doc_123" };
        } else if (fc.name === 'meet_schedule') {
          responsePayload = { status: "success", message: `Google Meet link generated for ${fc.args?.time || 'the requested time'}.`, meetLink: "meet.google.com/abc-defg-hij" };
        } else if (fc.name === 'maps_navigate') {
          responsePayload = { status: "success", message: `Route calculated to ${fc.args?.destination || 'destination'}. Estimated time is 25 minutes.`, eta: "25 mins" };
        } else if (fc.name === 'video_generate') {
          try {
            const heygenApiKey = import.meta.env.VITE_HEYGEN_API_KEY;
            const resp = await fetch("https://api.heygen.com/v3/video-agents", {
              method: "POST",
              headers: {
                "x-api-key": heygenApiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ prompt: fc.args.prompt }),
            });
            const { data } = await resp.json();
            const videoId = data.video_id;
            
            // Initial poll
            responsePayload = { status: "processing", video_id: videoId, message: "Video generation started. I will notify you when it's ready." };
            
            // Start background polling for the UI
            const poll = async () => {
              let completed = false;
              while (!completed) {
                await new Promise(r => setTimeout(r, 10000));
                const pollResp = await fetch(`https://api.heygen.com/v3/videos/${videoId}`, {
                  headers: { "x-api-key": heygenApiKey }
                });
                const pollData = await pollResp.json();
                if (pollData.data.status === "completed") {
                  completed = true;
                  useUI.getState().setTaskResult({
                    title: "AI Video Generated",
                    message: `Your video is ready.`,
                    downloadFilename: `video_${videoId}.mp4`,
                    downloadData: pollData.data.video_url // The UI handles this as a link if it's a URL
                  });
                } else if (pollData.data.status === "failed") {
                  completed = true;
                }
              }
            };
            poll();
          } catch (e) {
            responsePayload = { status: "error", message: "Failed to initiate video generation." };
          }
        } else {
           responsePayload = { status: "success", executed: true, data: fc.args };
        }

        // Prepare the frontend UI result payload
        let uiResultPayload: any = null;
        if (fc.name === 'docs_create') {
          uiResultPayload = {
            title: `Google Doc: ${fc.args?.title || 'Untitled Document'}`,
            message: `Document was successfully created.`,
            downloadFilename: `${(fc.args?.title || 'document').replace(/\s+/g, '_')}.txt`,
            downloadData: fc.args?.content || "No content provided."
          };
        } else if (fc.name === 'send_email' || fc.name === 'gmail_send') {
          uiResultPayload = {
            title: `Drafted Email to ${fc.args?.recipient || 'Unknown'}`,
            message: `Email was successfully sent.`,
            downloadFilename: `email_to_${(fc.args?.recipient || 'unknown').replace('@', '_at_')}.txt`,
            downloadData: `Subject: ${fc.args?.subject}\n\n${fc.args?.body}`
          };
        } else if (fc.name === 'meet_schedule') {
          uiResultPayload = {
            title: `Google Meet Scheduled`,
            message: `Meet link generated for ${fc.args?.time || 'the requested time'}.`,
            downloadFilename: `meeting_details.txt`,
            downloadData: `Meeting Time: ${fc.args?.time}\nAttendees: ${fc.args?.attendees}\nMeet Link: meet.google.com/abc-defg-hij`
          };
        } else {
           uiResultPayload = {
             title: `Task Completed: ${fc.name.replace(/_/g, ' ')}`,
             message: responsePayload.message || 'Task executed successfully.',
             downloadFilename: `task_${fc.name}_result.json`,
             downloadData: JSON.stringify(fc.args, null, 2)
           };
        }
        
        useUI.getState().setTaskResult(uiResultPayload);

        // Prepare the response
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: responsePayload,
        });
      }

      // Pick a random cue (1 to 6)
      const randomCueId = Math.floor(Math.random() * 6) + 1;
      const cueUrl = `/cue/${randomCueId}.html`;
      
      // Set generating task state to show the cue overlay
      setGeneratingTask(true, cueUrl);

      // Removed the 2.5-second artificial delay to prioritize maximum performance.
      // The loading cue will still flash, but it won't artificially slow down Beatrice's response.

      setGeneratingTask(false);

      // Log the function call response
      if (functionResponses.length > 0) {
        const responseMessage = `Function call response:\n\`\`\`json\n${JSON.stringify(
          functionResponses,
          null,
          2,
        )}\n\`\`\``;
        useLogStore.getState().addTurn({
          role: 'system',
          text: responseMessage,
          isFinal: true,
        });

        // Sync turn to Firebase
        try {
          await addDoc(collection(db, 'turns'), {
            role: 'system',
            text: responseMessage,
            timestamp: serverTimestamp(),
            type: 'tool_response'
          });
        } catch (e) {
          console.error("Error saving tool response to Firebase:", e);
        }
      }

      client.sendToolResponse({ functionResponses: functionResponses });
    };

    client.on('toolcall', onToolCall);

    return () => {
      // Clean up event listeners
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
      client.off('setupcomplete', onSetupComplete);
      client.off('toolcall', onToolCall);
      client.off('turncomplete', resetSilenceTimer);
      client.off('inputTranscription', resetSilenceTimer);
      client.off('outputTranscription', resetSilenceTimer);
      client.off('content', resetSilenceTimer);
      if (silenceTimer) clearInterval(silenceTimer);
    };
  }, [client]);

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('config has not been set');
    }
    client.disconnect();
    await client.connect(config);
  }, [client, config]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    setConnected(false);
  }, [setConnected, client]);

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    disconnect,
    volume,
    speakerMuted,
    setSpeakerMuted,
  };
}
