/**
 * Professional Voice Effects System for Descall
 * Advanced real-time audio processing with Web Audio API
 */

class VoiceEffectsProcessor {
  constructor() {
    this.audioContext = null;
    this.source = null;
    this.destination = null;
    this.isProcessing = false;
    this.currentPreset = 'none';
    this.analyser = null;
    
    // Effect chain nodes
    this.nodes = {
      input: null,
      eq: [],
      compressor: null,
      distortion: null,
      reverb: null,
      delay: null,
      analyser: null,
      output: null
    };
    
    // RNNoise state
    this.rnnoise = { enabled: false };
    
    // Visualization callback
    this.onVisualizerUpdate = null;
    
    // Reverb buffer cache for memory management
    this.reverbBuffers = new Map();
    this.maxImpulses = 10;
    
    // Initialize presets
    this.presets = this.initializePresets();
  }

  // Initialize the audio engine
  async initialize() {
    try {
      // Check if already initialized and not closed
      if (this.audioContext && this.audioContext.state !== 'closed') {
        console.log('[VoiceEffects] Already initialized');
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        return true;
      }

      // Close existing context if any
      if (this.audioContext && this.audioContext.state !== 'closed') {
        await this.audioContext.close();
      }

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      // Handle suspended state (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Clear old reverb buffers
      this.reverbBuffers.clear();

      // Setup analyser for visualization
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      console.log('[VoiceEffects] Audio engine initialized');
      return true;
    } catch (error) {
      console.error('[VoiceEffects] Initialization failed:', error);
      return false;
    }
  }

  // Start processing a stream
  async start(stream) {
    if (!this.audioContext) {
      await this.initialize();
    }

    if (!this.audioContext) {
      throw new Error('Audio context not initialized');
    }

    try {
      // Create source from stream
      this.source = this.audioContext.createMediaStreamSource(stream);
      
      // Create destination for output
      this.destination = this.audioContext.createMediaStreamDestination();
      
      // Create processing chain
      this.createEffectChain();
      
      // Apply current preset
      if (this.currentPreset !== 'none') {
        this.applyPreset(this.currentPreset);
      }

      this.isProcessing = true;
      this.startVisualization();

      console.log('[VoiceEffects] Started processing stream');
      return this.destination.stream;
    } catch (error) {
      console.error('[VoiceEffects] Failed to start:', error);
      throw error;
    }
  }

  // Create the effect processing chain
  createEffectChain() {
    if (!this.audioContext) return;

    // Clear previous nodes
    this.clearNodes();

    // Create EQ nodes
    const lowShelf = this.audioContext.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 320;
    lowShelf.gain.value = 0;

    const peaking1 = this.audioContext.createBiquadFilter();
    peaking1.type = 'peaking';
    peaking1.frequency.value = 1000;
    peaking1.Q.value = 1;
    peaking1.gain.value = 0;

    const peaking2 = this.audioContext.createBiquadFilter();
    peaking2.type = 'peaking';
    peaking2.frequency.value = 4000;
    peaking2.Q.value = 1;
    peaking2.gain.value = 0;

    const highShelf = this.audioContext.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 8000;
    highShelf.gain.value = 0;

    this.nodes.eq = [lowShelf, peaking1, peaking2, highShelf];

    // Create compressor
    this.nodes.compressor = this.audioContext.createDynamicsCompressor();
    this.nodes.compressor.threshold.value = -24;
    this.nodes.compressor.knee.value = 30;
    this.nodes.compressor.ratio.value = 12;
    this.nodes.compressor.attack.value = 0.003;
    this.nodes.compressor.release.value = 0.25;

    // Create output gain
    this.nodes.output = this.audioContext.createGain();
    this.nodes.output.gain.value = 1.0;

    // Connect basic chain: source -> EQ -> compressor -> output -> analyser -> destination
    this.source.connect(lowShelf);
    lowShelf.connect(peaking1);
    peaking1.connect(peaking2);
    peaking2.connect(highShelf);
    highShelf.connect(this.nodes.compressor);
    this.nodes.compressor.connect(this.nodes.output);
    this.nodes.output.connect(this.analyser);
    this.analyser.connect(this.destination);
  }

  // Clear all effect nodes
  clearNodes() {
    if (this.nodes.eq) {
      this.nodes.eq.forEach(node => {
        try {
          node.disconnect();
        } catch (e) {}
      });
    }
    if (this.nodes.compressor) {
      try {
        this.nodes.compressor.disconnect();
      } catch (e) {}
    }
    if (this.nodes.distortion) {
      try {
        this.nodes.distortion.disconnect();
      } catch (e) {}
    }
    if (this.nodes.output) {
      try {
        this.nodes.output.disconnect();
      } catch (e) {}
    }
  }

  // Apply a preset
  applyPreset(presetKey) {
    if (!this.presets[presetKey]) {
      console.warn(`[VoiceEffects] Unknown preset: ${presetKey}`);
      return false;
    }

    console.log(`[VoiceEffects] Applying preset: ${presetKey}`);
    
    // Reset effects first
    this.resetEffects();

    const settings = this.presets[presetKey].settings;
    if (!settings) {
      this.currentPreset = presetKey;
      return true;
    }

    // Apply settings
    if (this.nodes.eq.length >= 4) {
      // Highpass simulation using highShelf
      if (settings.highpass) {
        this.nodes.eq[3].frequency.value = settings.highpass;
        this.nodes.eq[3].gain.value = -12;
      }
      // Lowpass simulation using lowShelf
      if (settings.lowpass) {
        this.nodes.eq[0].frequency.value = settings.lowpass;
        this.nodes.eq[0].gain.value = -12;
      }
      // Formant shift using peaking filters
      if (settings.formant) {
        this.nodes.eq[1].frequency.value = 1000 * settings.formant;
        this.nodes.eq[2].frequency.value = 4000 * settings.formant;
      }
    }

    // Apply compression
    if (settings.compression && this.nodes.compressor) {
      this.nodes.compressor.ratio.value = settings.compression * 20;
    }

    this.currentPreset = presetKey;
    return true;
  }

