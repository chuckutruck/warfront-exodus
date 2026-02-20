/**
 * Sistema de Armas - Balística Realista
 * Incluye: Recoil, dispersión, tiempo de viaje, penetración
 */

import * as THREE from 'three';

class WeaponSystem {
    constructor() {
        this.weaponDatabase = this.initializeWeaponDatabase();
    }

    initializeWeaponDatabase() {
        return {
            // RIFLES DE ASALTO
            'ar_standard': {
                id: 'ar_standard',
                name: 'AR-76 Standard',
                category: 'assault_rifle',
                damage: 28,
                fireRate: 600, // RPM
                magazineSize: 30,
                reloadTime: 2.2,
                bulletSpeed: 800, // m/s
                bulletDrop: 0.5,
                penetration: 0.6,
                
                // Recoil pattern
                recoil: {
                    vertical: 0.03,
                    horizontal: 0.01,
                    kickback: 0.05,
                    recovery: 0.9
                },
                
                // Dispersión
                spread: {
                    hip: 0.08,
                    aim: 0.02,
                    move: 0.04,
                    crouch: 0.9,
                    prone: 0.7
                },
                
                // Audio
                sounds: {
                    fire: 'ar_fire_01',
                    reload: 'ar_reload',
                    empty: 'weapon_empty'
                },
                
                // Visual
                model: 'models/weapons/ar_76.glb',
                muzzleFlash: 'effects/muzzle_ar',
                shellEject: 'effects/shell_rifle'
            },

            'ar_heavy': {
                id: 'ar_heavy',
                name: 'AR-88 Heavy',
                category: 'assault_rifle',
                damage: 35,
                fireRate: 450,
                magazineSize: 25,
                reloadTime: 2.5,
                bulletSpeed: 750,
                bulletDrop: 0.6,
                penetration: 0.7,
                
                recoil: {
                    vertical: 0.04,
                    horizontal: 0.015,
                    kickback: 0.07,
                    recovery: 0.85
                },
                
                spread: {
                    hip: 0.1,
                    aim: 0.025,
                    move: 0.05,
                    crouch: 0.85,
                    prone: 0.65
                }
            },

            // RIFLES DE PRECISIÓN
            'sniper_bolt': {
                id: 'sniper_bolt',
                name: 'SRS-99 Sniper',
                category: 'sniper_rifle',
                damage: 95,
                fireRate: 60,
                magazineSize: 5,
                reloadTime: 3.5,
                bulletSpeed: 1200,
                bulletDrop: 0.2,
                penetration: 0.95,
                
                recoil: {
                    vertical: 0.08,
                    horizontal: 0.02,
                    kickback: 0.15,
                    recovery: 0.7
                },
                
                spread: {
                    hip: 0.3,
                    aim: 0.0,
                    move: 0.2,
                    crouch: 0.8,
                    prone: 0.5
                },
                
                scope: {
                    zoomLevels: [4, 8, 12],
                    currentZoom: 0
                }
            },

            'sniper_dmr': {
                id: 'sniper_dmr',
                name: 'DMR-14 Marksman',
                category: 'dmr',
                damage: 55,
                fireRate: 180,
                magazineSize: 15,
                reloadTime: 2.8,
                bulletSpeed: 1000,
                bulletDrop: 0.3,
                penetration: 0.8,
                
                recoil: {
                    vertical: 0.05,
                    horizontal: 0.012,
                    kickback: 0.08,
                    recovery: 0.8
                }
            },

            // SUBFUSILES
            'smg_tactical': {
                id: 'smg_tactical',
                name: 'SMG-9 Tactical',
                category: 'smg',
                damage: 22,
                fireRate: 900,
                magazineSize: 32,
                reloadTime: 1.8,
                bulletSpeed: 500,
                bulletDrop: 0.8,
                penetration: 0.4,
                
                recoil: {
                    vertical: 0.025,
                    horizontal: 0.02,
                    kickback: 0.03,
                    recovery: 0.95
                },
                
                spread: {
                    hip: 0.06,
                    aim: 0.015,
                    move: 0.03,
                    crouch: 0.85,
                    prone: 0.75
                }
            },

            // ESCOPETAS
            'shotgun_combat': {
                id: 'shotgun_combat',
                name: 'M90 Combat',
                category: 'shotgun',
                damage: 15, // por perdigón
                pellets: 8,
                fireRate: 80,
                magazineSize: 6,
                reloadTime: 0.5, // por cartucho
                bulletSpeed: 400,
                bulletDrop: 1.2,
                penetration: 0.3,
                
                recoil: {
                    vertical: 0.06,
                    horizontal: 0.03,
                    kickback: 0.12,
                    recovery: 0.75
                },
                
                spread: {
                    hip: 0.15,
                    aim: 0.08,
                    move: 0.2,
                    crouch: 0.9,
                    prone: 0.8
                }
            },

            // PISTOLAS
            'pistol_standard': {
                id: 'pistol_standard',
                name: 'M6C Sidearm',
                category: 'pistol',
                damage: 20,
                fireRate: 400,
                magazineSize: 12,
                reloadTime: 1.5,
                bulletSpeed: 450,
                bulletDrop: 1.0,
                penetration: 0.4,
                
                recoil: {
                    vertical: 0.02,
                    horizontal: 0.008,
                    kickback: 0.02,
                    recovery: 0.95
                }
            },

            // ARMAS PESADAS
            'lmg_squad': {
                id: 'lmg_squad',
                name: 'M739 SAW',
                category: 'lmg',
                damage: 30,
                fireRate: 750,
                magazineSize: 100,
                reloadTime: 5.0,
                bulletSpeed: 850,
                bulletDrop: 0.4,
                penetration: 0.75,
                
                recoil: {
                    vertical: 0.035,
                    horizontal: 0.018,
                    kickback: 0.06,
                    recovery: 0.88
                },
                
                spread: {
                    hip: 0.12,
                    aim: 0.03,
                    move: 0.08,
                    crouch: 0.8,
                    prone: 0.6
                },
                
                bipod: true
            },

            // ARMAS FUTURISTAS
            'plasma_rifle': {
                id: 'plasma_rifle',
                name: 'Type-25 Plasma',
                category: 'energy',
                damage: 35,
                fireRate: 480,
                magazineSize: 100, // batería
                reloadTime: 2.0, // recarga térmica
                bulletSpeed: 200,
                bulletDrop: 0.1,
                penetration: 0.5,
                
                recoil: {
                    vertical: 0.02,
                    horizontal: 0.005,
                    kickback: 0.02,
                    recovery: 0.98
                },
                
                projectile: 'plasma_bolt',
                overheat: true
            },

            'railgun': {
                id: 'railgun',
                name: 'ARC-920 Railgun',
                category: 'energy',
                damage: 150,
                fireRate: 30,
                magazineSize: 1,
                reloadTime: 3.0,
                bulletSpeed: 3000,
                bulletDrop: 0.0,
                penetration: 1.0,
                
                chargeTime: 1.0,
                projectile: 'rail_slug'
            }
        };
    }

