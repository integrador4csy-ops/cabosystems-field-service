import { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';

export function ChatVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const { t } = useTranslation();

  async function play() {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.ended) video.currentTime = 0;
      await video.play();
    } catch {
      // Leave the play button available if playback is interrupted.
      setPlaying(false);
    }
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={`${src}#t=0.001`}
        preload="metadata"
        playsInline
        controls={playing}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="block max-h-72 w-full rounded-2xl"
      />
      {!playing && (
        <button
          type="button"
          aria-label={t('Reproducir video')}
          onClick={() => void play()}
          className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#f78c26] text-white shadow-sm hover:bg-[#e77b18] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white cursor-pointer"
        >
          <Play size={24} fill="currentColor" className="ml-0.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
