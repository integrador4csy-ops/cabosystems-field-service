export interface ChatRect { x: number; y: number; width: number; height: number }

/** Anchor to the selected bubble, in screen coordinates, without covering the header. */
export function getReactionBarLayout(anchor: ChatRect, viewport: ChatRect, root: ChatRect, outgoing: boolean) {
  if (anchor.y + anchor.height <= viewport.y || anchor.y >= viewport.y + viewport.height || viewport.height < 64) return null;
  const width = Math.min(328, viewport.width - 16);
  const preferredX = outgoing ? anchor.x + anchor.width - width : anchor.x;
  const left = Math.max(viewport.x + 8, Math.min(preferredX, viewport.x + viewport.width - width - 8)) - root.x;
  const top = Math.max(viewport.y + 8, anchor.y - 60) - root.y;
  return { left, top, width };
}