    createWeapon(weaponId, attachments = []) {
        const data = this.weaponDatabase[weaponId];
        if (!data) return null;
        
        return new Weapon(data, attachments);
    }
}

class Weapon {
    constructor(data, attachments = []) {
        this.data = { ...data };
        this.attachments = attachments;
        this.currentAmmo = data.magazineSize;
        this.totalAmmo = data.magazineSize * 4;
        this.lastFireTime = 0;
        this.isReloading = false;
        this.overheatLevel = 0;
        this.isCharging = false;
        
        // Aplicar modificadores de attachments
        this.applyAttachments();
        
        // Modelo 3D
        this.model = null;
        this.loadModel();
    }

    applyAttachments() {
        this.attachments.forEach(attachment => {
            switch(attachment.type) {
                case 'optic':
                    this.data.zoomMultiplier = attachment.zoom || 1.0;
                    break;
                case 'barrel':
                    this.data.recoil.vertical *= attachment.recoilMod || 1.0;
                    this.data.spread.hip *= attachment.spreadMod || 1.0;
                    break;
                case 'grip':
                    this.data.recoil.horizontal *= 0.7;
                    break;
                case 'magazine':
                    this.data.magazineSize += attachment.ammoBonus || 0;
                    this.currentAmmo = this.data.magazineSize;
                    break;
                case 'suppressor':
                    this.data.damage *= 0.9;
                    this.data.penetration *= 0.8;
                    this.isSilenced = true;
                    break;
            }
        });
    }

