import type { View } from "./store";
export function viewHash(view: View): string {
  return view.name === "editor"
    ? `#/editor/${encodeURIComponent(view.resumeId)}`
    : `#/${view.name}`;
}
export function hashView(hash: string): View | null {
  const route = hash.replace(/^#\/?/, "").split("/");
  if (
    ["home", "models", "settings", "applications"].includes(route[0]) &&
    route.length === 1
  )
    return { name: route[0] } as View;
  if (route[0] === "editor" && route.length === 2) {
    try {
      const resumeId = decodeURIComponent(route[1]);
      return /^[\w-]{1,128}$/.test(resumeId)
        ? { name: "editor", resumeId }
        : null;
    } catch {
      return null;
    }
  }
  return null;
}
