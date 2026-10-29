/** Fixed-position portals use layout coordinates; client rects include CSS zoom. */
export function layoutViewport() {
  const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  return {
    width: window.innerWidth / zoom,
    height: window.innerHeight / zoom,
    rect(element: Element) {
      const rect = element.getBoundingClientRect();
      return { left: rect.left / zoom, right: rect.right / zoom, top: rect.top / zoom, bottom: rect.bottom / zoom, width: rect.width / zoom, height: rect.height / zoom };
    },
  };
}
