'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Browser Speech Recognition API (Web Speech API)
// Works in Chrome, Edge, Safari. Not in Firefox.

// Minimal type aliases for SpeechRecognition (may not be in ts lib)
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  start: () => void;
  stop: () => void;
  error: string | null;
}

export function useSpeechRecognition(
  opts?: UseSpeechRecognitionOptions
): UseSpeechRecognitionReturn {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optsRef = useRef(opts);
  // Sync ref in useEffect to avoid lint errors
  useEffect(() => {
    optsRef.current = opts;
  });

  // Check browser support
  const SpeechCtor: (new () => SpeechRecognitionInstance) | null =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const isSupported = SpeechCtor != null;

  useEffect(() => {
    if (!isSupported || !SpeechCtor) return;

    const recognition = new SpeechCtor();
    recognition.continuous = opts?.continuous ?? true;
    recognition.interimResults = opts?.interimResults ?? true;
    recognition.lang = opts?.language ?? 'zh-CN';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Build transcript from results
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0]?.transcript ?? '';
        } else {
          interimText += result[0]?.transcript ?? '';
        }
      }

      const current = optsRef.current;
      if (finalText && current?.onResult) {
        current.onResult(finalText, true);
      }
      if (interimText && current?.onResult) {
        current.onResult(interimText, false);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        // These are not real errors
        return;
      }
      const msg = event.message || event.error;
      setError(msg);
      optsRef.current?.onError?.(msg);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if we're still recording
      // The hook consumer handles this via the isListening state
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {
        // Ignore
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported, opts?.language]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setError(null);
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      // Already started — ignore
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // Already stopped — ignore
    }
    setIsListening(false);
  }, []);

  return {
    isSupported,
    isListening,
    start,
    stop,
    error,
  };
}
