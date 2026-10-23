import { getGroupMessages, getChatPins } from './chatApi';
import type { SectionResources } from '../context/SectionResources';
export async function chatSnapshot(groupId: string) {
  const [messages, pins] = await Promise.all([getGroupMessages(groupId, 100), getChatPins(groupId)]);
  return { messages, pins };
}
export const prefetchConversation = (resources: SectionResources, groupId: string) => resources.queries.load(`conversation:${groupId}`, () => chatSnapshot(groupId), false, 15_000);
