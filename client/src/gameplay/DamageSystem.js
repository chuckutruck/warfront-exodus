/**
 * WARFRONT: EXODUS - Damage System
 * Daño por zonas, efectos de estado, registro de combate
 */

import * as THREE from 'three';

class DamageSystem {
    constructor(engine) {
        this.engine = engine;
        this.damageLog = [];
        this.killFeed = [];
        
        // Multiplicadores de daño por zona
        this.hitboxMultipliers = {
            head: 3.0,
            neck: 2.5,
            chest: 1.0,
            stomach: 1.0,
            arms: 0.8,
            hands: 0.6,
            legs: 0.7,
            feet: 0.5
        };
        
        // Materiales y penetración
        this.materials = {
            flesh: { penetration: 1.0, damageMod: 1.0 },
            light_armor: { penetration: 0.7, damageMod: 0.8 },
            heavy_armor: { penetration: 0.4, damageMod: 0.5 },
            shield: { penetration: 0.0, damageMod: 0.0 },
            wood: { penetration: 0.8, damageMod: 0.9 },
            metal_thin: { penetration: 0.6, damageMod: 0.7 },
            metal_thick: { penetration: 0.3, damageMod: 0.4 },
            concrete: { penetration: 0.2, damageMod: 0.3 },
            dirt: { penetration: 0.9, damageMod: 0.95 }
        };
    }

    calculateDamage(baseDamage, hitbox, material = 'flesh', penetration = 0) {
        const hitboxMult = this.hitboxMultipliers[hitbox] || 1.0;
        const materialData = this.materials[material] || this.materials.flesh;
        
        // Penetración reduce el modificador de material
        const effectivePenetration = Math.min(penetration, 1.0);
        const materialMod = 1.0 - ((1.0 - materialData.damageMod) * (1.0 - effectivePenetration));
        
        const finalDamage = baseDamage * hitboxMult * materialMod;
        
        return {
            damage: Math.round(finalDamage),
            isCritical: hitbox === 'head' || hitbox === 'neck',
            penetrationApplied: effectivePenetration
        };
    }

    applyDamage(victim, attacker, damageData) {
        if (!victim.isAlive) return null;
        
        const result = this.calculateDamage(
            damageData.baseDamage,
            damageData.hitbox,
            damageData.material,
            damageData.penetration
        );
        
        // Aplicar daño al jugador
        victim.takeDamage(result.damage, damageData.hitbox, attacker);
        
        // Efectos de impacto
        this.spawnImpactEffect(victim, damageData.hitbox, result.isCritical);
        
        // Registrar en log
        const damageEntry = {
            timestamp: Date.now(),
            victim: victim.id,
            attacker: attacker?.id,
            damage: result.damage,
            hitbox: damageData.hitbox,
            weapon: damageData.weaponId,
            isCritical: result.isCritical,
            victimHealth: victim.health
        };
        
        this.damageLog.push(damageEntry);
        
        // Verificar kill
        if (victim.health <= 0) {
            this.registerKill(attacker, victim, damageData);
        }
        
        return result;
    }

    registerKill(attacker, victim, damageData) {
        const killEntry = {
            timestamp: Date.now(),
            killer: attacker?.id || 'world',
            killerName: attacker?.name || 'Entorno',
            victim: victim.id,
            victimName: victim.name,
            weapon: damageData.weaponId,
            hitbox: damageData.hitbox,
            distance: this.calculateDistance(attacker, victim),
            isHeadshot: damageData.hitbox === 'head'
        };
        
        this.killFeed.unshift(killEntry);
        
        // Mantener solo últimos 5
        if (this.killFeed.length > 5) {
            this.killFeed.pop();
        }
        
        // Actualizar estadísticas
        if (attacker) {
            attacker.stats.kills++;
            attacker.stats.killStreak++;
            
            // Bonificaciones
            if (killEntry.distance > 100) attacker.stats.longshots++;
            if (killEntry.isHeadshot) attacker.stats.headshots++;
        }
        
        victim.stats.deaths++;
        victim.stats.killStreak = 0;
        
        // Evento de kill
        this.engine.eventSystem?.emit('playerKilled', killEntry);
    }

    calculateDistance(a, b) {
        if (!a || !b) return 0;
        return a.position.distanceTo(b.position);
    }

