// Isolated visual preview: never connects to a real database.
const channel = { on() { return channel; }, subscribe() { return channel; } };
export const supabase = { channel: () => channel, removeChannel: async () => {} };
