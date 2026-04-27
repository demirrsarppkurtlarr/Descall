import { useState, useEffect, useRef, useCallback } from 'react';
import voiceEffects from '../lib/voiceEffects';
import { 
  Mic, 
  Wand2, 
  Volume2, 
  Activity, 
  Check, 
  Settings2,
  Sparkles,
  Radio,
  Mountain,
  Wind,
  Ghost,
  Baby,
  Phone,
  Megaphone,
  Droplets,
  Building,
  Home,
  Music,
  Zap
} from 'lucide-react';
import './VoiceEffectsPanel.css';

const PRESET_ICONS = {
  none: Mic,
  robot: Wand2,
  radio: Radio,
  cave: Mountain,
  helium: Wind,
  monster: Ghost,
  telephone: Phone,
  megaphone: Megaphone,
  underwater: Droplets,
  stadium: Building,
  small_room: Home,
  concert_hall: Music,
  whisper: Volume2,
  demon: Ghost,
  alien: Sparkles,
  baby: Baby,
  giant: Mountain,
  echo: Activity,
  reverb_only: Music,
  autotune: Zap,
  harmonizer: Music
};

export default function VoiceEffectsPanel({ isOpen, onClose, localStream, onProcessedStream }) {
  const [presets, setPresets] = useState([]);
  const [currentPreset, setCurrentPreset] = useState('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [rnnoiseEnabled, setRnnoiseEnabled] = useState(false);
  const [visualizationData, setVisualizationData] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const processedStreamRef = useRef(null);

  // TDZ FIX: stopVoiceEffects MUST be defined before any useEffect that uses it
  // This prevents "Cannot access before initialization" error
  const stopVoiceEffects = useCallback(() => {
    voiceEffects.stop();
    if (processedStreamRef.current) {
      processedStreamRef.current.getTracks().forEach(track => track.stop());
      processedStreamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsProcessing(false);
  }, []);

  // Initialize voice effects with cancellation support
  useEffect(() => {
    let isCancelled = false;
    
    const init = async () => {
      if (!isOpen) return;
      
      setIsInitializing(true);
      setError(null);
      
      try {
        await voiceEffects.initialize();
        
        // GUARD: Component still mounted?
        if (isCancelled) {
          voiceEffects.stop();
          return;
        }
        
        // Check if initialization was successful
        if (voiceEffects.isInitialized) {
          setPresets(voiceEffects.getPresets());
          setCurrentPreset(voiceEffects.getCurrentPreset());
          setIsProcessing(true);
          setRnnoiseEnabled(voiceEffects.isRNNoiseEnabled());
        } else {
          setError('Voice effects failed to start');
        }
      } catch (err) {
        if (!isCancelled) {
          setError('Initialization error: ' + err.message);
        }
      } finally {
        if (!isCancelled) {
          setIsInitializing(false);
        }
      }
    };
    
    init();
    
    return () => {
      isCancelled = true;
      stopVoiceEffects();
    };
  }, [isOpen, stopVoiceEffects]);

  // Process stream when localStream changes
  useEffect(() => {
    let isActive = true;
    
    const process = async () => {
      if (!isOpen || !localStream || !isProcessing) return;
      
      // GUARD: Voice effects must be initialized
      if (!voiceEffects.audioContext || voiceEffects.audioContext.state !== 'running') {
        console.log('[VoiceEffectsPanel] Waiting for initialization...');
        return;
      }
      
      try {
        if (processedStreamRef.current) {
          processedStreamRef.current.getTracks().forEach(track => track.stop());
        }
        
        voiceEffects.stop();
        
        if (!isActive) return;
        
        const processedStream = await voiceEffects.start(localStream);
        
        if (!isActive) {
          processedStream.getTracks().forEach(track => track.stop());
          return;
        }
        
        processedStreamRef.current = processedStream;
        
        if (onProcessedStream) {
          onProcessedStream(processedStream);
        }
      } catch (err) {
        if (isActive) {
          console.error('Stream processing error:', err);
          setError('Audio processing failed: ' + err.message);
        }
      }
    };
    
    process();
    
    return () => {
      isActive = false;
    };
  }, [isOpen, localStream, isProcessing]);

  const initializeVoiceEffects = async () => {
    setIsInitializing(true);
    setError(null);
    
    try {
      const success = await voiceEffects.initialize();
      if (success) {
        setPresets(voiceEffects.getPresets());
        setCurrentPreset(voiceEffects.getCurrentPreset());
        setIsProcessing(true);
        setRnnoiseEnabled(voiceEffects.isRNNoiseEnabled());
      } else {
        setError('Voice effects failed to start');
      }
    } catch (err) {
      setError('Initialization error: ' + err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  const processStream = async () => {
    if (!localStream) return;
    
    console.log('[VoiceEffectsPanel] processStream called, voiceEffects methods:', {
      hasStart: typeof voiceEffects.start === 'function',
      hasProcessStream: typeof voiceEffects.processStream === 'function',
      isInitialized: voiceEffects.isInitialized,
      hasAudioContext: !!voiceEffects.audioContext
    });
    
    try {
      // Stop previous processing
      if (processedStreamRef.current) {
        processedStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      console.log('[VoiceEffectsPanel] Calling voiceEffects.stop()');
      voiceEffects.stop();
      
      // Start new processing - use processStream directly as fallback
      console.log('[VoiceEffectsPanel] Starting stream processing...');
      let processedStream;
      
      if (typeof voiceEffects.start === 'function') {
        console.log('[VoiceEffectsPanel] Using voiceEffects.start()');
        processedStream = await voiceEffects.start(localStream);
      } else if (typeof voiceEffects.processStream === 'function') {
        console.log('[VoiceEffectsPanel] Fallback to voiceEffects.processStream()');
        processedStream = await voiceEffects.processStream(localStream);
      } else {
        throw new Error('Neither start() nor processStream() methods available');
      }
      
      console.log('[VoiceEffectsPanel] Stream processed successfully');
      processedStreamRef.current = processedStream;
      
      if (onProcessedStream) {
        onProcessedStream(processedStream);
      }
    } catch (err) {
      console.error('[VoiceEffectsPanel] Stream processing error:', err);
      console.error('[VoiceEffectsPanel] Error stack:', err.stack);
      setError('Ses işleme hatası: ' + err.message);
    }
  };

  // Visualization
  useEffect(() => {
    if (!isOpen || !isProcessing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const animate = () => {
      const data = voiceEffects.getVisualizationData();
      if (data) {
        drawVisualization(ctx, canvas, data);
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isOpen, isProcessing]);

  const drawVisualization = (ctx, canvas, data) => {
    const width = canvas.width;
    const height = canvas.height;
    const barWidth = width / data.length;

    ctx.clearRect(0, 0, width, height);

    // Draw frequency bars
    for (let i = 0; i < data.length; i++) {
      const barHeight = (data[i] / 255) * height * 0.8;
      const x = i * barWidth;
      const y = height - barHeight;

      // Gradient
      const gradient = ctx.createLinearGradient(0, y, 0, height);
      gradient.addColorStop(0, '#8b5cf6');
      gradient.addColorStop(0.5, '#6366f1');
      gradient.addColorStop(1, '#3b82f6');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }

    // Draw center line
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  };

  const handlePresetChange = async (presetId) => {
    try {
      // Prevent clicking the same preset
      if (currentPreset === presetId) {
        console.log('[VoiceEffects] Preset already active:', presetId);
        return;
      }
      
      console.log('[VoiceEffects] Changing preset from', currentPreset, 'to', presetId);
      await voiceEffects.setPreset(presetId);
      setCurrentPreset(presetId);
    } catch (err) {
      console.error('Preset change error:', err);
      // Reset to none on error
      setCurrentPreset('none');
    }
  };

  const handleRNNoiseToggle = () => {
    const newEnabled = !rnnoiseEnabled;
    voiceEffects.toggleRNNoise(newEnabled);
    setRnnoiseEnabled(newEnabled);
  };

  if (!isOpen) return null;

  return (
    <div className="voice-effects-panel-overlay" onClick={onClose}>
      <div className="voice-effects-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <div className="header-title">
            <Sparkles className="icon" />
            <h2>Voice Effects</h2>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {isInitializing && (
          <div className="loading-state">
            <div className="spinner" />
            <span>Voice engine starting...</span>
          </div>
        )}

        <div className="panel-content">
          {/* Visualization */}
          <div className="visualization-section">
            <canvas 
              ref={canvasRef} 
              width={600} 
              height={150}
              className="visualizer-canvas"
            />
            <div className="visualization-label">
              <Activity size={14} />
              <span>Real-time Spectrum</span>
            </div>
          </div>

          {/* RNNoise Toggle */}
          <div className="rnnoise-section">
            <div className="rnnoise-info">
              <Settings2 size={18} />
              <div>
                <span className="rnnoise-title">RNNoise AI</span>
                <span className="rnnoise-desc">AI noise suppression</span>
              </div>
            </div>
            <button 
              className={`toggle-btn ${rnnoiseEnabled ? 'active' : ''}`}
              onClick={handleRNNoiseToggle}
            >
              {rnnoiseEnabled ? <Check size={16} /> : <span className="dot" />}
              {rnnoiseEnabled ? 'Active' : 'Inactive'}
            </button>
          </div>

          {/* Presets Grid */}
          <div className="presets-section">
            <h3>Effect Presets</h3>
            <div className="presets-grid">
              {presets.map(preset => {
                const Icon = PRESET_ICONS[preset.id] || Mic;
                const isActive = currentPreset === preset.id;
                
                return (
                  <button
                    key={preset.id}
                    className={`preset-btn ${isActive ? 'active' : ''}`}
                    onClick={() => handlePresetChange(preset.id)}
                  >
                    <div className="preset-icon">
                      <Icon size={24} />
                    </div>
                    <div className="preset-info">
                      <span className="preset-name">{preset.name}</span>
                      <span className="preset-desc">{preset.description}</span>
                    </div>
                    {isActive && <div className="active-indicator" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Effect Info */}
          {currentPreset !== 'none' && (
            <div className="current-effect-info">
              <div className="effect-badge">
                <Sparkles size={14} />
                <span>{presets.find(p => p.id === currentPreset)?.name}</span>
              </div>
              <span className="effect-status">Effect active</span>
            </div>
          )}
        </div>

        <div className="panel-footer">
          <p className="footer-note">
            Powered by Web Audio API + WebAssembly
          </p>
        </div>
      </div>
    </div>
  );
}
