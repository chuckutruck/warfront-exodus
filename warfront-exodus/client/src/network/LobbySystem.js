/**
 * WARFRONT: EXODUS - Lobby System
 * Gestión de salas, escuadrones, chat previo a partida
 */

import { rtdb, auth } from '../firebase-config.js';
import { ref, onValue, set, push, update, remove, onDisconnect, get } from 'firebase/database';

class LobbySystem {
    constructor(networkManager) {
        this.network = networkManager;
        this.currentLobby = null;
        this.squad = null;
        this.chatMessages = [];
        
        // Callbacks UI
        this.onLobbyUpdate = null;
        this.onChatMessage = null;
        this.onSquadUpdate = null;
        this.onPlayerReady = null;
    }

    async createSquad(squadName, isPrivate = true) {
        const squadRef = push(ref(rtdb, 'squads'));
        const squadId = squadRef.key;
        
        const squadData = {
            name: squadName,
            createdAt: Date.now(),
            leader: auth.currentUser.uid,
            isPrivate: isPrivate,
            inviteCode: isPrivate ? this.generateInviteCode() : null,
            maxSize: 4,
            members: {
                [auth.currentUser.uid]: {
                    name: auth.currentUser.displayName || 'Líder',
                    role: 'leader',
                    ready: false,
                    joinedAt: Date.now()
                }
            },
            settings: {
                preferredMode: 'team_deathmatch',
                preferredMap: 'random',
                voiceChat: true
            }
        };
        
        await set(squadRef, squadData);
        this.squad = { id: squadId, ...squadData };
        
        this.setupSquadListeners(squadId);
        
        return { squadId, inviteCode: squadData.inviteCode };
    }

    async joinSquad(squadId, inviteCode = null) {
        const squadRef = ref(rtdb, `squads/${squadId}`);
        const snapshot = await get(squadRef);
        
        if (!snapshot.exists()) {
            throw new Error('Escuadrón no encontrado');
        }
        
        const squad = snapshot.val();
        
        if (squad.isPrivate && squad.inviteCode !== inviteCode) {
            throw new Error('Código de invitación inválido');
        }
        
        if (Object.keys(squad.members).length >= squad.maxSize) {
            throw new Error('Escuadrón completo');
        }
        
        // Añadir miembro
        await update(ref(rtdb, `squads/${squadId}/members`), {
            [auth.currentUser.uid]: {
                name: auth.currentUser.displayName || 'Soldado',
                role: 'member',
                ready: false,
                joinedAt: Date.now()
            }
        });
        
        this.squad = { id: squadId, ...squad };
        this.setupSquadListeners(squadId);
        
        return squadId;
    }

    setupSquadListeners(squadId) {
        const squadRef = ref(rtdb, `squads/${squadId}`);
        
        onValue(squadRef, (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                // Escuadrón disuelto
                this.squad = null;
                return;
            }
            
            this.squad = { id: squadId, ...data };
            
            if (this.onSquadUpdate) {
                this.onSquadUpdate(this.squad);
            }
        });
        
        // Chat del escuadrón
        const chatRef = ref(rtdb, `squads/${squadId}/chat`);
        onValue(chatRef, (snapshot) => {
            const messages = snapshot.val();
            if (messages) {
                Object.entries(messages).forEach(([id, msg]) => {
                    if (!this.chatMessages.find(m => m.id === id)) {
                        this.chatMessages.push({ id, ...msg });
                        if (this.onChatMessage) this.onChatMessage(msg);
                    }
                });
            }
        });
        
