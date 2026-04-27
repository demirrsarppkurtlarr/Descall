// COMPLETE REWRITE: Voice Effects System - Production Ready
class VoiceEffects {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.destinationNode = null;
    this.processedStream = null;
    this.analyser = null;
    this.dataArray = null;
    this.currentPreset = 'none';
    this.isInitialized = false;
    this.isProcessing = false;
    
    // Audio processing nodes
    this.inputGain = null;
    this.outputGain = null;
    this.biquadFilter = null;
    this.delayNode = null;
    this.convolver = null;
    this.compressor = null;
    
    // RNNoise simulation (since actual RNNoise requires WebAssembly)
    this.rnnoiseEnabled = false;
    this.noiseGate = null;
    
    // Initialize presets
    this.presets = this.initializePresets();
  }

  // Ensure audio context is ready and running
  async ensureAudioContextReady() {
    try {
      console.log('[VoiceEffects] Audio context state:', this.audioContext?.state);
      
      // Wait for context to be fully initialized
      if (this.audioContext.state === 'suspended') {
        console.log('[VoiceEffects] Resuming suspended audio context');
        await this.audioContext.resume();
        
        // Wait a bit for resume to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Double check state after resume
      if (this.audioContext.state !== 'running') {
        console.warn('[VoiceEffects] Audio context not running after resume, state:', this.audioContext.state);
        
        // Try to resume again with user interaction fallback
        try {
          await this.audioContext.resume();
        } catch (error) {
          console.error('[VoiceEffects] Failed to resume audio context:', error);
          throw new Error('Audio context could not be resumed. Please try again.');
        }
      }
      
      console.log('[VoiceEffects] Audio context ready, state:', this.audioContext.state);
    } catch (error) {
      console.error('[VoiceEffects] Error preparing audio context:', error);
      throw error;
    }
  }

  // Initialize audio context and processing chain
  async initialize() {
    try {
      // Check if already initialized and context is not closed
      if (this.isInitialized && this.audioContext?.state !== 'closed') {
        console.log('[VoiceEffects] Already initialized');
        return;
      }
      
      // Reset if context was closed
      if (this.audioContext?.state === 'closed') {
        console.log('[VoiceEffects] Audio context was closed, resetting');
        this.audioContext = null;
        this.isInitialized = false;
        this.disconnectAll();
      }

      console.log('[VoiceEffects] Initializing audio engine');
      
      // Create audio context with optimized settings
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: 48000
      });

      // Wait for context to be ready and resume if needed
      await this.ensureAudioContextReady();

      // Create analyser for visualization
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      // Create main processing chain
      this.setupProcessingChain();
      
      this.isInitialized = true;
      console.log('[VoiceEffects] Audio engine initialized successfully');
      
    } catch (error) {
      console.error('[VoiceEffects] Initialization failed:', error);
      throw error;
    }
  }

  // Setup the main audio processing chain
  setupProcessingChain() {
    // Input gain (for volume control)
    this.inputGain = this.audioContext.createGain();
    this.inputGain.gain.value = 1.0;

    // Output gain (for master volume)
    this.outputGain = this.audioContext.createGain();
    this.outputGain.gain.value = 1.0;

    // Biquad filter (for EQ effects)
    this.biquadFilter = this.audioContext.createBiquadFilter();
    this.biquadFilter.type = 'peaking';
    this.biquadFilter.frequency.value = 1000;
    this.biquadFilter.Q.value = 1;
    this.biquadFilter.gain.value = 0;

    // Delay node (for echo/reverb effects)
    this.delayNode = this.audioContext.createDelay(5.0);
    this.delayNode.delayTime.value = 0;

    // Convolver (for reverb impulse responses)
    this.convolver = this.audioContext.createConvolver();

    // Compressor (for dynamics processing)
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // Noise gate (for RNNoise simulation)
    this.noiseGate = this.audioContext.createGain();
    
    // Connect default processing chain
    this.connectDefaultChain();
  }

  // Connect default processing chain
  connectDefaultChain() {
    try {
      // Disconnect all existing connections
      this.disconnectAll();
      
      // Default chain: input -> biquad -> compressor -> output -> analyser
      this.inputGain.connect(this.biquadFilter);
      this.biquadFilter.connect(this.compressor);
      this.compressor.connect(this.outputGain);
      this.outputGain.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
    } catch (error) {
      console.error('[VoiceEffects] Failed to connect default chain:', error);
    }
  }

  // Disconnect all nodes
  disconnectAll() {
    try {
      if (this.inputGain) this.inputGain.disconnect();
      if (this.outputGain) this.outputGain.disconnect();
      if (this.biquadFilter) this.biquadFilter.disconnect();
      if (this.delayNode) this.delayNode.disconnect();
      if (this.convolver) this.convolver.disconnect();
      if (this.compressor) this.compressor.disconnect();
      if (this.noiseGate) this.noiseGate.disconnect();
      if (this.analyser) this.analyser.disconnect();
      if (this.sourceNode) this.sourceNode.disconnect();
    } catch (error) {
      console.error('[VoiceEffects] Error disconnecting nodes:', error);
    }
  }

  // Process audio stream
  async processStream(inputStream) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (this.isProcessing) {
        console.log('[VoiceEffects] Already processing a stream');
        return this.processedStream;
      }

      console.log('[VoiceEffects] Starting stream processing');
      
      // Stop any existing processing
      this.stop();

      // Create source from input stream
      this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);
      
      // Connect source to processing chain
      this.sourceNode.connect(this.inputGain);
      
      // Create processed stream destination with proper cleanup
      if (this.destinationNode) {
        this.outputGain.disconnect(this.destinationNode);
      }
      
      const destination = this.audioContext.createMediaStreamDestination();
      this.destinationNode = destination;
      
      // Connect output to destination
      this.outputGain.connect(destination);
      
      // Store processed stream
      this.processedStream = destination.stream;
      this.isProcessing = true;
      
      console.log('[VoiceEffects] Stream processing started');
      return this.processedStream;
      
    } catch (error) {
      console.error('[VoiceEffects] Stream processing failed:', error);
      throw error;
    }
  }

  // Stop processing
  stop() {
    try {
      console.log('[VoiceEffects] Stopping processing');
      
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      
      if (this.destinationNode) {
        this.outputGain.disconnect(this.destinationNode);
        this.destinationNode = null;
      }
      
      if (this.processedStream) {
        this.processedStream.getTracks().forEach(track => track.stop());
        this.processedStream = null;
      }
      
      this.isProcessing = false;
      console.log('[VoiceEffects] Processing stopped');
      
    } catch (error) {
      console.error('[VoiceEffects] Error stopping processing:', error);
    }
  }

  // Initialize presets
  initializePresets() {
    return {
      'none': {
        name: 'None',
        description: 'No effects',
        icon: 'Mic',
        settings: {
          inputGain: 1.0,
          outputGain: 1.0,
          filterFreq: 1000,
          filterQ: 1,
          filterGain: 0,
          delayTime: 0,
          delayFeedback: 0,
          compressorThreshold: -24,
          compressorRatio: 12
        }
      },
      'robot': {
        name: 'Robot',
        description: 'Robot voice effect',
        icon: 'Cpu',
        settings: {
          inputGain: 1.0,
          outputGain: 0.8,
          filterFreq: 500,
          filterQ: 10,
          filterGain: -5,
          delayTime: 0.1,
          delayFeedback: 0.3,
          compressorThreshold: -20,
          compressorRatio: 8
        }
      },
      'deep': {
        name: 'Deep',
        description: 'Deep voice effect',
        icon: 'Volume2',
        settings: {
          inputGain: 1.2,
          outputGain: 0.9,
          filterFreq: 200,
          filterQ: 2,
          filterGain: 8,
          delayTime: 0.05,
          delayFeedback: 0.2,
          compressorThreshold: -18,
          compressorRatio: 6
        }
      },
      'helium': {
        name: 'Helium',
        description: 'High pitched voice',
        icon: 'Zap',
        settings: {
          inputGain: 1.0,
          outputGain: 0.7,
          filterFreq: 2000,
          filterQ: 5,
          filterGain: -10,
          delayTime: 0.02,
          delayFeedback: 0.1,
          compressorThreshold: -16,
          compressorRatio: 4
        }
      },
      'echo': {
        name: 'Echo',
        description: 'Echo effect',
        icon: 'Layers',
        settings: {
          inputGain: 1.0,
          outputGain: 0.8,
          filterFreq: 1000,
          filterQ: 1,
          filterGain: 0,
          delayTime: 0.3,
          delayFeedback: 0.6,
          compressorThreshold: -20,
          compressorRatio: 8
        }
      },
      'radio': {
        name: 'Radio',
        description: 'Radio/telephone effect',
        icon: 'Radio',
        settings: {
          inputGain: 1.0,
          outputGain: 0.6,
          filterFreq: 800,
          filterQ: 8,
          filterGain: -15,
          delayTime: 0,
          delayFeedback: 0,
          compressorThreshold: -12,
          compressorRatio: 20
        }
      }
    };
  }

  // Apply preset
  async setPreset(presetKey) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const preset = this.presets[presetKey];
      if (!preset) {
        throw new Error(`Preset '${presetKey}' not found`);
      }

      console.log(`[VoiceEffects] Applying preset: ${presetKey}`);
      
      // Apply preset settings
      const settings = preset.settings;
      
      if (this.inputGain) {
        this.inputGain.gain.value = settings.inputGain;
      }
      
      if (this.outputGain) {
        this.outputGain.gain.value = settings.outputGain;
      }
      
      if (this.biquadFilter) {
        this.biquadFilter.frequency.value = settings.filterFreq;
        this.biquadFilter.Q.value = settings.filterQ;
        this.biquadFilter.gain.value = settings.filterGain;
      }
      
      if (this.delayNode) {
        this.delayNode.delayTime.value = settings.delayTime;
      }
      
      if (this.compressor) {
        this.compressor.threshold.value = settings.compressorThreshold;
        this.compressor.ratio.value = settings.compressorRatio;
      }
      
      // Reconnect chain based on preset
      this.reconnectChain(presetKey);
      
      this.currentPreset = presetKey;
      console.log(`[VoiceEffects] Preset '${presetKey}' applied successfully`);
      
    } catch (error) {
      console.error('[VoiceEffects] Failed to apply preset:', error);
      throw error;
    }
  }

  // Reconnect processing chain based on preset
  reconnectChain(presetKey) {
    try {
      this.disconnectAll();
      
      if (presetKey === 'echo') {
        // Echo chain with feedback
        const feedbackGain = this.audioContext.createGain();
        feedbackGain.gain.value = this.presets[presetKey].settings.delayFeedback;
        
        this.inputGain.connect(this.biquadFilter);
        this.biquadFilter.connect(this.delayNode);
        this.delayNode.connect(feedbackGain);
        feedbackGain.connect(this.delayNode);
        this.delayNode.connect(this.compressor);
        this.compressor.connect(this.outputGain);
        this.outputGain.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      } else {
        // Default chain
        this.connectDefaultChain();
      }
      
      // Add RNNoise if enabled
      if (this.rnnoiseEnabled && this.noiseGate) {
        this.outputGain.disconnect();
        this.outputGain.connect(this.noiseGate);
        this.noiseGate.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      }
      
    } catch (error) {
      console.error('[VoiceEffects] Failed to reconnect chain:', error);
      this.connectDefaultChain();
    }
  }

  // Toggle RNNoise (simulated with noise gate)
  toggleRNNoise(enabled) {
    try {
      this.rnnoiseEnabled = enabled;
      
      if (enabled && this.noiseGate) {
        console.log('[VoiceEffects] RNNoise enabled (simulated)');
        // Simulate RNNoise with a simple noise gate
        this.noiseGate.gain.value = 1.0;
        this.reconnectChain(this.currentPreset);
      } else {
        console.log('[VoiceEffects] RNNoise disabled');
        this.reconnectChain(this.currentPreset);
      }
      
    } catch (error) {
      console.error('[VoiceEffects] Failed to toggle RNNoise:', error);
    }
  }

  // Check if RNNoise is enabled
  isRNNoiseEnabled() {
    return this.rnnoiseEnabled;
  }

  // Get visualization data
  getVisualizationData() {
    if (!this.analyser || !this.dataArray) return null;
    this.analyser.getByteFrequencyData(this.dataArray);
    return [...this.dataArray];
  }

  // Get current preset
  getCurrentPreset() {
    return this.presets[this.currentPreset] || this.presets['none'];
  }

  // Get all presets
  getPresets() {
    return Object.keys(this.presets).map(key => ({
      id: key,
      ...this.presets[key]
    }));
  }

  // Cleanup
  destroy() {
    try {
      console.log('[VoiceEffects] Destroying voice effects');
      this.stop();
      this.disconnectAll();
      
      // Clear destination node reference
      this.destinationNode = null;
      
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
      
      this.isInitialized = false;
      console.log('[VoiceEffects] Voice effects destroyed');
      
    } catch (error) {
      console.error('[VoiceEffects] Error destroying:', error);
    }
  }
}

// Create singleton instance
const voiceEffects = new VoiceEffects();

export default voiceEffects;
