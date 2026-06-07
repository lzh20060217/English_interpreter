import { create } from "zustand";

import { DEFAULT_NOTE_TEMPLATE, SOURCE_LANGUAGES, TARGET_LANGUAGES, DEMO_TRANSCRIPTS, DEMO_TRANSLATIONS, DEMO_NOTES, DEMO_PARAPHRASES } from "@/lib/config";
import type {
  ConnectionStatus,
  NoteBlock,
  SessionStatus,
  ThemeMode,
  TranscriptSegment,
  TranslationSegment,
  ParaphraseSegment,
} from "@/types/interpreter";

type InterpreterStore = {
  theme: ThemeMode;
  status: SessionStatus;
  connectionStatus: ConnectionStatus;
  sourceLanguage: string;
  targetLanguage: string;
  transcripts: TranscriptSegment[];
  translations: TranslationSegment[];
  notes: NoteBlock[];
  paraphrases: ParaphraseSegment[];
  setTheme: (theme: ThemeMode) => void;
  setStatus: (status: SessionStatus) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setSourceLanguage: (code: string) => void;
  setTargetLanguage: (code: string) => void;
  addTranscript: (segment: TranscriptSegment) => void;
  addTranslation: (segment: TranslationSegment) => void;
  addParaphrase: (segment: ParaphraseSegment) => void;
  updateNotes: (notes: NoteBlock[]) => void;
  clearAll: () => void;
  loadDemoData: () => void;
};

export const useInterpreterStore = create<InterpreterStore>((set) => ({
  theme: "dark",
  status: "idle",
  connectionStatus: "disconnected",
  sourceLanguage: SOURCE_LANGUAGES[0]?.code ?? "auto",
  targetLanguage: TARGET_LANGUAGES[1]?.code ?? "en",
  transcripts: [],
  translations: [],
  notes: DEFAULT_NOTE_TEMPLATE,
  paraphrases: [],
  setTheme: (theme) => set({ theme }),
  setStatus: (status) => set({ status }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setSourceLanguage: (sourceLanguage) => set({ sourceLanguage }),
  setTargetLanguage: (targetLanguage) => set({ targetLanguage }),
  addTranscript: (segment) => set((state) => ({ transcripts: [...state.transcripts, segment] })),
  addTranslation: (segment) => set((state) => ({ translations: [...state.translations, segment] })),
  addParaphrase: (segment) => set((state) => ({ paraphrases: [...state.paraphrases, segment] })),
  updateNotes: (notes) => set({ notes }),
  clearAll: () => set({ transcripts: [], translations: [], notes: DEFAULT_NOTE_TEMPLATE, paraphrases: [] }),
  loadDemoData: () => set({
    transcripts: DEMO_TRANSCRIPTS,
    translations: DEMO_TRANSLATIONS,
    notes: DEMO_NOTES,
    paraphrases: DEMO_PARAPHRASES,
  }),
}));
