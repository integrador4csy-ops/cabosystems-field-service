import { useCallback, useEffect, useRef, useState } from 'react';

/** Microphone streams are always stopped on cancel, route change, or unmount. */
export function useVoiceNote(onReady: (file: File, duration: number) => void, onError: () => void) {
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const discard = useRef(false);
  const pending = useRef(false);
  const started = useRef(0);
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const release = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  const cancel = useCallback(() => {
    generation.current++; pending.current = false; discard.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    release(); setRecording(false); setStarting(false);
  }, []);
  useEffect(() => () => { generation.current++; discard.current = true; if (recorder.current?.state === 'recording') recorder.current.stop(); release(); }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => { setElapsed((Date.now() - started.current) / 1000); if (Date.now() - started.current >= 300_000 && recorder.current?.state === 'recording') recorder.current.stop(); }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);
  const start = async () => {
    if (pending.current || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { callbacks.current.onError(); return; }
    pending.current = true;
    const token = ++generation.current;
    setStarting(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const session = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = session; discard.current = false;
      const chunks: BlobPart[] = [];
      session.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      session.onerror = () => { discard.current = true; release(); setRecording(false); callbacks.current.onError(); };
      session.onstop = () => {
        const duration = (Date.now() - started.current) / 1000;
        release();
        if (token !== generation.current) return;
        setRecording(false);
        if (discard.current || duration < 0.5 || !chunks.length) return;
        const type = session.mimeType || 'audio/webm';
        const file = new File(chunks, type.includes('mp4') ? 'nota-de-voz.m4a' : 'nota-de-voz.webm', { type });
        callbacks.current.onReady(file, duration);
      };
      started.current = Date.now(); setElapsed(0); session.start(); setRecording(true);
    } catch { release(); callbacks.current.onError(); }
    finally { if (token === generation.current) { pending.current = false; setStarting(false); } }
  };
  useEffect(() => { const hidden = () => { if (document.hidden) cancel(); }; document.addEventListener('visibilitychange', hidden); return () => document.removeEventListener('visibilitychange', hidden); }, [cancel]);
  const stop = () => { if (recorder.current?.state === 'recording') recorder.current.stop(); };
  return { recording, starting, elapsed, start, stop, cancel };
}