  // Reset all effects to default
  resetEffects() {
    if (this.nodes.eq.length >= 4) {
      this.nodes.eq[0].frequency.value = 320;
      this.nodes.eq[0].gain.value = 0;
      this.nodes.eq[1].frequency.value = 1000;
      this.nodes.eq[1].gain.value = 0;
      this.nodes.eq[2].frequency.value = 4000;
      this.nodes.eq[2].gain.value = 0;
      this.nodes.eq[3].frequency.value = 8000;
      this.nodes.eq[3].gain.value = 0;
    }
    if (this.nodes.compressor) {
      this.nodes.compressor.threshold.value = -24;
      this.nodes.compressor.ratio.value = 12;
    }
    if (this.nodes.output) {
      this.nodes.output.gain.value = 1.0;
    }
  }

  // Start visualization loop
  startVisualization() {
    const update = () => {
      if (!this.isProcessing || !this.analyser) return;
      
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);
      
      if (this.onVisualizerUpdate) {
        this.onVisualizerUpdate(dataArray);
      }
      
      requestAnimationFrame(update);
    };
    update();
  }

  // Stop processing
  stop() {
    this.isProcessing = false;
    this.clearNodes();
    
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.suspend().catch(() => {});
    }
    
    console.log('[VoiceEffects] Stopped processing');
  }

  // Get current preset
  getCurrentPreset() {
    return {
      key: this.currentPreset,
      ...this.presets[this.currentPreset]
    };
  }

  // Get all presets
  getPresets() {
    return Object.keys(this.presets).map(key => ({
      key,
      ...this.presets[key]
    }));
  }

  // Set RNNoise enabled
  setRNNoiseEnabled(enabled) {
    this.rnnoise.enabled = enabled;
    console.log(`[VoiceEffects] RNNoise ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Check if RNNoise is enabled
  isRNNoiseEnabled() {
    return this.rnnoise.enabled;
  }

  // Initialize presets dictionary
  initializePresets() {
    return {
      none: { name: 'Normal', description: 'No effects applied', settings: {} },
      robot: { name: 'Robot', description: 'Mechanical vocoder effect', settings: { pitch: 1, formant: 0.5, distortion: 0.3, bitcrush: true } },
      radio: { name: 'Radio', description: 'AM/FM radio simulation', settings: { highpass: 800, lowpass: 3500, compression: 0.8, noise: 0.1 } },
      cave: { name: 'Cave', description: 'Deep reverb and echo', settings: { reverb: 0.8, delay: 0.4, lowpass: 800, bassBoost: 1.5 } },
      helium: { name: 'Helium', description: 'High pitch chipmunk voice', settings: { pitch: 1.8, formant: 1.5, speed: 1.2 } },
      monster: { name: 'Monster', description: 'Deep growling voice', settings: { pitch: 0.6, formant: 0.4, distortion: 0.5, lowpass: 400 } },
      telephone: { name: 'Telephone', description: 'Classic phone quality', settings: { highpass: 400, lowpass: 3400, bitcrush: true, compression: 0.9 } },
      megaphone: { name: 'Megaphone', description: 'Loud distorted announcement', settings: { highpass: 200, lowpass: 4000, distortion: 0.6, compression: 0.7 } },
      underwater: { name: 'Underwater', description: 'Muffled submerged effect', settings: { lowpass: 600, reverb: 0.6, phaser: true } },
      stadium: { name: 'Stadium', description: 'Large arena echo', settings: { reverb: 0.95, delay: 0.1, width: 1.0 } },
      small_room: { name: 'Small Room', description: 'Tight intimate space', settings: { reverb: 0.3, earlyReflections: 0.5 } },
      concert_hall: { name: 'Concert Hall', description: 'Grand hall acoustics', settings: { reverb: 0.85, preDelay: 40, decay: 2.5 } },
      whisper: { name: 'Whisper', description: 'Soft breathy voice', settings: { compression: 0.95, gain: 2, highpass: 200, noiseGate: 0.1 } },
      demon: { name: 'Demon', description: 'Scary evil voice', settings: { pitch: 0.7, pitchShift2: 0.5, distortion: 0.6, chorus: true } },
      alien: { name: 'Alien', description: 'Sci-fi alien voice', settings: { pitch: 1.2, ringMod: 0.3, phaser: 0.5 } },
      baby: { name: 'Baby', description: 'Cute high pitch voice', settings: { pitch: 1.6, formant: 1.3, compression: 0.8 } },
      giant: { name: 'Giant', description: 'Massive booming voice', settings: { pitch: 0.3, formant: 0.5, reverb: 0.5, delay: 0.2 } },
      echo: { name: 'Echo', description: 'Long repeating echo', settings: { delay: 0.5, feedback: 0.6, mix: 0.4 } },
      reverb_only: { name: 'Reverb', description: 'Pure reverb effect', settings: { reverb: 0.8, preDelay: 20, decay: 1.5 } },
      autotune: { name: 'Autotune', description: 'Pitch corrected voice', settings: { autotune: true, speed: 0.1, correction: 1.0 } },
      harmonizer: { name: 'Harmonizer', description: 'Multi-voice harmony', settings: { harmony: [0, 4, 7], mix: 0.5, detune: 3 } }
    };
  }
}

// Create singleton instance
const voiceEffects = new VoiceEffectsProcessor();

// Export
export default voiceEffects;
export { VoiceEffectsProcessor };
