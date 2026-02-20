// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.database();
const firestore = admin.firestore();

/**
 * Validación de disparos - Anti-cheat básico
 */
exports.validateShot = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Requiere autenticación');
    }
    
    const { playerId, weaponId, origin, direction, timestamp } = data;
    
    // Verificar rate de fuego
    const playerRef = db.ref(`players/${playerId}`);
    const snapshot = await playerRef.once('value');
    const player = snapshot.val();
    
    if (!player) {
        throw new functions.https.HttpsError('not-found', 'Jugador no encontrado');
    }
    
    // Verificar velocidad de movimiento (anti-speedhack)
    if (player.lastPosition) {
        const distance = calculateDistance(player.lastPosition, origin);
        const timeDiff = timestamp - player.lastUpdate;
        const speed = distance / (timeDiff / 1000);
        
        if (speed > 15) { // Max 15 m/s
            console.warn(`Posible speedhack detectado: ${playerId}, velocidad: ${speed}`);
            return { valid: false, reason: 'speed_exceeded' };
        }
    }
    
    // Verificar cadencia de arma
    const weapon = await getWeaponData(weaponId);
    if (weapon) {
        const lastShot = player.lastShot || 0;
        const fireInterval = 60000 / weapon.fireRate;
        
        if (timestamp - lastShot < fireInterval * 0.9) { // 10% tolerancia
            return { valid: false, reason: 'fire_rate_exceeded' };
        }
    }
    
    // Actualizar último disparo
    await playerRef.update({
        lastShot: timestamp,
        lastPosition: origin
    });
    
    return { valid: true };
});

/**
 * Validación de daño
 */
exports.validateDamage = functions.https.onCall(async (data, context) => {
    const { attackerId, victimId, damage, hitbox, distance, weaponId } = data;
    
    // Verificar distancia máxima del arma
    const weapon = await getWeaponData(weaponId);
    if (weapon && distance > weapon.maxRange) {
        return { valid: false, reason: 'range_exceeded' };
    }
    
    // Verificar daño máximo posible
    const maxDamage = weapon ? weapon.damage * 3 : 100; // Headshot max
    if (damage > maxDamage) {
        return { valid: false, reason: 'damage_exceeded' };
    }
    
    // Verificar línea de visión (simplificado)
    // En producción: raycast en servidor o verificación de posiciones
    
    return { valid: true };
});

/**
 * Matchmaking automático
 */
exports.findMatch = functions.https.onCall(async (data, context) => {
    const { gameMode, skillRating } = data;
    
    // Buscar sesión disponible
    const sessionsRef = db.ref('sessions');
    const snapshot = await sessionsRef
        .orderByChild('status')
        .equalTo('waiting')
        .once('value');
    
    const sessions = snapshot.val() || {};
    
    // Filtrar por modo y disponibilidad
    const availableSessions = Object.values(sessions).filter(session => {
        const playerCount = Object.keys(session.players || {}).length;
        return session.gameMode === gameMode && 
               playerCount < session.maxPlayers &&
               Math.abs((session.averageSkill || 0) - skillRating) < 200;
    });
    
    if (availableSessions.length > 0) {
        // Unirse a sesión existente
        return { sessionId: availableSessions[0].id, action: 'join' };
    } else {
        // Crear nueva sesión
        return { action: 'create' };
    }
});

/**
 * Finalizar partida y guardar estadísticas
 */
exports.endMatch = functions.database
    .ref('/sessions/{sessionId}/status')
    .onUpdate(async (change, context) => {
        const before = change.before.val();
        const after = change.after.val();
        
        if (before !== 'playing' || after !== 'ended') return;
        
        const sessionId = context.params.sessionId;
        const sessionRef = db.ref(`sessions/${sessionId}`);
        const snapshot = await sessionRef.once('value');
        const session = snapshot.val();
        
        if (!session) return;
        
        // Guardar resultados en Firestore
        await firestore.collection('matches').doc(sessionId).set({
            ...session,
            endedAt: admin.firestore.FieldValue.serverTimestamp(),
            duration: Date.now() - session.created
        });
        
        // Actualizar estadísticas de jugadores
        const batch = firestore.batch();
        
        Object.entries(session.players || {}).forEach(([playerId, stats]) => {
            const playerRef = firestore.collection('players').doc(playerId);
            
            batch.update(playerRef, {
                totalMatches: admin.firestore.FieldValue.increment(1),
                totalKills: admin.firestore.FieldValue.increment(stats.kills || 0),
                totalDeaths: admin.firestore.FieldValue.increment(stats.deaths || 0),
                score: admin.firestore.FieldValue.increment(stats.score || 0),
                lastMatch: sessionId
            });
        });
        
        await batch.commit();
        
        // Cleanup de RTDB después de 5 minutos
        setTimeout(async () => {
            await sessionRef.remove();
        }, 300000);
    });

// Helper functions
function calculateDistance(pos1, pos2) {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

async function getWeaponData(weaponId) {
    const snapshot = await db.ref(`weapons/${weaponId}`).once('value');
    return snapshot.val();
}