    async loadModel() {
        // Cargar modelo GLTF
        // Placeholder: crear geometría básica
        const group = new THREE.Group();
        
        // Cuerpo del arma
        const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);
        
        // Cañón
        const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.4;
        group.add(barrel);
        
        // Mira
        const sightGeo = new THREE.BoxGeometry(0.02, 0.05, 0.05);
        const sight = new THREE.Mesh(sightGeo, bodyMat);
        sight.position.y = 0.1;
        group.add(sight);
        
        this.model = group;
    }

    fire() {
        const now = Date.now();
        const fireInterval = 60000 / this.data.fireRate;
        
        if (now - this.lastFireTime < fireInterval) {
            return { success: false, reason: 'rate_limited' };
        }
        
        if (this.currentAmmo <= 0) {
            return { success: false, reason: 'empty' };
        }
        
        if (this.isReloading) {
            return { success: false, reason: 'reloading' };
        }
        
        if (this.data.chargeTime && !this.isCharging) {
            this.startCharge();
            return { success: false, reason: 'charging' };
        }
        
        // Consumir munición
        this.currentAmmo--;
        this.lastFireTime = now;
        
        // Calcular dispersión
        const spread = this.getSpread();
        
        // Crear proyectil(es)
        const projectiles = [];
        
        if (this.data.pellets) {
            // Escopeta: múltiples perdigones
            for (let i = 0; i < this.data.pellets; i++) {
                projectiles.push({
                    damage: this.data.damage,
                    speed: this.data.bulletSpeed,
                    drop: this.data.bulletDrop,
                    spread: spread * (1 + Math.random() * 0.5),
                    penetration: this.data.penetration
                });
            }
        } else {
            // Proyectil único
            projectiles.push({
                damage: this.data.damage,
                speed: this.data.bulletSpeed,
                drop: this.data.bulletDrop,
                spread: spread,
                penetration: this.data.penetration,
                isEnergy: this.data.projectile === 'plasma_bolt'
            });
        }
        
        return {
            success: true,
            projectiles: projectiles,
            recoil: this.data.recoil,
            muzzleVelocity: this.data.bulletSpeed
        };
    }

    getSpread(movementState = {}) {
        let spread = this.data.spread.hip;
        
        if (movementState.isAiming) {
            spread = this.data.spread.aim;
        }
        
        if (movementState.isMoving && !movementState.isAiming) {
            spread += this.data.spread.move;
        }
        
        if (movementState.isCrouching) {
            spread *= this.data.spread.crouch;
        } else if (movementState.isProne) {
            spread *= this.data.spread.prone;
        }
        
        // Penalización por fuego continuo
        const timeSinceLastShot = Date.now() - this.lastFireTime;
        if (timeSinceLastShot < 100) {
            spread *= 1.5;
        }
        
        return spread;
    }

    startCharge() {
        this.isCharging = true;
        setTimeout(() => {
            this.isCharging = false;
            // Auto-fire cuando carga completa
        }, this.data.chargeTime * 1000);
    }

    reload() {
        if (this.isReloading || this.currentAmmo >= this.data.magazineSize) {
            return false;
        }
        
        this.isReloading = true;
        
        const reloadTime = this.data.category === 'shotgun' ? 
            this.data.reloadTime * (this.data.magazineSize - this.currentAmmo) :
            this.data.reloadTime;
        
        setTimeout(() => {
            const needed = this.data.magazineSize - this.currentAmmo;
            const available = Math.min(needed, this.totalAmmo);
            
            this.currentAmmo += available;
            this.totalAmmo -= available;
            this.isReloading = false;
        }, reloadTime * 1000);
        
        return true;
    }

    cancelReload() {
        this.isReloading = false;
    }

    addAmmo(amount) {
        this.totalAmmo += amount;
    }
}

export { WeaponSystem, Weapon };