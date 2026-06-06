import type {
  DeviceOption,
  LanguageOption,
  NoteBlock,
  ParaphraseSegment,
  TranscriptSegment,
  TranslationSegment,
} from "@/types/interpreter";

export const SOURCE_LANGUAGES: LanguageOption[] = [
  { code: "auto", label: "自动识别" },
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
];

export const TARGET_LANGUAGES: LanguageOption[] = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
];

export const DEFAULT_NOTE_TEMPLATE: NoteBlock[] = [
  {
    id: "intro",
    content: "点击开始录音\n系统将自动生成符号化笔记",
  },
];

export const FALLBACK_AUDIO_DEVICES: DeviceOption[] = [
  { deviceId: "default", label: "系统默认麦克风" },
];

export const DEMO_TRANSCRIPTS: TranscriptSegment[] = [
  {
    id: "t-1",
    text: "Good morning everyone, today I will share the Q3 international expansion strategy.",
    isFinal: true,
    timestamp: "09:42:10",
  },
  {
    id: "t-2",
    text: "We achieved 18 percent growth in Southeast Asia, with Singapore and Vietnam leading the pipeline.",
    isFinal: false,
    timestamp: "09:42:14",
  },
  {
    id: "t-3",
    text: "Our next milestone is to localize customer support before November 15.",
    isFinal: true,
    timestamp: "09:42:18",
  },
];

export const DEMO_TRANSLATIONS: TranslationSegment[] = [
  {
    id: "tr-1",
    text: "各位早上好，今天我将分享第三季度国际扩张战略。",
    timestamp: "09:42:10",
  },
  {
    id: "tr-2",
    text: "我们在东南亚实现了 18% 的增长，其中新加坡和越南带动了主要机会管道。",
    timestamp: "09:42:14",
  },
  {
    id: "tr-3",
    text: "下一个关键里程碑是在 11 月 15 日之前完成客服本地化。",
    timestamp: "09:42:18",
  },
];

export const DEMO_PARAPHRASES: ParaphraseSegment[] = [
  {
    id: "p-1",
    originalText: "Good morning everyone, today I will share the Q3 international expansion strategy.",
    paraphraseText: "Hello everyone. This morning, I'm going to talk about our plan to expand into new countries in the third quarter of this year.",
    timestamp: "09:42:12",
  },
  {
    id: "p-2",
    originalText: "We achieved 18 percent growth in Southeast Asia, with Singapore and Vietnam leading the pipeline.",
    paraphraseText: "Our business in Southeast Asia grew by 18%. Most of the new opportunities came from Singapore and Vietnam.",
    timestamp: "09:42:16",
  },
  {
    id: "p-3",
    originalText: "Our next milestone is to localize customer support before November 15.",
    paraphraseText: "The next big goal is to adapt our customer support for local markets, and we need to finish this by November 15th.",
    timestamp: "09:42:20",
  },
];

export const DEMO_NOTES: NoteBlock[] = [
  {
    id: "n-1",
    content: "Q3 国际扩张\n  → SEA ↑18%\n    + SG 领先\n    + VN 领先",
  },
  {
    id: "n-2",
    content: "下一个里程碑\n  → 客服本地化\n  = 11/15 前 ok",
  },
];
