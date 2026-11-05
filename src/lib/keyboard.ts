export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function isModalOpen(): boolean {
  return document.querySelector('dialog[open], [role="dialog"], [role="menu"]') !== null;
}
