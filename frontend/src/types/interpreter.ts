export type ThemeMode = "dark" | "light";

export type SessionStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "recording"
  | "paused"
  | "processing"
  | "stopped"
  | "error";

export type LanguageOption = {
  code: string;
  label: string;
};

export type DeviceOption = {
  deviceId: string;
  label: string;
};

export type TranscriptSegment = {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: string;
};

export type TranslationSegment = {
  id: string;
  text: string;
  timestamp: string;
};

export type NoteBlock = {
  id: string;
  content: string;
};

export type ParaphraseSegment = {
  id: string;
  originalText: string;
  paraphraseText: string;
  timestamp: string;
};

export type ClientEvent =
  | {
      type: "audio_chunk";
      sessionId: string;
      sequence: number;
      mimeType: string;
      audioBase64: string;
      timestamp: number;
    }
  | {
      type: "control";
      sessionId: string;
      action: "pause" | "resume" | "stop";
    };

export type ServerEvent =
  | {
      type: "transcript";
      sessionId: string;
      chunkId: string;
      text: string;
      isFinal: boolean;
      startMs?: number;
      endMs?: number;
    }
  | {
      type: "translation";
      sessionId: string;
      chunkId: string;
      text: string;
      targetLanguage: string;
    }
  | {
      type: "notes";
      sessionId: string;
      version: number;
      outline: NoteBlock[];
    }
  | {
      type: "paraphrase";
      sessionId: string;
      chunkId: string;
      originalText: string;
      paraphraseText: string;
    }
  | {
      type: "status";
      sessionId: string;
      state: SessionStatus;
      message?: string;
    };
