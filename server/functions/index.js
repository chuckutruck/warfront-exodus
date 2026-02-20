/**
 * WARFRONT: EXODUS - Cloud Functions
 * Validación de servidor, anti-cheat básico, estadísticas
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const rtdb = admin.database();

// VALIDACIÓN DE DAÑO
exports.validateDamage = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación');
    }
    
    const { sessionId, attackerId, victimId, damage, weapon, hitbox, timestamp } = data;
    
    // Verificar que la partida existe
    const sessionRef = rtdb.ref(`gameSessions/${sessionId}`);
    const session = await sessionRef.once('value');
    
    if (!session.exists()) {
        throw new functions.https.HttpsError('not-found', 'Partida no encontrada');
    }
    
    // Verificar que ambos jugadores están en la partida
    const players = session.val().players || {};
    if (!players[attackerId] || !players[victimId]) {
        return { valid: false, reason: 'player_not_in_match' };
    }
    
    // Verificar que no es team kill (si FF está desactivado)
    if (players[attackerId].team === players[victimId].team && 
        !session.val().settings.friendlyFire) {
        return { valid: false, reason: 'friendly_fire_disabled' };
    }
    
    // Verificar daño máximo por arma
    const weaponData = await getWeaponData(weapon);
    const maxDamage = weaponData.damage * getHitboxMultiplier(hitbox);
    
    if (damage > maxDamage * 1.1) { // 10% tolerancia
        // Posible modificación de cliente
        logSuspiciousActivity(attackerId, 'damage_too_high', { damage, maxDamage });
        return { valid: false, reason: 'invalid_damage' };
    }
    
    // Verificar distancia si es necesario
    const positions = await getPlayerPositions(sessionId, attackerId, victimId, timestamp);
    if (positions) {
        const distance = calculateDistance(positions.attacker, positions.victim);
        const maxRange = weaponData.range || 1000;
        
        if (distance > maxRange * 1.2) {
            logSuspiciousActivity(attackerId, 'range_too_high', { distance, maxRange });
            return { valid: false, reason: 'out_of_range' };
        }
    }
    
    // Verificar cadencia de fuego
    const fireRateValid = await checkFireRate(sessionId, attackerId, weapon, timestamp);
    if (!fireRateValid) {
        return { valid: false, reason: 'fire_rate_exceeded' };
    }
    
    return { valid: true };
});

// VALIDACIÓN DE RESULTADO DE PARTIDA
exports.validateMatchResult = functions.https.onCall(async (data, context) => {
    const { sessionId, results } = data;
    
    const sessionRef = rtdb.ref(`gameSessions/${sessionId}`);
    const session = await sessionRef.once('value');
    
    if (!session.exists()) {
        throw new functions.https.HttpsError('not-found', 'Partida no encontrada');
    }
    
    const sessionData = session.val();
    
    // Verificar que el host envía los resultados
    if (sessionData.hostId !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Solo el host puede validar');
    }
    
    // Verificar consistencia de puntuaciones
    const calculatedScores = calculateScoresFromLog(sessionData.killLog || {});
    
    if (Math.abs(calculatedScores.alpha - results.scores.alpha) > 2 ||
        Math.abs(calculatedScores.bravo - results.scores.bravo) > 2) {
        // Discrepancia significativa
        await flagMatchForReview(sessionId, 'score_mismatch');
    }
    
    // Guardar resultados oficiales
    await db.collection('matchResults').add({
        sessionId,
        results,
        validatedAt: admin.firestore.FieldValue.serverTimestamp(),
        players: sessionData.players
    });
    
    // Actualizar estadísticas de jugadores
    await updatePlayerStats(results.playerStats);
    
    return { success: true };
});

// ANTI-CHEAT: DETECCIÓN DE VELOCIDAD
exports.checkPlayerSpeed = functions.database.ref('/gameSessions/{sessionId}/snapshots/{playerId}')
    .onWrite(async (change, context) => {
        const { sessionId, playerId } = context.params;
        const newData = change.after.val();
        const oldData = change.before.val();
        
        if (!newData || !oldData) return;
        
        const newPos = newData.position;
        const oldPos = oldData.position;
        const newTime = newData.serverTimestamp;
        const oldTime = oldData.serverTimestamp;
        
        const distance = Math.sqrt(
            Math.pow(newPos[0] - oldPos[0], 2) +
            Math.pow(newPos[1] - oldPos[1], 2) +
            Math.pow(newPos[2] - oldPos[2], 2)
        );
        
        const timeDiff = (newTime - oldTime) / 1000; // segundos
        const speed = distance / timeDiff;
        
        // Velocidad máxima razonable (sprint + habilidad)
        const MAX_SPEED = 15; // m/s
        
        if (speed > MAX_SPEED) {
            // Posible speed hack
            const violationsRef = db.collection('cheatDetections').doc(playerId);
            
            await violationsRef.set({
                violations: admin.firestore.FieldValue.arrayUnion({
                    type: 'speed_hack',
                    speed: speed,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    sessionId
                })
            }, { merge: true });
            
            // Notificar a la partida
            await rtdb.ref(`gameSessions/${sessionId}/antiCheatWarnings/${playerId}`).set({
                type: 'speed_violation',
                timestamp: Date.now()
            });
        }
    });

// MATCHMAKING
exports.matchmaking = functions.database.ref('/matchmakingQueue/{queueId}')
    .onCreate(async (snapshot, context) => {
        const { queueId } = context.params;
        const playerData = snapshot.val();
        
        // Buscar jugadores compatibles
        const queueRef = rtdb.ref('matchmakingQueue');
        const queueSnapshot = await queueRef.once('value');
        
        const candidates = [];
        queueSnapshot.forEach(child => {
            if (child.key !== queueId) {
                const candidate = child.val();
                // Mismo modo, rating similar, buen ping
                if (candidate.mode === playerData.mode &&
                    Math.abs(candidate.rating - playerData.rating) < 200 &&
                    candidate.ping < 100) {
                    candidates.push({ id: child.key, ...candidate });
                }
            }
        });
        
        // Ordenar por mejor match
        candidates.sort((a, b) => {
            const scoreA = Math.abs(a.rating - playerData.rating) + a.ping;
            const scoreB = Math.abs(b.rating - playerData.rating) + b.ping;
            return scoreA - scoreB;
        });
        
        // Crear partida si hay suficientes jugadores
        const requiredPlayers = playerData.mode === 'duel' ? 2 : 
                               playerData.mode === 'squad' ? 4 : 8;
        
        if (candidates.length >= requiredPlayers - 1) {
            const matchPlayers = candidates.slice(0, requiredPlayers - 1);
            matchPlayers.push({ id: queueId, ...playerData });
            
            await createMatch(matchPlayers, playerData.mode);
            
            // Limpiar cola
            const updates = {};
            matchPlayers.forEach(p => {
                updates[p.id] = null;
            });
            await queueRef.update(updates);
        }
    });

// FUNCIONES AUXILIARES

async function getWeaponData(weaponId) {
    const doc = await db.collection('weapons').doc(weaponId).get();
    return doc.exists ? doc.data() : { damage: 30, range: 1000, fireRate: 600 };
}

function getHitboxMultiplier(hitbox) {
    const multipliers = {
        head: 3.0, neck: 2.5, chest: 1.0, stomach: 1.0,
        arms: 0.8, hands: 0.6, legs: 0.7, feet: 0.5
    };
    return multipliers[hitbox] || 1.0;
}

async function getPlayerPositions(sessionId, attackerId, victimId, timestamp) {
    const snapshot = await rtdb.ref(`gameSessions/${sessionId}/snapshots`).once('value');
    const data = snapshot.val();
    
    if (!data || !data[attackerId] || !data[victimId]) return null;
    
    return {
        attacker: data[attackerId].position,
        victim: data[victimId].position
    };
}

function calculateDistance(pos1, pos2) {
    return Math.sqrt(
        Math.pow(pos1[0] - pos2[0], 2) +
        Math.pow(pos1[1] - pos2[1], 2) +
        Math.pow(pos1[2] - pos2[2], 2)
    );
}

async function checkFireRate(sessionId, playerId, weaponId, timestamp) {
    const recentShotsRef = rtdb.ref(`gameSessions/${sessionId}/shots/${playerId}`);
    const snapshot = await recentShotsRef.orderByKey().limitToLast(5).once('value');
    
    const shots = snapshot.val() || {};
    const shotTimes = Object.values(shots).map(s => s.timestamp);
    
    if (shotTimes.length < 2) return true;
    
    const weaponData = await getWeaponData(weaponId);
    const minInterval = 60000 / weaponData.fireRate; // ms entre disparos
    
    const lastShot = Math.max(...shotTimes);
    return (timestamp - lastShot) >= minInterval * 0.9; // 10% tolerancia
}

function logSuspiciousActivity(playerId, type, data) {
    return db.collection('suspiciousActivity').add({
        playerId,
        type,
        data,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function updatePlayerStats(playerStats) {
    const batch = db.batch();
    
    Object.entries(playerStats).forEach(([playerId, stats]) => {
        const ref = db.collection('playerStats').doc(playerId);
        
        batch.set(ref, {
            kills: admin.firestore.FieldValue.increment(stats.kills || 0),
            deaths: admin.firestore.FieldValue.increment(stats.deaths || 0),
            assists: admin.firestore.FieldValue.increment(stats.assists || 0),
            matchesPlayed: admin.firestore.FieldValue.increment(1),
            lastMatch: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });
    
    await batch.commit();
}

async function createMatch(players, mode) {
    const sessionRef = rtdb.ref('gameSessions').push();
    
    const teams = assignTeams(players);
    
    await sessionRef.set({
        createdAt: Date.now(),
        status: 'waiting',
        mode: mode,
        players: teams,
        maxPlayers: players.length,
        settings: getModeSettings(mode)
    });
    
    // Notificar a jugadores
    players.forEach(player => {
        rtdb.ref(`players/${player.id}/matchFound`).set({
            sessionId: sessionRef.key,
            timestamp: Date.now()
        });
    });
}

function assignTeams(players) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    
    const result = {};
    shuffled.slice(0, mid).forEach((p, i) => {
        result[p.id] = { team: 'alpha', ...p };
    });
    shuffled.slice(mid).forEach((p, i) => {
        result[p.id] = { team: 'bravo', ...p };
    });
    
    return result;
}

function getModeSettings(mode) {
    const settings = {
        duel: { scoreLimit: 10, timeLimit: 600 },
        squad: { scoreLimit: 50, timeLimit: 900 },
        team: { scoreLimit: 100, timeLimit: 600 }
    };
    return settings[mode] || settings.team;
}