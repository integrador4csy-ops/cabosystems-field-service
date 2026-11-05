import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';

interface ChatAudioPlayerProps {
  src: string;
  isMe?: boolean;
  duration?: number;
  compact?: boolean;
  className?: string;
}

const WAVE_BARS = [
  7, 13, 20, 12, 16, 24, 18, 9, 15, 22, 14, 19, 26, 16, 11, 18, 24, 13, 20, 15, 9, 17, 22, 14, 18, 11, 15, 8
];

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function ChatAudioPlayer({
  src,
  isMe = false,
  duration = 0,
  compact = false,
  className = '',
}: ChatAudioPlayerProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [isScrubbing, setIsScrubbing] = useState(false);

  useEffect(() => {
    if (duration > 0 && !totalDuration) {
      setTotalDuration(duration);
    }
  }, [duration, totalDuration]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (isPlaying) {
        audio.pause();
      } else {
        if (audio.ended) {
          audio.currentTime = 0;
        }
        await audio.play();
      }
    } catch {
      setIsPlaying(false);
    }
  };

  const cycleSpeed = () => {
    const nextSpeed: 1 | 1.5 | 2 = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const seekFromPointer = (e: ReactPointerEvent<HTMLDivElement> | PointerEvent) => {
    const track = trackRef.current;
    const audio = audioRef.current;
    if (!track || !audio || !totalDuration) return;

    const rect = track.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = ratio * totalDuration;

    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromPointer(e);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isScrubbing) {
      seekFromPointer(e);
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if pointer capture already ended
      }
    }
  };

  const progressRatio = totalDuration > 0 ? Math.max(0, Math.min(1, currentTime / totalDuration)) : 0;
  const activeBarsCount = Math.round(progressRatio * WAVE_BARS.length);

  return (
    <div
      className={`flex items-center gap-2.5 select-none ${
        compact ? 'min-w-[190px] py-1' : 'min-w-[230px] sm:min-w-[260px] py-1 px-0.5'
      } ${className}`}
      role="region"
      aria-label={t('Nota de voz')}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration && Number.isFinite(audioRef.current.duration)) {
            setTotalDuration(audioRef.current.duration);
          }
        }}
        onTimeUpdate={() => {
          if (!isScrubbing && audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      {/* Play / Pause Circular Button */}
      <button
        type="button"
        onClick={() => void togglePlay()}
        aria-label={isPlaying ? t('Pausar nota de voz') : t('Reproducir nota de voz')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 cursor-pointer shadow-xs ${
          isMe
            ? 'bg-white text-brand-600 hover:bg-white/95'
            : 'bg-brand-500 text-white hover:bg-brand-600'
        }`}
      >
        {isPlaying ? (
          <Pause size={18} fill="currentColor" aria-hidden="true" />
        ) : (
          <Play size={18} fill="currentColor" className="ml-0.5" aria-hidden="true" />
        )}
      </button>

      {/* Center Waveform & Progress */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex h-7 items-center gap-[2.5px] cursor-pointer py-1 touch-none"
          title={t('Nota de voz')}
        >
          {WAVE_BARS.map((height, i) => {
            const isActive = i <= activeBarsCount;
            return (
              <span
                key={i}
                style={{ height: `${height}px` }}
                className={`w-[3px] shrink-0 rounded-full transition-colors ${
                  isMe
                    ? isActive
                      ? 'bg-white'
                      : 'bg-white/35 hover:bg-white/50'
                    : isActive
                    ? 'bg-brand-500'
                    : 'bg-slate-200 hover:bg-slate-300'
                }`}
              />
            );
          })}
        </div>

        {/* Footer time and speed */}
        <div className="flex items-center justify-between text-[11px] font-medium leading-none">
          <div className={`flex items-center gap-1 ${isMe ? 'text-white/90' : 'text-slate-500'}`}>
            <Mic size={11} className={isMe ? 'text-white/75' : 'text-slate-400'} aria-hidden="true" />
            <span className="tabular-nums font-mono">
              {isPlaying ? formatAudioTime(currentTime) : formatAudioTime(totalDuration || currentTime)}
            </span>
          </div>

          <button
            type="button"
            onClick={cycleSpeed}
            aria-label={t('Velocidad de reproducción')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight transition-colors cursor-pointer ${
              isMe
                ? 'bg-white/20 hover:bg-white/30 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>
    </div>
  );
}
