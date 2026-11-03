import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';

export function useChatRecorder(onError: (message: string) => void, language: string) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status = useAudioRecorderState(recorder, 250);
  const [starting, setStarting] = useState(false);
  const [draft, setDraft] = useState<{ uri: string; duration: number } | null>(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const cancel = async () => {
    generation.current++;
    try { if (recorder.getStatus().isRecording) await recorder.stop(); } catch { /* Already stopped by the OS. */ }
    setDraft(null);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  };
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' && recorder.getStatus().isRecording) void cancel();
    });
    return () => { generation.current++; subscription.remove(); try { if (recorder.getStatus().isRecording) void recorder.stop().catch(() => {}); } catch { /* Released by the hook. */ } void setAudioModeAsync({ allowsRecording: false }).catch(() => {}); };
  }, [recorder]);
  const finish = async () => {
    if (lock.current) return;
    lock.current = true;
    const current = generation.current;
    try {
      const duration = recorder.getStatus().durationMillis / 1000;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (current === generation.current && recorder.uri && duration >= 0.5) setDraft({ uri: recorder.uri, duration });
    } catch (err) {
      console.error('Failed to finish audio recording:', err);
      onError(language === 'en' ? 'Could not finish recording. Try again.' : 'No se pudo terminar la grabación. Intenta de nuevo.');
    }
    finally { lock.current = false; }
  };
  useEffect(() => { if (status.isRecording && status.durationMillis >= 300_000) void finish(); }, [status.isRecording, status.durationMillis]);
  const start = async () => {
    if (lock.current) return;
    lock.current = true; setStarting(true);
    const current = generation.current;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { onError(language === 'en' ? 'Allow microphone access to record a voice note.' : 'Permite el acceso al micrófono para grabar una nota de voz.'); return; }
      if (current !== generation.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (current !== generation.current) { await setAudioModeAsync({ allowsRecording: false }); return; }
      recorder.record();
    } catch (err) {
      console.error('Failed to start audio recording:', err);
      onError(language === 'en' ? 'Could not start recording.' : 'No se pudo iniciar la grabación.');
    }
    finally { lock.current = false; setStarting(false); }
  };
  return { recording: status.isRecording, elapsed: status.durationMillis / 1000, starting, draft, start, finish, cancel };
}
