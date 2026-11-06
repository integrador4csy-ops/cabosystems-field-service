import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

interface TypingPayload {
  userId: string;
  name: string;
  typing: boolean;
}

const SEND_INTERVAL_MS = 1_200;
const STOP_DELAY_MS = 1_800;
const STALE_DELAY_MS = 3_500;

export function useChatTyping(groupId: string, userId: string, userName: string) {
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const subscribedRef = useRef(false);
  const localTypingRef = useRef(false);
  const lastSentAtRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const remoteNamesRef = useRef(new Map<string, string>());

  const publish = useCallback((typing: boolean) => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current || !userId) return;
    localTypingRef.current = typing;
    if (typing) lastSentAtRef.current = Date.now();
    void channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, name: userName || 'Técnico', typing } satisfies TypingPayload,
    });
  }, [userId, userName]);

  const notifyTyping = useCallback((typing: boolean) => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (!typing) {
      if (localTypingRef.current) publish(false);
      return;
    }
    const now = Date.now();
    if (!localTypingRef.current || now - lastSentAtRef.current >= SEND_INTERVAL_MS) publish(true);
    stopTimerRef.current = setTimeout(() => publish(false), STOP_DELAY_MS);
  }, [publish]);

  useEffect(() => {
    if (!groupId || !userId) return;
    subscribedRef.current = false;
    localTypingRef.current = false;
    remoteNamesRef.current.clear();
    setTypingNames([]);

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const topic = `chat_typing:${groupId}`;
    const updateNames = () => setTypingNames(Array.from(remoteNamesRef.current.values()));
    const receiveTyping = ({ payload }: { payload: TypingPayload }) => {
        if (!payload || payload.userId === userId) return;
        const previousTimer = remoteTimersRef.current.get(payload.userId);
        if (previousTimer) clearTimeout(previousTimer);
        remoteTimersRef.current.delete(payload.userId);
        if (!payload.typing) {
          remoteNamesRef.current.delete(payload.userId);
          updateNames();
          return;
        }
        remoteNamesRef.current.set(payload.userId, payload.name || 'Técnico');
        updateNames();
        remoteTimersRef.current.set(payload.userId, setTimeout(() => {
          remoteTimersRef.current.delete(payload.userId);
          remoteNamesRef.current.delete(payload.userId);
          updateNames();
        }, STALE_DELAY_MS));
    };
    const connect = async () => {
      const existingChannels = supabase.getChannels().filter((candidate) => candidate.topic === topic || candidate.topic === `realtime:${topic}`);
      await Promise.all(existingChannels.map((candidate) => supabase.removeChannel(candidate)));
      if (cancelled) return;
      channel = supabase
        .channel(topic)
        .on('broadcast', { event: 'typing' }, receiveTyping)
        .subscribe((status) => { subscribedRef.current = status === 'SUBSCRIBED'; });
      channelRef.current = channel;
    };
    void connect();

    return () => {
      cancelled = true;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (channel && localTypingRef.current && subscribedRef.current) {
        void channel.send({ type: 'broadcast', event: 'typing', payload: { userId, name: userName || 'Técnico', typing: false } satisfies TypingPayload });
      }
      remoteTimersRef.current.forEach(clearTimeout);
      remoteTimersRef.current.clear();
      remoteNamesRef.current.clear();
      channelRef.current = null;
      subscribedRef.current = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [groupId, userId, userName]);

  return { typingNames, notifyTyping };
}
