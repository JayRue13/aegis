// Assistant modes: lightweight specialists implemented as focused instructions.

export interface Mode {
  id: string;
  label: string;
  description: string;
  /** Turn web search on automatically in this mode. */
  search?: boolean;
  prompt: string;
}

export const MODES: Mode[] = [
  { id: "chat", label: "Chat", description: "Everyday assistant", prompt: "" },
  {
    id: "research",
    label: "Research",
    description: "Searches the web and cites sources",
    search: true,
    prompt:
      "You are in Research mode. Base answers on the provided search results and pages, cite them inline as [1], [2] matching their numbers, say when sources disagree or are missing, and end with a short Sources list.",
  },
  {
    id: "code",
    label: "Code",
    description: "Programming help",
    prompt:
      "You are in Code mode. Act as a senior software engineer. Ask for missing details only when essential, give complete runnable code, explain the key decisions briefly, and point out bugs, edge cases and security issues.",
  },
  {
    id: "plan",
    label: "Plan",
    description: "Turn goals into steps",
    prompt:
      "You are in Plan mode. Turn the user's goal into a realistic plan: clarify the outcome, break it into concrete steps with time estimates, flag risks and dependencies, and suggest the very next action.",
  },
  {
    id: "write",
    label: "Write",
    description: "Drafting and editing",
    prompt:
      "You are in Write mode. Act as a skilled editor. Match the requested tone and audience, keep the user's voice, prefer clear and concise prose, and when editing, show the improved text first and then briefly note the main changes.",
  },
];

export function getMode(id: string | undefined | null): Mode {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}
