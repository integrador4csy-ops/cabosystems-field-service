/** Claim horizontal intent only; leave normal vertical conversation scrolling alone. */
export function shouldStartReplyGesture(dx: number, dy: number): boolean {
  return dx > 14 && Math.abs(dy) < 12 && dx > Math.abs(dy) * 1.5;
}
export function shouldCompleteReplyGesture(dx: number, dy: number): boolean {
  return dx >= 60 && Math.abs(dy) < 36;
}
