/**
 * WARFRONT: EXODUS - Audio System
 * Audio espacial 3D, mezcla dinámica, efectos de sonido procedural
 */

class AudioSystem {
    constructor(engine) {
        this.engine = engine;
        this.context = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.voiceGain = null;
        
        // Buffers de audio
        this.buffers = new Map();
        this.activeSources = [];
        
        // Posición del listener (jugador)
        this.listener = null;
        
        // Configuración
        this.settings = {
            masterVolume: 1.0,
            sfxVolume: 0.8,
            musicVolume: 0.5,
            voiceVolume: 1.0,
            spatialAudio: true,
            maxDistance: 100
        };
        
        // Sonidos recientes para IA
        this.recentSounds = [];
        
        this.init();
    }

    async init() {
        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            
            // Nodo maestro
            this.masterGain = this.context.createGain();
            this.masterGain.gain.value = this.settings.masterVolume;
            this.masterGain.connect(this.context.destination);
            
            // Submezclas
            this.sfxGain = this.context.createGain();
            this.sfxGain.gain.value = this.settings.sfxVolume;
            this.sfxGain.connect(this.masterGain);
            
            this.musicGain = this.context.createGain();
            this.musicGain.gain.value = this.settings.musicVolume;
            this.musicGain.connect(this.masterGain);
            
            this.voiceGain = this.context.createGain();
            this.voiceGain.gain.value = this.settings.voiceVolume;
            this.voiceGain.connect(this.masterGain);
            
            // Listener 3D
            this.listener = this.context.listener;
            
            console.log('Sistema de audio inicializado');
            
        } catch (error) {
            console.warn('Web Audio API no disponible:', error);
        }
    }

    // Cargar sonido desde URL o generar proceduralmente
    async loadSound(name, url = null) {
        if (this.buffers.has(name)) return this.buffers.get(name);
        
        try {
            let buffer;
            
            if (url) {
                // Cargar desde archivo
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                buffer = await this.context.decodeAudioData(arrayBuffer);
            } else {
                // Generar sonido procedural
                buffer = this.generateProceduralSound(name);
            }
            
            this.buffers.set(name, buffer);
            return buffer;
            
        } catch (error) {
            console.error(`Error cargando sonido ${name}:`, error);
            return null;
        }
    }

    generateProceduralSound(type) {
        const sampleRate = this.context.sampleRate;
        const duration = this.getSoundDuration(type);
        const buffer = this.context.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        switch(type) {
            case 'rifle_fire':
                return this.generateGunshot(data, sampleRate, 0.1, 800);
            case 'sniper_fire':
                return this.generateGunshot(data, sampleRate, 0.2, 400);
            case 'explosion':
                return this.generateExplosion(data, sampleRate);
            case 'footstep':
                return this.generateFootstep(data, sampleRate);
            case 'reload':
                return this.generateReload(data, sampleRate);
            case 'empty_click':
                return this.generateClick(data, sampleRate);
            default:
                // Ruido blanco por defecto
                for (let i = 0; i < data.length; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
        }
        
        return buffer;
    }

    generateGunshot(data, sampleRate, duration, frequency) {
        const samples = data.length;
        
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            
            // Decaimiento exponencial
            const envelope = Math.exp(-t / duration);
            
            // Ruido + tono
            const noise = Math.random() * 2 - 1;
            const tone = Math.sin(2 * Math.PI * frequency * t) * envelope;
            
            // Filtro paso bajo simple
            data[i] = (noise * 0.7 + tone * 0.3) * envelope;
        }
        
        return { duration: samples / sampleRate };
    }

    generateExplosion(data, sampleRate) {
        const samples = data.length;
        let lastOut = 0;
        
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t / 0.5);
            
            // Ruido rosa (aproximado)
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + (0.02 * white)) / 1.02;
            
            data[i] = lastOut * envelope * 3;
        }
        
        return { duration: samples / sampleRate };
    }

    generateFootstep(data, sampleRate) {
        const samples = Math.floor(sampleRate * 0.1);
        
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t / 0.05);
            const noise = (Math.random() * 2 - 1) * 0.3;
            data[i] = noise * envelope;
        }
        
        return { duration: samples / sampleRate };
    }

    generateReload(data, sampleRate) {
        // Sonido metálico de recarga
        const samples = Math.floor(sampleRate * 0.3);
        
        for (let i = 0; i < samples; i++) {
            const t = i / sampleRate;
            // Clics metálicos
            const click = (Math.sin(2 * Math.PI * 2000 * t) * Math.exp(-((t % 0.1) * 50)));
            data[i] = click * 0.5;
        }
        
        return { duration: samples / sampleRate };
    }

    generateClick(data, sampleRate) {
        const samples = Math.floor(sampleRate * 0.05);
        
        for (let i = 0; i < samples; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.01));
        }
        
        return { duration: samples / sampleRate };
    }

    getSoundDuration(type) {
        const durations = {
            'rifle_fire': 0.1,
            'sniper_fire': 0.2,
            'explosion': 0.5,
            'footstep': 0.1,
            'reload': 0.3,
            'empty_click': 0.05
        };
        return durations[type] || 0.1;
    }

    // Reproducir sonido 3D posicional
    play(soundName, options = {}) {
        if (!this.context) return null;
        
        const buffer = this.buffers.get(soundName);
        if (!buffer) {
            console.warn(`Sonido no encontrado: ${soundName}`);
            return null;
        }
        
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        
        // Ganancia para este sonido
        const gainNode = this.context.createGain();
        gainNode.gain.value = options.volume || 1.0;
        
        // Panning 3D
        if (this.settings.spatialAudio && options.position) {
            const panner = this.createPanner(options.position);
            source.connect(panner);
            panner.connect(gainNode);
        } else {
            source.connect(gainNode);
        }
        
        // Conectar a mezcla correcta
        const destination = options.type === 'music' ? this.musicGain :
                           options.type === 'voice' ? this.voiceGain :
                           this.sfxGain;
        
        gainNode.connect(destination);
        
        // Reproducir
        source.start(0);
        
        // Registrar para limpieza
        const soundId = Date.now() + Math.random();
        this.activeSources.push({ id: soundId, source, gainNode });
        
        source.onended = () => {
            this.activeSources = this.activeSources.filter(s => s.id !== soundId);
        };
        
        // Registrar para IA
        if (options.registerSound !== false) {
            this.recentSounds.push({
                type: soundName,
                position: options.position,
                team: options.team,
                timestamp: Date.now()
            });
        }
        
        return soundId;
    }

    createPanner(position) {
        const panner = this.context.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = this.settings.maxDistance;
        panner.rolloffFactor = 1;
        
        panner.positionX.value = position.x;
        panner.positionY.value = position.y;
        panner.positionZ.value = position.z;
        
        return panner;
    }

    // Actualizar posición del listener (jugador)
    updateListener(position, forward, up) {
        if (!this.listener || !this.context) return;
        
        this.listener.positionX.value = position.x;
        this.listener.positionY.value = position.y;
        this.listener.positionZ.value = position.z;
        
        this.listener.forwardX.value = forward.x;
        this.listener.forwardY.value = forward.y;
        this.listener.forwardZ.value = forward.z;
        
        this.listener.upX.value = up.x;
        this.listener.upY.value = up.y;
        this.listener.upZ.value = up.z;
    }

    // Obtener sonidos recientes para IA
    getRecentSounds(range, position, timeWindow = 1000) {
        const now = Date.now();
        return this.recentSounds.filter(sound => {
            const timeDiff = now - sound.timestamp;
            if (timeDiff > timeWindow) return false;
            
            if (position && sound.position) {
                const dist = Math.sqrt(
                    Math.pow(sound.position.x - position.x, 2) +
                    Math.pow(sound.position.y - position.y, 2) +
                    Math.pow(sound.position.z - position.z, 2)
                );
                return dist <= range;
            }
            
            return true;
        });
    }

    // Limpiar sonidos antiguos
    cleanup() {
        const now = Date.now();
        this.recentSounds = this.recentSounds.filter(s => now - s.timestamp < 5000);
    }

    // Control de volumen
    setMasterVolume(value) {
        this.settings.masterVolume = value;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(value, this.context.currentTime, 0.1);
        }
    }

    setSFXVolume(value) {
        this.settings.sfxVolume = value;
        if (this.sfxGain) {
            this.sfxGain.gain.setTargetAtTime(value, this.context.currentTime, 0.1);
        }
    }

    setMusicVolume(value) {
        this.settings.musicVolume = value;
        if (this.musicGain) {
            this.musicGain.gain.setTargetAtTime(value, this.context.currentTime, 0.1);
        }
    }

    // Pausar/Reanudar
    suspend() {
        this.context?.suspend();
    }

    resume() {
        this.context?.resume();
    }

    // Detener todos los sonidos
    stopAll() {
        this.activeSources.forEach(({ source }) => {
            try {
                source.stop();
            } catch (e) {}
        });
        this.activeSources = [];
    }
}

export default AudioSystem;