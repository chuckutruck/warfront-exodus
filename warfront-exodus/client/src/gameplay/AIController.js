/**
 * WARFRONT: EXODUS - AI Controller
 * Bots tácticos con comportamiento de escuadrón, cobertura y flanqueo
 */

import * as THREE from 'three';

class AIController {
    constructor(engine) {
        this.engine = engine;
        this.bots = new Map();
        this.difficulty = 'normal'; // easy, normal, hard, legendary
        
        // Configuración por dificultad
        this.difficultySettings = {
            easy: { accuracy: 0.3, reactionTime: 800, aggression: 0.3 },
            normal: { accuracy: 0.6, reactionTime: 400, aggression: 0.5 },
            hard: { accuracy: 0.8, reactionTime: 200, aggression: 0.7 },
            legendary: { accuracy: 0.95, reactionTime: 100, aggression: 0.9 }
        };
    }

    createBot(difficulty = 'normal', role = 'rifleman') {
        const bot = new AIBot(this.engine, difficulty, role);
        this.bots.set(bot.id, bot);
        return bot;
    }

    removeBot(botId) {
        const bot = this.bots.get(botId);
        if (bot) {
            bot.destroy();
            this.bots.delete(botId);
        }
    }

    update(deltaTime) {
        this.bots.forEach(bot => bot.update(deltaTime));
    }

    setDifficulty(level) {
        this.difficulty = level;
        this.bots.forEach(bot => bot.setDifficulty(level));
    }

    spawnSquad(count, team, spawnPoint) {
        const squad = [];
        const roles = ['rifleman', 'rifleman', 'support', 'sniper'];
        
        for (let i = 0; i < count; i++) {
            const bot = this.createBot(this.difficulty, roles[i % roles.length]);
            bot.team = team;
            bot.squadId = `squad_${team}_${Date.now()}`;
            bot.spawn(spawnPoint);
            squad.push(bot);
        }
        
        // Asignar líder y formación
        if (squad.length > 0) {
            squad[0].isLeader = true;
            this.assignFormation(squad);
        }
        
        return squad;
    }

    assignFormation(squad) {
        const formations = {
            wedge: [[0, 0], [-2, -2], [2, -2], [0, -4]],
            line: [[-3, 0], [-1, 0], [1, 0], [3, 0]],
            column: [[0, 0], [0, -2], [0, -4], [0, -6]]
        };
        
        const formation = formations.wedge;
        
        squad.forEach((bot, index) => {
            if (formation[index]) {
                bot.formationOffset = new THREE.Vector3(formation[index][0], 0, formation[index][1]);
            }
        });
    }
}

class AIBot {
    constructor(engine, difficulty, role) {
        this.engine = engine;
        this.id = `bot_${Math.random().toString(36).substr(2, 9)}`;
        this.difficulty = difficulty;
        this.role = role;
        
        // Estado
        this.state = 'idle'; // idle, patrol, engage, cover, flanking, retreat
        this.health = 100;
        this.isAlive = true;
        
        // Transform
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Euler();
        this.velocity = new THREE.Vector3();
        
        // Comportamiento
        this.target = null;
        this.lastKnownEnemyPos = null;
        this.squadId = null;
        this.isLeader = false;
        this.formationOffset = new THREE.Vector3();
        
        // Sensores
        this.viewDistance = 100;
        this.fieldOfView = 120; // grados
        this.hearingRange = 30;
        
        // Combate
        this.weapon = null;
        this.ammo = 30;
        this.lastShotTime = 0;
        this.coverPosition = null;
        this.flankRoute = [];
        
        // Temporizadores
        this.stateTimer = 0;
        this.reactionTimer = 0;
        this.updateInterval = 100; // ms
        this.lastUpdate = 0;
        
        // Settings
        this.settings = {
            easy: { accuracy: 0.3, reactionTime: 800 },
            normal: { accuracy: 0.6, reactionTime: 400 },
            hard: { accuracy: 0.8, reactionTime: 200 },
            legendary: { accuracy: 0.95, reactionTime: 100 }
        }[difficulty];
        
        this.init();
    }

