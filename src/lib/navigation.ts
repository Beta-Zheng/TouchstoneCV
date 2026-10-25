import type { View } from "./store";
export function viewHash(view: View): string {
  return view.name === "editor"
    ? `#/editor/${encodeURIComponent(view.resumeId)}${view.panel === "ai" ? "?panel=ai" : ""}`
    : `#/${view.name}${view.name === "applications" && view.dueOnly ? "?filter=due" : ""}`;
}
export function hashView(hash: string): View | null {
  const [path, query = '', ...extra] = hash.replace(/^#\/?/, "").split('?');
  if (extra.length || !['', 'panel=ai', 'filter=due'].includes(query)) return null;
  const route = path.split('/');
  if (query === 'panel=ai' && route[0] !== 'editor') return null;
  if (query === 'filter=due' && route[0] !== 'applications') return null;
  if (
    ["home", "models", "settings", "applications"].includes(route[0]) &&
    route.length === 1
  )
    return { name: route[0], ...(query === "filter=due" ? { dueOnly:true } : {}) } as View;
  if (route[0] === "editor" && route.length === 2) {
    try {
      const resumeId = decodeURIComponent(route[1]);
      return /^[\w-]{1,128}$/.test(resumeId)
        ? { name: "editor", resumeId, ...(query === "panel=ai" ? {panel:"ai" as const} : {}) }
        : null;
    } catch {
      return null;
    }
  }
  return null;
}
