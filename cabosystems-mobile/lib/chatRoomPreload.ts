import type { ChatGroup } from '@/types/database';
import { syncChatRoom } from './chatRoomSync';
import { prepareTabs } from './tabPreparation';

/** Every room gets its recent messages before downloading deep history. */
export function prepareChatRooms(userId: string, groups: ChatGroup[], reconcile = false) {
  let active = true;
  const tasks = [true, false].flatMap(headOnly => groups.map(group => async () => {
    if (active && userId) await syncChatRoom(userId, group, () => active, reconcile, headOnly);
  }));
  const stop = prepareTabs(tasks, 2);
  return () => { active = false; stop(); };
}
