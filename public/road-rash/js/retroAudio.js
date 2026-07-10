class RetroAudioEngine {
    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.engineBuffer = null;
        this.engineSource = null;
        this.engineGain = null;
        this.windSource = null;
        this.windGain = null;
        
        // Tuning Parameters
        this.topSpeed = (200 / (1/60)) * 1.2; // maxSpeed from script.js
        this.numGears = 5;
        this.shiftThreshold = 0.95; // shift up at 95% of max gear speed
        this.pitchRange = { min: 0.8, max: 1.8 };
        this.pitchResponseSpeed = 8;
        this.volumeResponseSpeed = 6;
        this.shiftPitchDrop = 0.75;
        this.idleVolume = 0.25;
        this.maxEngineVolume = 0.45;
        this.quantizePitch = true; // Use retro quantization
        this.pitchSteps = 24;
        
        // State
        this.currentGear = 1;
        this.enginePitch = 1.0;
        this.engineVolume = 0.0;
        this.shiftCooldown = 0;
        
        this.initialized = false;
        
        // Noise buffer for wind (synthesized)
        this.noiseBuffer = this.createWhiteNoise();
    }
    
    createWhiteNoise() {
        var bufferSize = this.audioCtx.sampleRate * 2; 
        var buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        var output = buffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    async init() {
        if (this.initialized) return;
        
        try {
            const response = await fetch("sfx/accelerate-sound.wav");
            const arrayBuffer = await response.arrayBuffer();
            this.engineBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            
            // Engine Node
            this.engineSource = this.audioCtx.createBufferSource();
            this.engineSource.buffer = this.engineBuffer;
            this.engineSource.loop = true;
            
            this.engineFilter1 = this.audioCtx.createBiquadFilter();
            this.engineFilter1.type = 'lowpass';
            this.engineFilter1.frequency.value = 250; // Cut all mids and treble
            
            this.engineFilter2 = this.audioCtx.createBiquadFilter();
            this.engineFilter2.type = 'lowpass';
            this.engineFilter2.frequency.value = 250; // Second pass to make slope 24dB/octave (extremely muffled)
            
            this.engineGain = this.audioCtx.createGain();
            this.engineGain.gain.value = 0;
            
            this.engineSource.connect(this.engineFilter1);
            this.engineFilter1.connect(this.engineFilter2);
            this.engineFilter2.connect(this.engineGain);
            this.engineGain.connect(this.audioCtx.destination);
            
            this.engineSource.start();
            
            // Wind Node
            this.windSource = this.audioCtx.createBufferSource();
            this.windSource.buffer = this.noiseBuffer;
            this.windSource.loop = true;
            
            // Lowpass filter for wind
            this.windFilter = this.audioCtx.createBiquadFilter();
            this.windFilter.type = 'lowpass';
            this.windFilter.frequency.value = 400; // Muffled wind
            
            this.windGain = this.audioCtx.createGain();
            this.windGain.gain.value = 0;
            
            this.windSource.connect(this.windFilter);
            this.windFilter.connect(this.windGain);
            this.windGain.connect(this.audioCtx.destination);
            
            this.windSource.start();
            
            this.initialized = true;
        } catch (e) {
            console.error("Failed to load retro audio engine:", e);
        }
    }
    
    resume() {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }
    
    update(dt, currentSpeed, previousSpeed, throttle, isAirborne, isCrashing) {
        if (!this.initialized) return;
        
        if (this.shiftCooldown > 0) this.shiftCooldown -= dt;
        
        let normalizedSpeed = Math.max(0, Math.min(1, currentSpeed / this.topSpeed));
        
        // Calculate Gear
        let speedPerGear = this.topSpeed / this.numGears;
        let targetGear = Math.floor(currentSpeed / speedPerGear) + 1;
        targetGear = Math.max(1, Math.min(this.numGears, targetGear));
        
        // Calculate RPM based on progress through current gear speed band
        let gearMinSpeed = (this.currentGear - 1) * speedPerGear;
        let gearMaxSpeed = this.currentGear * speedPerGear;
        let gearProgress = (currentSpeed - gearMinSpeed) / (gearMaxSpeed - gearMinSpeed);
        
        // Clamp and handle shifting
        let normalizedRPM = Math.max(0, Math.min(1, gearProgress));
        
        if (normalizedRPM >= this.shiftThreshold && this.currentGear < this.numGears && this.shiftCooldown <= 0) {
            this.currentGear++;
            this.enginePitch *= this.shiftPitchDrop; // Sudden drop
            this.shiftCooldown = 0.3; // 300ms cooldown
        } else if (normalizedRPM <= 0.1 && this.currentGear > 1 && this.shiftCooldown <= 0) {
            this.currentGear--;
            this.enginePitch /= this.shiftPitchDrop; // Sudden spike when downshifting
            this.shiftCooldown = 0.3;
        }
        
        // Airborne modification
        if (isAirborne) {
            // Engine revs freely in the air
            normalizedRPM = 1.0; 
        }
        
        // Calculate Target Pitch
        let targetPitch = 0.4 + (this.pitchRange.max - this.pitchRange.min) * normalizedRPM;
        
        // Redline flutter (Rev limiter)
        if (normalizedRPM > 0.98 && throttle > 0) {
            const now = this.audioCtx.currentTime;
            // Sawtooth pattern: Instant pitch drop, then climbs back up to max every 120ms
            const limiter = (now % 0.12) / 0.12; 
            targetPitch -= (1.0 - limiter) * 0.25; 
        }
        
        if (throttle === 0 && !isAirborne) {
            // Coasting lowers pitch slightly
            targetPitch *= 0.9;
        }
        
        if (currentSpeed < 10 && throttle === 0) {
            targetPitch = 0.25; // Extremely low pitch for a deep, heavy idle drone
        }
        
        // Dynamic Response Speed for Idle Fade
        let currentPitchResponse = this.pitchResponseSpeed;
        if (throttle === 0) {
            currentPitchResponse = 8.0; // Fast deceleration when letting off the throttle!
        } else if (this.enginePitch < 0.75 && targetPitch > this.enginePitch) {
            currentPitchResponse = 1.5; // Very slow rev up from idle!
        }
        
        // Smooth Pitch
        this.enginePitch += (targetPitch - this.enginePitch) * (currentPitchResponse * dt);
        
        // Apply Quantization for Retro Effect
        let finalPitch = this.enginePitch;
        
        // Add dynamic idle LFO and revving effect when sitting still
        if (currentSpeed < 10 && throttle === 0 && !isCrashing) {
            const now = this.audioCtx.currentTime;
            // Subtle idle put-put oscillation
            const idleLfo = Math.sin(now * 15) * 0.015;
            // Removed slow revving cycle to keep it monotone
            const slowRev = 0;
            finalPitch += idleLfo + slowRev;
            // Ensure it doesn't drop too low
            if (finalPitch < 0.2) finalPitch = 0.2;
        }
        
        if (this.quantizePitch) {
            finalPitch = Math.round(finalPitch * this.pitchSteps) / this.pitchSteps;
        }
        
        // Calculate Target Volume
        let targetVolume = this.idleVolume;
        if (throttle > 0) {
            targetVolume = this.idleVolume + (this.maxEngineVolume - this.idleVolume) * throttle;
        }
        if (isCrashing) {
            targetVolume = 0;
        }
        
        // Smooth Volume
        this.engineVolume += (targetVolume - this.engineVolume) * (this.volumeResponseSpeed * dt);
        
        // Wind Noise (Disabled based on feedback)
        let windTargetVolume = 0; // normalizedSpeed * 0.3;
        // if (isAirborne) windTargetVolume *= 1.5; // Louder wind in air
        // if (isCrashing) windTargetVolume = 0;
        
        this.windGain.gain.value += (windTargetVolume - this.windGain.gain.value) * (this.volumeResponseSpeed * dt);
        this.windFilter.frequency.value = 400 + (800 * normalizedSpeed);
        
        // Apply to Audio Nodes
        const time = this.audioCtx.currentTime + 0.05;
        this.engineSource.playbackRate.setTargetAtTime(finalPitch, time, 0.05);
        this.engineGain.gain.setTargetAtTime(this.engineVolume, time, 0.05);
    }
}

window.retroAudioEngine = new RetroAudioEngine();
