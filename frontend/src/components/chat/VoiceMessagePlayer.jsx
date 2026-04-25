import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';

// Generate random waveform bars
const generateWaveform = (count = 24) => {
  return Array.from({ length: count }, () => Math.random() * 0.6 + 0.2);
};

export default function VoiceMessagePlayer({ audioUrl, duration, isOwn = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const waveformRef = useRef(generateWaveform());

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => {
        console.error('Failed to play audio:', err);
      });
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Calculate which bars are "played" based on progress
  const playedBars = Math.floor((progressPercent / 100) * waveformRef.current.length);

  return (
    <div className={`voice-message-bubble ${isOwn ? 'own' : 'other'}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <button 
        className="voice-play-btn"
        onClick={togglePlay}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
      </button>

      <div className="voice-waveform-container">
        <div className="voice-waveform-bars">
          {waveformRef.current.map((height, index) => (
            <div
              key={index}
              className={`voice-bar ${index < playedBars ? 'played' : ''}`}
              style={{ 
                height: `${height * 100}%`,
                animationDelay: `${index * 0.02}s`
              }}
            />
          ))}
        </div>
      </div>

      <span className="voice-duration">
        {isPlaying ? formatTime(currentTime) : formatTime(duration || 0)}
      </span>
    </div>
  );
}