    init() {
        // Crear mesh visual
        this.mesh = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.3, 1.8, 4, 8),
            new THREE.MeshStandardMaterial({ 
                color: this.team === 'alpha' ? 0x0000ff : 0xff0000 
            })
        );
        this.mesh.castShadow = true;
        this.engine.scene.add(this.mesh);
        
        // Asignar arma según rol
        this.assignRoleWeapon();
        
        // Navmesh simple (grid)
        this.navGrid = this.engine.navGrid;
    }

    assignRoleWeapon() {
        const weapons = {
            rifleman: 'ar_standard',
            support: 'lmg_squad',
            sniper: 'sniper_bolt',
            shotgun: 'shotgun_combat'
        };
        
        this.weapon = weapons[this.role] || 'ar_standard';
    }

    spawn(position) {
        this.position.copy(position);
        this.isAlive = true;
        this.health = 100;
        this.state = 'patrol';
    }

    update(deltaTime) {
        if (!this.isAlive) return;
        
        const now = Date.now();
        if (now - this.lastUpdate < this.updateInterval) return;
        this.lastUpdate = now;
        
        // Máquina de estados
        switch(this.state) {
            case 'idle':
                this.updateIdle();
                break;
            case 'patrol':
                this.updatePatrol();
                break;
            case 'engage':
                this.updateEngage(deltaTime);
                break;
            case 'cover':
                this.updateCover();
                break;
            case 'flanking':
                this.updateFlanking();
                break;
            case 'retreat':
                this.updateRetreat();
                break;
        }
        
        // Sensores
        this.scanForEnemies();
        this.hearSounds();
        
        // Movimiento
        this.updateMovement(deltaTime);
        
        // Actualizar visual
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation.y;
    }

    scanForEnemies() {
        const enemies = this.getEnemyPlayers();
        let bestTarget = null;
        let bestScore = 0;
        
        enemies.forEach(enemy => {
            const distance = this.position.distanceTo(enemy.position);
            if (distance > this.viewDistance) return;
            
            const angle = this.getAngleTo(enemy.position);
            if (Math.abs(angle) > this.fieldOfView / 2) return;
            
            // Raycast para línea de visión
            if (!this.hasLineOfSight(enemy.position)) return;
            
            const score = (this.viewDistance - distance) / this.viewDistance;
            
            if (score > bestScore) {
                bestScore = score;
                bestTarget = enemy;
            }
        });
        
        if (bestTarget) {
            this.target = bestTarget;
            this.lastKnownEnemyPos = bestTarget.position.clone();
            
            if (this.state !== 'engage') {
                this.reactionTimer = Date.now();
                this.state = 'engage';
            }
        }
    }

    hearSounds() {
        // Detectar sonidos cercanos (disparos, pasos)
        const sounds = this.engine.audioSystem?.getRecentSounds(this.hearingRange, this.position);
        
        sounds.forEach(sound => {
            if (sound.type === 'footstep' && sound.team !== this.team) {
                this.investigate(sound.position);
            } else if (sound.type === 'gunshot' && sound.team !== this.team) {
                this.lastKnownEnemyPos = sound.position.clone();
                if (this.state === 'idle' || this.state === 'patrol') {
                    this.state = 'engage';
                }
            }
        });
    }

    updateIdle() {
        // Buscar objetivos o patrullar
        if (Math.random() < 0.01) {
            this.state = 'patrol';
            this.selectRandomPatrolPoint();
        }
    }

    updatePatrol() {
        if (this.target) {
            this.state = 'engage';
            return;
        }
        
        // Moverse hacia punto de patrulla
        if (this.patrolTarget) {
            const dist = this.position.distanceTo(this.patrolTarget);
            if (dist < 2) {
                this.selectRandomPatrolPoint();
            }
        }
    }

    updateEngage(deltaTime) {
        if (!this.target || !this.target.isAlive) {
            this.target = null;
            this.state = this.lastKnownEnemyPos ? 'investigate' : 'patrol';
            return;
        }
        
        const distance = this.position.distanceTo(this.target.position);
        const timeInCombat = Date.now() - this.reactionTimer;
        
        // Tiempo de reacción
        if (timeInCombat < this.settings.reactionTime) return;
        
        // Decisión táctica
        const healthPercent = this.health / 100;
        const ammoPercent = this.ammo / 30;
        
        if (healthPercent < 0.3 && Math.random() < 0.7) {
            this.state = 'retreat';
            this.findCover();
        } else if (ammoPercent < 0.2) {
            this.reload();
        } else if (distance > 50 && this.role === 'sniper') {
            // Mantener distancia
            this.maintainDistance();
        } else if (distance > 20 && Math.random() < 0.3) {
            this.state = 'flanking';
            this.calculateFlankRoute();
        } else if (distance < 10 && this.role !== 'shotgun') {
            // Retroceder si es CQC y no es shotgun
            this.retreatFromCloseCombat();
        } else {
            // Combatir
            this.combatBehavior(deltaTime);
        }
        
        // Comunicar a escuadrón
        if (this.isLeader || Math.random() < 0.1) {
            this.calloutEnemy();
        }
    }

    combatBehavior(deltaTime) {
        const canSeeTarget = this.hasLineOfSight(this.target.position);
        
        if (canSeeTarget) {
            // Apuntar
            this.aimAt(this.target.position);
            
            // Disparar
            const accuracy = this.settings.accuracy;
            const shouldFire = Math.random() < accuracy && 
                              this.getAngleTo(this.target.position) < 5;
            
            if (shouldFire && this.ammo > 0) {
                this.fireWeapon();
            }
            
            // Buscar cobertura entre disparos
            if (Math.random() < 0.3) {
                this.findCover();
            }
        } else {
            // Perseguir última posición conocida
            this.moveTo(this.lastKnownEnemyPos);
        }
    }

    updateCover() {
        if (!this.coverPosition) {
            this.state = 'engage';
            return;
        }
        
        const distToCover = this.position.distanceTo(this.coverPosition);
        
        if (distToCover > 1) {
            this.moveTo(this.coverPosition);
        } else {
            // En cobertura
            this.peekFromCover();
            
            if (this.health < 100 && Math.random() < 0.1) {
                this.regenerateHealth();
            }
            
            if (this.target && this.hasLineOfSight(this.target.position)) {
                this.state = 'engage';
            }
        }
    }

    updateFlanking() {
        if (this.flankRoute.length === 0) {
            this.state = 'engage';
            return;
        }
        
        const nextPoint = this.flankRoute[0];
        this.moveTo(nextPoint);
        
        if (this.position.distanceTo(nextPoint) < 2) {
            this.flankRoute.shift();
        }
    }

    updateRetreat() {
        if (this.health > 50) {
            this.state = 'engage';
            return;
        }
        
        const retreatPoint = this.findRetreatPoint();
        this.moveTo(retreatPoint);
    }

    findCover() {
        // Buscar cobertura cercana
        const covers = this.engine.world?.getNearbyCover(this.position, 20);
        
        if (covers.length > 0) {
            // Evaluar mejor cobertura
            let bestCover = null;
            let bestScore = 0;
            
            covers.forEach(cover => {
                const dist = this.position.distanceTo(cover.position);
                const protection = cover.protectionLevel;
                const visibilityToEnemy = this.target ? 
                    this.hasLineOfSightFrom(cover.position, this.target.position) : false;
                
                const score = protection * 10 - dist + (visibilityToEnemy ? 5 : 0);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestCover = cover;
                }
            });
            
            if (bestCover) {
                this.coverPosition = bestCover.position;
                this.state = 'cover';
            }
        }
    }

    calculateFlankRoute() {
        if (!this.target) return;
        
        // Calcular ruta de flanqueo
        const targetPos = this.target.position;
        const flankDirection = new THREE.Vector3()
            .subVectors(targetPos, this.position)
            .cross(new THREE.Vector3(0, 1, 0))
            .normalize()
            .multiplyScalar(30);
        
        this.flankRoute = [
            this.position.clone().add(flankDirection),
            targetPos.clone().add(flankDirection.clone().multiplyScalar(0.5))
        ];
    }

    fireWeapon() {
        const now = Date.now();
        const fireRate = 100; // ms entre disparos
        
        if (now - this.lastShotTime < fireRate) return;
        
        this.lastShotTime = now;
        this.ammo--;
        
        // Calcular dispersión según dificultad
        const spread = (1 - this.settings.accuracy) * 0.1;
        const direction = this.getAimDirection().add(
            new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread,
                (Math.random() - 0.5) * spread
            )
        );
        
        // Crear proyectil
        this.engine.fireProjectile({
            damage: 25,
            speed: 800
        }, this.position.clone().add(new THREE.Vector3(0, 1.6, 0)), direction, this.id);
        
        // Sonido
        this.engine.audioSystem?.play('rifle_fire', { position: this.position });
    }

    reload() {
        this.ammo = 30;
        // Animación de recarga
        setTimeout(() => {
            this.state = 'engage';
        }, 2000);
    }

    moveTo(targetPos) {
        const direction = new THREE.Vector3()
            .subVectors(targetPos, this.position)
            .normalize();
        
        const speed = this.state === 'retreat' ? 6 : 4;
        this.velocity.copy(direction.multiplyScalar(speed));
        
        // Rotación suave
        const targetRotation = Math.atan2(direction.x, direction.z);
        this.rotation.y = THREE.MathUtils.lerp(this.rotation.y, targetRotation, 0.1);
    }

    updateMovement(deltaTime) {
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        this.velocity.multiplyScalar(0.9); // Fricción
    }

    aimAt(targetPos) {
        const direction = new THREE.Vector3()
            .subVectors(targetPos, this.position)
            .normalize();
        
        const targetRotation = Math.atan2(direction.x, direction.z);
        this.rotation.y = THREE.MathUtils.lerp(this.rotation.y, targetRotation, 0.2);
    }

    getAimDirection() {
        return new THREE.Vector3(
            Math.sin(this.rotation.y),
            0,
            Math.cos(this.rotation.y)
        );
    }

    getAngleTo(position) {
        const direction = new THREE.Vector3()
            .subVectors(position, this.position)
            .normalize();
        
        const forward = this.getAimDirection();
        const angle = Math.atan2(direction.x, direction.z) - 
                     Math.atan2(forward.x, forward.z);
        
        return THREE.MathUtils.radToDeg(angle);
    }

    hasLineOfSight(targetPos) {
        const start = this.position.clone().add(new THREE.Vector3(0, 1.6, 0));
        const direction = new THREE.Vector3().subVectors(targetPos, start).normalize();
        const distance = start.distanceTo(targetPos);
        
        const raycaster = new THREE.Raycaster(start, direction, 0, distance);
        const intersects = raycaster.intersectObjects(this.engine.scene.children, true);
        
        return intersects.length === 0 || intersects[0].distance >= distance - 0.5;
    }

    getEnemyPlayers() {
        const enemies = [];
        this.engine.players.forEach(player => {
            if (player.team !== this.team && player.isAlive) {
                enemies.push(player);
            }
        });
        return enemies;
    }

    takeDamage(amount, attacker) {
        this.health -= amount;
        
        if (this.health <= 0) {
            this.die(attacker);
        } else if (this.state !== 'engage') {
            this.state = 'cover';
            this.target = attacker;
        }
    }

    die(killer) {
        this.isAlive = false;
        this.state = 'dead';
        
        // Ragdoll o animación de muerte
        this.mesh.rotation.x = Math.PI / 2;
        
        // Respawn después de delay
        setTimeout(() => {
            this.respawn();
        }, 3000);
    }

    respawn() {
        const spawnPoint = this.engine.matchManager?.selectBestSpawn(
            this.engine.matchManager.spawnPoints[this.team],
            this.team
        );
        
        this.spawn(spawnPoint || new THREE.Vector3(0, 2, 0));
    }

    destroy() {
        this.engine.scene.remove(this.mesh);
    }

    setDifficulty(level) {
        this.difficulty = level;
        this.settings = {
            easy: { accuracy: 0.3, reactionTime: 800 },
            normal: { accuracy: 0.6, reactionTime: 400 },
            hard: { accuracy: 0.8, reactionTime: 200 },
            legendary: { accuracy: 0.95, reactionTime: 100 }
        }[level];
    }
}

export default AIController;