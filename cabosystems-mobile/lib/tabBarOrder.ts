/** Reorder the bar only, preserving the focused route and the router's state. */
export function orderTabBarState<T extends { routes: { name: string; key: string }[]; index: number }>(
  state: T,
  order: readonly string[],
): T {
  const focusedKey = state.routes[state.index]?.key;
  const rank = (name: string) => {
    const index = order.indexOf(name);
    return index < 0 ? order.length : index;
  };
  const routes = [...state.routes].sort((a, b) => rank(a.name) - rank(b.name));
  return { ...state, routes, index: Math.max(0, routes.findIndex(route => route.key === focusedKey)) };
}