    spawnImpactEffect(player, hitbox, isCritical) {
        // Efecto visual de sangre/impacto
        const effectType = isCritical ? 'blood_critical' : 'blood_normal';
        
        // Posición del impacto según hitbox
        const offset = this.getHitboxOffset(hitbox);
        const position = player.position.clone().add(offset);
        
        // Sistema de partículas
        this.engine.particleSystem?.spawn(effectType, position);
        
        // Sonido
        const sound = isCritical ? 'hitmarker_critical' : 'hitmarker_normal';
        this.engine.audioSystem?.play(sound, { volume: 0.5 });
    }

    getHitboxOffset(hitbox) {
        const offsets = {
            head: new THREE.Vector3(0, 1.7, 0),
            chest: new THREE.Vector3(0, 1.3, 0),
            stomach: new THREE.Vector3(0, 1.0, 0),
            arms: new THREE.Vector3(0.3, 1.3, 0),
            legs: new THREE.Vector3(0, 0.5, 0)
        };
        
        return offsets[hitbox] || new THREE.Vector3(0, 1, 0);
    }

    validateShot(origin, target, weaponData) {
        // Raycast para verificar línea de visión
        const direction = target.clone().sub(origin).normalize();
        const distance = origin.distanceTo(target);
        
        const raycaster = new THREE.Raycaster(origin, direction, 0, distance);
        const intersects = raycaster.intersectObjects(this.engine.scene.children, true);
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            const material = hit.object.userData.material || 'concrete';
            
            return {
                valid: false,
                blockedBy: hit.object,
                material: material,
                penetration: weaponData.penetration
            };
        }
        
        return { valid: true };
    }

    applyAreaDamage(center, radius, baseDamage, attacker, weaponId) {
        // Daño en área (explosiones)
        const affectedPlayers = [];
        
        this.engine.players.forEach(player => {
            if (player.id === attacker.id || !player.isAlive) return;
            
            const distance = player.position.distanceTo(center);
            
            if (distance <= radius) {
                // Caída de daño por distancia
                const damageMod = 1.0 - (distance / radius);
                const damage = baseDamage * damageMod;
                
                // Raycast para verificar cobertura
                const hasCover = this.checkCover(center, player.position);
                const finalDamage = hasCover ? damage * 0.5 : damage;
                
                this.applyDamage(player, attacker, {
                    baseDamage: finalDamage,
                    hitbox: 'stomach',
                    weaponId: weaponId,
                    isExplosion: true
                });
                
                affectedPlayers.push({
                    player: player.id,
                    damage: finalDamage,
                    distance: distance
                });
                
                // Empuje de explosión
                const pushDir = player.position.clone().sub(center).normalize();
                player.velocity.add(pushDir.multiplyScalar(10 * damageMod));
            }
        });
        
        return affectedPlayers;
    }

    checkCover(explosionPos, playerPos) {
        const midPos = playerPos.clone().add(new THREE.Vector3(0, 1, 0));
        const direction = midPos.clone().sub(explosionPos).normalize();
        const distance = explosionPos.distanceTo(midPos);
        
        const raycaster = new THREE.Raycaster(explosionPos, direction, 0, distance);
        const intersects = raycaster.intersectObjects(this.engine.scene.children, true);
        
        return intersects.length > 0 && intersects[0].distance < distance - 0.5;
    }

    getKillFeed() {
        return this.killFeed;
    }

    getDamageLog(playerId = null) {
        if (playerId) {
            return this.damageLog.filter(e => 
                e.attacker === playerId || e.victim === playerId
            );
        }
        return this.damageLog;
    }

    getStats(playerId) {
        const playerLog = this.getDamageLog(playerId);
        
        return {
            kills: playerLog.filter(e => e.attacker === playerId && e.victimHealth <= 0).length,
            deaths: playerLog.filter(e => e.victim === playerId && e.victimHealth <= 0).length,
            damageDealt: playerLog
                .filter(e => e.attacker === playerId)
                .reduce((sum, e) => sum + e.damage, 0),
            damageTaken: playerLog
                .filter(e => e.victim === playerId)
                .reduce((sum, e) => sum + e.damage, 0),
            headshots: playerLog.filter(e => 
                e.attacker === playerId && e.hitbox === 'head'
            ).length,
            accuracy: this.calculateAccuracy(playerId)
        };
    }

    calculateAccuracy(playerId) {
        // Implementar conteo de disparos vs hits
        return 0.35; // Placeholder 35%
    }
}

export default DamageSystem;