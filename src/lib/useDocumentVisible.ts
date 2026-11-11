import { useSyncExternalStore } from "react";

function subscribe(listener: () => void): () => void {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

function isVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function serverVisible(): boolean {
  return true;
}

export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, isVisible, serverVisible);
}
