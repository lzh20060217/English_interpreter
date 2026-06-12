'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useInterpreterStore } from '@/features/interpreter/store';
import type { ConnectionStatus, NoteBlock } from '@/types/interpreter';

interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  sendAudio: (data: ArrayBuffer) => void;
  sendText: (text: string) => void;
  sendControl: (action: 'pause' | 'resume' | 'stop') => void;
  connect: () => void;
  disconnect: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/api/audio-stream';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 16000;

export function useWebSocket(): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  // Refs to store latest store actions (avoids stale closures)
  const storeRef = useRef({
    setConnectionStatus: useInterpreterStore.getState().setConnectionStatus,
    addTranscript: useInterpreterStore.getState().addTranscript,
    addTranslation: useInterpreterStore.getState().addTranslation,
    addParaphrase: useInterpreterStore.getState().addParaphrase,
    updateNotes: useInterpreterStore.getState().updateNotes,
    setStatus: useInterpreterStore.getState().setStatus,
  });

  // Keep ref in sync
  useEffect(() => {
    storeRef.current = {
      setConnectionStatus: useInterpreterStore.getState().setConnectionStatus,
      addTranscript: useInterpreterStore.getState().addTranscript,
      addTranslation: useInterpreterStore.getState().addTranslation,
      addParaphrase: useInterpreterStore.getState().addParaphrase,
      updateNotes: useInterpreterStore.getState().updateNotes,
      setStatus: useInterpreterStore.getState().setStatus,
    };
  });

  const connectionStatus = useInterpreterStore((s) => s.connectionStatus);

  const clearReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // Internal connect function — not a useCallback since it's only called internally
  const doConnect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
    }

    storeRef.current.setConnectionStatus('connecting');
    intentionalCloseRef.current = false;

    try {
      const ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        storeRef.current.setConnectionStatus('connected');
        reconnectAttemptRef.current = 0;
      };

      ws.onclose = () => {
        storeRef.current.setConnectionStatus('disconnected');
        if (!intentionalCloseRef.current) {
          const delay = Math.min(
            RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current),
            RECONNECT_MAX_MS
          );
          reconnectAttemptRef.current += 1;
          reconnectTimerRef.current = setTimeout(doConnect, delay);
        }
      };

      ws.onerror = () => {
        storeRef.current.setConnectionStatus('error');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          const type = data.type as string;
          const now = new Date().toTimeString().slice(0, 8);

          switch (type) {
            case 'status': {
              const state = data.state as string;
              if (state === 'recording') storeRef.current.setStatus('recording');
              else if (state === 'paused') storeRef.current.setStatus('paused');
              else if (state === 'error') storeRef.current.setStatus('error');
              break;
            }

            case 'vad': {
              break;
            }

            case 'transcript': {
              const text = data.text as string;
              const isFinal = (data.is_final as boolean) ?? true;
              if (text) {
                storeRef.current.addTranscript({
                  id: `ts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  text,
                  isFinal,
                  timestamp: now,
                });
              }
              break;
            }

            case 'result': {
              const transcript = data.transcript as string;
              const translation = data.translation as string;
              const paraphrase = data.paraphrase as string;
              const notes = data.notes as string;

              if (translation) {
                storeRef.current.addTranslation({
                  id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  text: translation,
                  timestamp: now,
                });
              }

              if (paraphrase && transcript) {
                storeRef.current.addParaphrase({
                  id: `pp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  originalText: transcript,
                  paraphraseText: paraphrase,
                  timestamp: now,
                });
              }

              if (notes) {
                const blocks: NoteBlock[] = notes
                  .split('\n')
                  .filter((line: string) => line.trim())
                  .map((line: string, i: number) => ({
                    id: `nb-${Date.now()}-${i}`,
                    content: line,
                  }));
                if (blocks.length > 0) {
                  storeRef.current.updateNotes(blocks);
                }
              }
              break;
            }

            case 'error': {
              console.warn('Server error:', data.message);
              break;
            }
          }
        } catch {
          // Ignore parse errors for binary messages
        }
      };
    } catch {
      storeRef.current.setConnectionStatus('error');
      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current),
        RECONNECT_MAX_MS
      );
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(doConnect, delay);
    }
  };

  const connect = useCallback(() => {
    doConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnect();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    storeRef.current.setConnectionStatus('disconnected');
  }, [clearReconnect]);

  const sendAudio = useCallback((data: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const sendText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'text_input', text })
      );
    }
  }, []);

  const sendControl = useCallback((action: 'pause' | 'resume' | 'stop') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: action }));
    }
  }, []);

  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      clearReconnect();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearReconnect]);

  return {
    connectionStatus,
    sendAudio,
    sendText,
    sendControl,
    connect,
    disconnect,
  };
}
