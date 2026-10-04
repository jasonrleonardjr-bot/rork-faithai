import {
  BookOpen,
  BookOpenText,
  CloudDrizzle,
  Earth,
  HandHeart,
  HeartHandshake,
  MessageCircleQuestionMark,
  Signpost,
  Sparkles,
  Stethoscope,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Persona, PrayerCategory, Verse } from "./types";

export const PERSONAS: { id: Persona; title: string; subtitle: string; icon: LucideIcon; promptStyle: string }[] = [
  {
    id: "shepherd",
    title: "Shepherd",
    subtitle: "Warm, pastoral encouragement",
    icon: HeartHandshake,
    promptStyle:
      "Speak like a gentle, experienced pastor: compassionate, encouraging, patient. Offer comfort first, then Scripture, then a small practical step or a short prayer when fitting.",
  },
  {
    id: "scholar",
    title: "Scholar",
    subtitle: "History, context & original languages",
    icon: BookOpen,
    promptStyle:
      "Speak like a careful biblical scholar and teacher: explain historical and literary context, authorship, and key Hebrew or Greek words when helpful, and note how the passage has been read across church history.",
  },
  {
    id: "friend",
    title: "Friend",
    subtitle: "Honest, down-to-earth conversation",
    icon: Users,
    promptStyle:
      "Speak like a wise, faithful friend: warm, honest, plain-spoken and brief. Ask a thoughtful follow-up question when it helps the person reflect.",
  },
];

export const TRADITIONS = [
  "Ecumenical",
  "Non-denominational",
  "Catholic",
  "Orthodox",
  "Evangelical",
  "Reformed",
  "Baptist",
  "Methodist",
  "Lutheran",
  "Anglican",
  "Pentecostal",
] as const;

export const TRANSLATIONS = ["ESV", "NIV", "KJV", "NKJV", "NLT", "NASB", "CSB", "NRSV"] as const;

export const PRAYER_CATEGORIES: { id: PrayerCategory; title: string; icon: LucideIcon }[] = [
  { id: "personal", title: "Personal", icon: User },
  { id: "family", title: "Family & Friends", icon: Users },
  { id: "healing", title: "Healing", icon: Stethoscope },
  { id: "guidance", title: "Guidance", icon: Signpost },
  { id: "thanksgiving", title: "Thanksgiving", icon: Sparkles },
  { id: "world", title: "The World", icon: Earth },
];

export function categoryInfo(id: PrayerCategory) {
  return PRAYER_CATEGORIES.find((c) => c.id === id) ?? PRAYER_CATEGORIES[0];
}

export interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  prompt: string;
}

export function quickActions(verse: Verse): QuickAction[] {
  return [
    {
      id: "devotional",
      title: "Devotional",
      subtitle: "A reflection on today’s verse",
      icon: BookOpenText,
      prompt: `Write me a short devotional for today based on ${verse.reference}: a brief reflection, one question to sit with, and a closing prayer.`,
    },
    {
      id: "pray",
      title: "Help me pray",
      subtitle: "Guided, step by step",
      icon: HandHeart,
      prompt:
        "I’d like to pray but I don’t know where to begin. Would you gently guide me through a simple prayer, one step at a time?",
    },
    {
      id: "struggle",
      title: "I’m struggling",
      subtitle: "Talk through what’s heavy",
      icon: CloudDrizzle,
      prompt: "I’m going through a hard time right now. Can we talk about it?",
    },
    {
      id: "question",
      title: "Hard questions",
      subtitle: "Doubt, honestly explored",
      icon: MessageCircleQuestionMark,
      prompt:
        "I have questions about my faith that feel difficult to ask. Can you help me think them through honestly?",
    },
  ];
}

export const CHAT_SUGGESTIONS = [
  "What does it mean to abide in Christ?",
  "Explain the Beatitudes simply",
  "How do I forgive someone who hurt me?",
  "Give me a reading plan for anxiety",
];