        // Presence
        const memberRef = ref(rtdb, `squads/${squadId}/members/${auth.currentUser.uid}`);
        onDisconnect(memberRef).remove();
    }

    async leaveSquad() {
        if (!this.squad) return;
        
        const memberRef = ref(rtdb, `squads/${this.squad.id}/members/${auth.currentUser.uid}`);
        await remove(memberRef);
        
        // Si era líder, transferir o disolver
        if (this.squad.leader === auth.currentUser.uid) {
            await this.transferLeadershipOrDisband();
        }
        
        this.squad = null;
    }

    async transferLeadershipOrDisband() {
        const members = Object.keys(this.squad.members).filter(id => id !== auth.currentUser.uid);
        
        if (members.length > 0) {
            await update(ref(rtdb, `squads/${this.squad.id}`), {
                leader: members[0]
            });
            
            await update(ref(rtdb, `squads/${this.squad.id}/members/${members[0]}`), {
                role: 'leader'
            });
        } else {
            await remove(ref(rtdb, `squads/${this.squad.id}`));
        }
    }

    async setReady(ready) {
        if (!this.squad) return;
        
        await update(ref(rtdb, `squads/${this.squad.id}/members/${auth.currentUser.uid}`), {
            ready: ready
        });
    }

    async sendChatMessage(text) {
        if (!this.squad) return;
        
        const messageRef = push(ref(rtdb, `squads/${this.squad.id}/chat`));
        
        await set(messageRef, {
            sender: auth.currentUser.uid,
            senderName: auth.currentUser.displayName || 'Soldado',
            text: text,
            timestamp: Date.now(),
            type: 'text'
        });
    }

    async sendVoiceData(audioData) {
        // Implementación WebRTC para voz
        // Placeholder para sistema de voz
    }

    async startMatchmaking(preferredMode = 'any') {
        if (!this.squad) {
            // Matchmaking individual
            return this.joinMatchmakingQueue(null, preferredMode);
        }
        
        // Verificar que todos estén listos
        const allReady = Object.values(this.squad.members).every(m => m.ready);
        if (!allReady) {
            throw new Error('No todos los miembros están listos');
        }
        
        // Matchmaking como grupo
        return this.joinMatchmakingQueue(this.squad.id, preferredMode);
    }

    async joinMatchmakingQueue(squadId = null, mode = 'any') {
        const queueRef = push(ref(rtdb, 'matchmakingQueue'));
        
        const queueData = {
            playerId: auth.currentUser.uid,
            squadId: squadId,
            rating: 1500, // ELO inicial
            mode: mode,
            timestamp: Date.now(),
            ping: this.network.ping
        };
        
        await set(queueRef, queueData);
        
        // Escuchar match encontrado
        const matchRef = ref(rtdb, `matchmakingQueue/${queueRef.key}/matchFound`);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                remove(queueRef);
                reject(new Error('Timeout en matchmaking'));
            }, 60000);
            
            onValue(matchRef, (snapshot) => {
                const match = snapshot.val();
                if (match) {
                    clearTimeout(timeout);
                    resolve(match);
                }
            });
        });
    }

    async invitePlayer(playerId) {
        if (!this.squad || this.squad.leader !== auth.currentUser.uid) {
            throw new Error('Solo el líder puede invitar');
        }
        
        const inviteRef = push(ref(rtdb, `players/${playerId}/invites`));
        
        await set(inviteRef, {
            type: 'squad',
            squadId: this.squad.id,
            squadName: this.squad.name,
            from: auth.currentUser.uid,
            fromName: auth.currentUser.displayName,
            timestamp: Date.now()
        });
        
        // Expirar en 60 segundos
        setTimeout(() => remove(inviteRef), 60000);
    }

    generateInviteCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    getSquadMembers() {
        if (!this.squad) return [];
        
        return Object.entries(this.squad.members).map(([id, data]) => ({
            id,
            ...data,
            isLeader: id === this.squad.leader
        }));
    }

    async kickPlayer(playerId) {
        if (!this.squad || this.squad.leader !== auth.currentUser.uid) {
            throw new Error('No autorizado');
        }
        
        const memberRef = ref(rtdb, `squads/${this.squad.id}/members/${playerId}`);
        await remove(memberRef);
    }

    async updateSettings(settings) {
        if (!this.squad || this.squad.leader !== auth.currentUser.uid) {
            throw new Error('No autorizado');
        }
        
        await update(ref(rtdb, `squads/${this.squad.id}/settings`), settings);
    }
}

export default LobbySystem;