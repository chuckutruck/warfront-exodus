/**
 * Sistema de Red - Sincronización en Tiempo Real
 * Autoridad servidor con validación de clientes
 */

import { ref, set, onValue, push, onDisconnect, update, remove } from 'firebase/database';
import { rtdb } from './firebase-config';

class NetworkManager {
    constructor(engine) {
        this.engine = engine;
        this.isConnected = false;
        this.playerId = null;
        this.sessionId = null;
        this.isHost = false;
        
        // Estado de red
        this.latency = 0;
        this.lastPing = 0;
        this.packetLoss = 0;
        
        // Buffer de snapshots
        this.snapshotBuffer = [];
        this.serverTimeOffset = 0;
        
        // Callbacks
        this.callbacks = new Map();
        
        // Rate limiting
        this.updateRate = 20; // 20Hz
        this.lastUpdate = 0;
    }

    async connect(playerData) {
        try {
            // Generar ID único
            this.playerId = this.generateId();
            
            // Referencia del jugador
            const playerRef = ref(rtdb, `players/${this.playerId}`);
            
            // Datos iniciales
            await set(playerRef, {
                ...playerData,
                id: this.playerId,
                online: true,
                lastSeen: Date.now(),
                ping: 0
            });
            
            // Cleanup en desconexión
            onDisconnect(playerRef).update({
                online: false,
                lastSeen: Date.now()
            });
            
            // Escuchar jugadores
            this.listenToPlayers();
            
            // Escuchar sesiones
            this.listenToSessions();
            
            // Start ping loop
            this.startPingLoop();
            
            this.isConnected = true;
            return this.playerId;
            
        } catch (error) {
            console.error('Network connection failed:', error);
            throw error;
        }
    }

    generateId() {
        return 'p_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    async createSession(config) {
        this.isHost = true;
        this.sessionId = 's_' + Date.now();
        
        const sessionRef = ref(rtdb, `sessions/${this.sessionId}`);
        
        await set(sessionRef, {
            id: this.sessionId,
            host: this.playerId,
            created: Date.now(),
            status: 'waiting', // waiting, playing, ended
            config: config,
            players: {
                [this.playerId]: {
                    team: config.team || 'alpha',
                    ready: false,
                    score: 0,
                    kills: 0,
                    deaths: 0
                }
            },
            maxPlayers: config.maxPlayers || 8,
            gameMode: config.gameMode || 'team_deathmatch',
            map: config.map || 'valley'
        });
        
        // Escuchar cambios de la sesión
        this.listenToSession(this.sessionId);
        
        return this.sessionId;
    }

    async joinSession(sessionId) {
        this.sessionId = sessionId;
        
        const playerRef = ref(rtdb, `sessions/${sessionId}/players/${this.playerId}`);
        
        await set(playerRef, {
            team: 'bravo',
            ready: false,
            score: 0,
            kills: 0,
            deaths: 0,
            joined: Date.now()
        });
        
        this.listenToSession(sessionId);
    }

    async leaveSession() {
        if (!this.sessionId) return;
        
        const playerRef = ref(rtdb, `sessions/${this.sessionId}/players/${this.playerId}`);
        await remove(playerRef);
        
        if (this.isHost) {
            const sessionRef = ref(rtdb, `sessions/${this.sessionId}`);
            await remove(sessionRef);
        }
        
        this.sessionId = null;
        this.isHost = false;
    }

    listenToPlayers() {
        const playersRef = ref(rtdb, 'players');
        
        onValue(playersRef, (snapshot) => {
            const players = snapshot.val() || {};
            
            Object.keys(players).forEach(id => {
                if (id === this.playerId) return;
                
                const data = players[id];
                
                if (data.online) {
                    if (!this.engine.remotePlayers.has(id)) {
                        // Nuevo jugador
                        this.engine.addRemotePlayer(id, data);
                    } else {
                        // Actualizar snapshot
                        this.engine.remotePlayers.get(id).receiveSnapshot({
                            position: data.position,
                            rotation: data.rotation,
                            timestamp: data.lastSeen
                        });
                    }
                } else {
                    // Jugador desconectado
                    this.engine.removeRemotePlayer(id);
                }
            });
        });
    }

    listenToSession(sessionId) {
        const sessionRef = ref(rtdb, `sessions/${sessionId}`);
        
        onValue(sessionRef, (snapshot) => {
            const session = snapshot.val();
            if (!session) return;
            
            // Actualizar estado del juego
            this.handleSessionUpdate(session);
        });
    }

