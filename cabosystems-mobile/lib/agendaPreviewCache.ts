/** Reuse prepared page trees; only a page whose inputs changed is rebuilt. */
export class AgendaPreviewCache<T> {
  private pages = new Map<string, { inputs: readonly unknown[]; value: T }>();
  constructor(private capacity = 6) {}
  retain(keys: readonly string[]) {
    const keep = new Set(keys);
    for (const key of this.pages.keys()) if (!keep.has(key)) this.pages.delete(key);
  }
  get(key: string, inputs: readonly unknown[], render: () => T): T {
    const previous = this.pages.get(key);
    if (previous && inputs.length === previous.inputs.length && inputs.every((value, index) => Object.is(value, previous.inputs[index]))) {
      this.pages.delete(key); this.pages.set(key, previous);
      return previous.value;
    }
    const value = render();
    this.pages.delete(key);
    this.pages.set(key, { inputs, value });
    while (this.pages.size > this.capacity) this.pages.delete(this.pages.keys().next().value!);
    return value;
  }
}
