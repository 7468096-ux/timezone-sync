/* ── the app's domain logic: pure functions only (no React, no DOM), covered by tests/ ──
   DEMO: a tiny list. Replace this file with the real idea's model, keeping the same contract:
     sanitizeState(anything) → a valid state or null   (everything from links, storage and sync passes here)
     makeExample(t)          → first-visit content, in the visitor's language                              */
const MAX_ITEMS = 200;
const MAX_TEXT = 200;

export function sanitizeState(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.items)) return null;
  const items = [];
  for (const it of raw.items.slice(0, MAX_ITEMS)) {
    if (!it || typeof it !== "object") continue;
    const text = String(it.text ?? "").trim().slice(0, MAX_TEXT);
    if (!text) continue;
    items.push({ id: items.length + 1, text, done: it.done === true });
  }
  return { items };
}

export const makeExample = (t) => ({
  items: [t("ex1"), t("ex2"), t("ex3")].map((text, i) => ({ id: i + 1, text, done: false })),
});

export const nextId = (items) => Math.max(0, ...items.map(i => i.id)) + 1;

export function addItem(state, text) {
  const clean = String(text ?? "").trim().slice(0, MAX_TEXT);
  if (!clean || state.items.length >= MAX_ITEMS) return state;
  return { ...state, items: [...state.items, { id: nextId(state.items), text: clean, done: false }] };
}

export const toggleItem = (state, id) =>
  ({ ...state, items: state.items.map(i => (i.id === id ? { ...i, done: !i.done } : i)) });

// → { state, removed: { item, index } } so the UI can offer Undo
export function removeItem(state, id) {
  const index = state.items.findIndex(i => i.id === id);
  if (index < 0) return { state, removed: null };
  return { state: { ...state, items: state.items.filter(i => i.id !== id) }, removed: { item: state.items[index], index } };
}

export function restoreItem(state, { item, index }) {
  const items = [...state.items];
  items.splice(Math.min(index, items.length), 0, { ...item, id: nextId(items) });
  return { ...state, items };
}