    handleSessionUpdate(session) {
        // Cambio de estado del juego
        if (session.status === 'playing' && this.engine.matchState !== 'playing') {
            this.engine.startMatch(session);
        }
        
        // Actualizar scores
        if (session.players) {
            Object.keys(session.players).forEach(id => {
                const player = this.engine.remotePlayers.get(id);
                if (player) {
                    player.score = session.players[id].score;
                    player.kills = session.players[id].kills;
                    player.deaths = session.players[id].deaths;
                }
            });
        }
        
        // Eventos del juego
        if (session.events) {
            this.processGameEvents(session.events);
        }
    }

    processGameEvents(events) {
        Object.values(events).forEach(event => {
            switch(event.type) {
                case 'kill':
                    this.engine.ui.showKillFeed(event);
                    break;
                case 'explosion':
                    this.engine.effects.createExplosion(event.position);
                    break;
                case 'match_end':
                    this.engine.endMatch(event.winner);
                    break;
            }
        });
    }

    send(type, data) {
        if (!this.isConnected) return;
        
        const now = Date.now();
        
        // Rate limiting
        if (type === 'playerUpdate' && now - this.lastUpdate < (1000 / this.updateRate)) {
            return;
        }
        
        const message = {
            type,
            data,
            timestamp: now,
            playerId: this.playerId
        };
        
        // Enviar a RTDB
        const updates = {};
        
        switch(type) {
            case 'playerUpdate':
                updates[`players/${this.playerId}/position`] = data.position;
                updates[`players/${this.playerId}/rotation`] = data.rotation;
                updates[`players/${this.playerId}/velocity`] = data.velocity;
                updates[`players/${this.playerId}/health`] = data.health;
                updates[`players/${this.playerId}/lastSeen`] = now;
                break;
                
            case 'fire':
                // Validar en servidor (Cloud Function)
                this.validateShot(data);
                break;
                
            case 'hit':
                // Validar daño
                this.validateDamage(data);
                break;
                
            case 'playerDeath':
                this.reportDeath(data);
                break;
        }
        
        if (Object.keys(updates).length > 0) {
            update(ref(rtdb), updates);
        }
        
        this.lastUpdate = now;
    }

    async validateShot(data) {
        // Llamar a Cloud Function para validar
        // const validateShot = httpsCallable(functions, 'validateShot');
        // await validateShot(data);
        
        // Por ahora: validación cliente básica
        const shotRef = push(ref(rtdb, `sessions/${this.sessionId}/shots`));
        await set(shotRef, {
            ...data,
            serverTimestamp: Date.now()
        });
    }

    async validateDamage(data) {
        // Verificar con servidor
        const damageRef = push(ref(rtdb, `sessions/${this.sessionId}/damage`));
        await set(damageRef, data);
    }

    async reportDeath(data) {
        const eventRef = push(ref(rtdb, `sessions/${this.sessionId}/events`));
        await set(eventRef, {
            type: 'kill',
            timestamp: Date.now(),
            ...data
        });
        
        // Actualizar stats
        const updates = {};
        updates[`sessions/${this.sessionId}/players/${data.victim}/deaths`] = 
            (this.engine.localPlayer.deaths || 0) + 1;
        
        if (data.killer) {
            updates[`sessions/${this.sessionId}/players/${data.killer}/kills`] = 
                (this.engine.remotePlayers.get(data.killer)?.kills || 0) + 1;
        }
        
        await update(ref(rtdb), updates);
    }

    startPingLoop() {
        setInterval(async () => {
            const pingRef = ref(rtdb, `.info/serverTimeOffset`);
            
            onValue(pingRef, (snapshot) => {
                this.serverTimeOffset = snapshot.val() || 0;
                this.latency = Date.now() - this.lastPing;
                this.lastPing = Date.now();
            }, { onlyOnce: true });
            
        }, 5000);
    }

    getServerTime() {
        return Date.now() + this.serverTimeOffset;
    }

    on(event, callback) {
        this.callbacks.set(event, callback);
    }

    disconnect() {
        this.isConnected = false;
        
        if (this.playerId) {
            const playerRef = ref(rtdb, `players/${this.playerId}`);
            set(playerRef, { online: false, lastSeen: Date.now() });
        }
    }
}

export default NetworkManager;