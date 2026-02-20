/**
 * Sistema de Balística - Física de Proyectiles Realista
 * Incluye: Caída de bala, tiempo de viaje, penetración, rebotes
 */

import * as THREE from 'three';

class Projectile {
    constructor(weaponData, origin, direction, ownerId) {
        this.weaponData = weaponData;
        this.origin = origin.clone();
        this.position = origin.clone();
        this.direction = direction.clone().normalize();
        this.ownerId = ownerId;
        
        // Física
        this.velocity = direction.clone().multiplyScalar(weaponData.speed);
        this.gravity = new THREE.Vector3(0, -9.81 * weaponData.drop, 0);
        this.startTime = Date.now();
        this.distanceTraveled = 0;
        
        // Propiedades
        this.damage = weaponData.damage;
        this.penetration = weaponData.penetration;
        this.isEnergy = weaponData.isEnergy || false;
        this.isActive = true;
        
        // Visual
        this.mesh = this.createVisual();
        this.trail = this.createTrail();
        
        // Colisión
        this.raycaster = new THREE.Raycaster();
        this.lastPosition = origin.clone();
    }

    createVisual() {
        if (this.isEnergy) {
            // Proyectil de energía (plasma)
            const geometry = new THREE.SphereGeometry(0.05, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.8
            });
            const mesh = new THREE.Mesh(geometry, material);
            
            // Luz dinámica
            const light = new THREE.PointLight(0x00ffff, 1, 5);
            mesh.add(light);
            
            return mesh;
        } else {
            // Bala convencional (tracer)
            const geometry = new THREE.CylinderGeometry(0.005, 0.005, 0.3, 4);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffff00,
                transparent: true,
                opacity: 0.6
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                this.direction
            );
            
            return mesh;
        }
    }

    createTrail() {
        // Sistema de partículas para rastro
        const trailGeometry = new THREE.BufferGeometry();
        const trailPositions = new Float32Array(20 * 3);
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        
        const trailMaterial = new THREE.LineBasicMaterial({
            color: this.isEnergy ? 0x00ffff : 0xffff00,
            transparent: true,
            opacity: 0.3
        });
        
        return new THREE.Line(trailGeometry, trailMaterial);
    }

    update(deltaTime) {
        if (!this.isActive) return;
        
        // Guardar posición anterior para raycast
        this.lastPosition.copy(this.position);
        
        // Aplicar gravedad
        if (!this.isEnergy) {
            this.velocity.add(this.gravity.clone().multiplyScalar(deltaTime));
        }
        
        // Actualizar posición
        const delta = this.velocity.clone().multiplyScalar(deltaTime);
        this.position.add(delta);
        this.distanceTraveled += delta.length();
        
        // Actualizar visual
        this.mesh.position.copy(this.position);
        
        if (!this.isEnergy) {
            // Orientar hacia la velocidad
            this.mesh.lookAt(this.position.clone().add(this.velocity));
        }
        
        // Actualizar trail
        this.updateTrail();
        
        // Verificar distancia máxima
        if (this.distanceTraveled > 2000) { // 2km
            this.destroy();
        }
    }

    updateTrail() {
        // Actualizar geometría del trail
        const positions = this.trail.geometry.attributes.position.array;
        
        // Shift positions
        for (let i = positions.length - 3; i >= 3; i -= 3) {
            positions[i] = positions[i - 3];
            positions[i + 1] = positions[i - 2];
            positions[i + 2] = positions[i - 1];
        }
        
        positions[0] = this.position.x;
        positions[1] = this.position.y;
        positions[2] = this.position.z;
        
        this.trail.geometry.attributes.position.needsUpdate = true;
    }

    checkCollision() {
        if (!this.isActive) return false;
        
        // Raycast desde última posición a actual
        this.raycaster.set(this.lastPosition, this.direction);
        this.raycaster.far = this.lastPosition.distanceTo(this.position);
        
        const intersects = this.raycaster.intersectObjects(
            this.engine.scene.children,
            true
        );
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            this.onImpact(hit);
            return true;
        }
        
        return false;
    }

    onImpact(hit) {
        const object = hit.object;
        const point = hit.point;
        const normal = hit.face.normal;
        const material = this.getMaterialType(object);
        
        // Efecto de impacto
        this.createImpactEffect(point, normal, material);
        
        // Calcular daño según material
        let damage = this.damage;
        let shouldPenetrate = false;
        
        switch(material) {
            case 'flesh':
                // Daño a jugador
                this.applyDamageToPlayer(object, damage, hit);
                break;
                
            case 'metal_thick':
                damage *= 0.3;
                shouldPenetrate = this.penetration > 0.8 && Math.random() > 0.5;
                this.createRicochet(point, normal, shouldPenetrate);
                break;
                
            case 'metal_thin':
                damage *= 0.6;
                shouldPenetrate = this.penetration > 0.5;
                break;
                
            case 'concrete':
                damage *= 0.4;
                shouldPenetrate = false;
                this.createImpactDecal(point, normal, 'concrete');
                break;
                
            case 'wood':
                damage *= 0.8;
                shouldPenetrate = this.penetration > 0.4;
                this.createImpactDecal(point, normal, 'wood');
                break;
                
            case 'glass':
                shouldPenetrate = true;
                this.shatterGlass(object, point);
                break;
                
            case 'energy_shield':
                damage = 0;
                this.createEnergyImpact(point);
                break;
        }
        
        // Penetración
        if (shouldPenetrate && this.penetration > 0) {
            this.penetrate(point, normal);
        } else {
            this.destroy();
        }
    }

    getMaterialType(object) {
        if (object.userData.isPlayer) return 'flesh';
        if (object.userData.material) return object.userData.material;
        if (object.name.includes('metal')) return 'metal_thick';
        if (object.name.includes('wall')) return 'concrete';
        return 'default';
    }

    applyDamageToPlayer(playerObject, damage, hit) {
        const player = playerObject.userData.playerRef;
        if (player && player.id !== this.ownerId) {
            // Determinar hitbox
            const hitbox = this.calculateHitbox(hit.point, player);
            player.takeDamage(damage, hitbox, { id: this.ownerId });
        }
    }

    calculateHitbox(point, player) {
        const localPoint = player.mesh.worldToLocal(point.clone());
        const height = localPoint.y;
        
        if (height > 1.6) return 'head';
        if (height > 1.2) return 'chest';
        if (height > 0.8) return 'stomach';
        if (Math.abs(localPoint.x) > 0.3) return 'arms';
        return 'legs';
    }

    penetrate(entryPoint, normal) {
        // Continuar trayectoria con menos energía
        this.damage *= 0.7;
        this.penetration *= 0.8;
        
        // Mover ligeramente más allá de la pared
        const offset = normal.clone().multiplyScalar(-0.1);
        this.position.add(offset);
        this.lastPosition.copy(this.position);
        
        if (this.penetration <= 0.1) {
            this.destroy();
        }
    }

    createImpactEffect(position, normal, material) {
        // Partículas según material
        const particleCount = material === 'metal' ? 10 : 5;
        const color = material === 'metal' ? 0xffaa00 : 0x888888;
        
        // Spark particles
        for (let i = 0; i < particleCount; i++) {
            const spark = new THREE.Mesh(
                new THREE.BoxGeometry(0.02, 0.02, 0.02),
                new THREE.MeshBasicMaterial({ color: color })
            );
            
            spark.position.copy(position);
            
            const velocity = normal.clone().add(
                new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                ).normalize().multiplyScalar(0.5)
            ).multiplyScalar(2 + Math.random() * 3);
            
            // Animar spark
            const startTime = Date.now();
            const animate = () => {
                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed > 0.5) {
                    spark.parent.remove(spark);
                    return;
                }
                
                spark.position.add(velocity.clone().multiplyScalar(0.016));
                velocity.y -= 9.81 * 0.016; // gravedad
                spark.scale.setScalar(1 - elapsed * 2);
                
                requestAnimationFrame(animate);
            };
            
            this.engine.scene.add(spark);
            animate();
        }
        
        // Flash de luz
        const light = new THREE.PointLight(color, 2, 3);
        light.position.copy(position);
        this.engine.scene.add(light);
        
        setTimeout(() => {
            this.engine.scene.remove(light);
        }, 50);
    }

    createRicochet(point, normal, penetrate) {
        if (penetrate) return;
        
        // Calcular rebote
        const reflectDir = this.direction.clone().reflect(normal);
        
        // Nueva bala reboteada (daño reducido)
        if (Math.random() > 0.7) {
            const ricochet = new Projectile({
                ...this.weaponData,
                damage: this.damage * 0.3,
                speed: this.velocity.length() * 0.5
            }, point, reflectDir, this.ownerId);
            
            this.engine.projectiles.push(ricochet);
        }
    }

    createImpactDecal(point, normal, material) {
        // Crear decal en el punto de impacto
        const decalGeo = new THREE.PlaneGeometry(0.1, 0.1);
        const decalMat = new THREE.MeshBasicMaterial({
            color: material === 'wood' ? 0x3d2817 : 0x111111,
            transparent: true,
            opacity: 0.8,
            depthTest: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -4
        });
        
        const decal = new THREE.Mesh(decalGeo, decalMat);
        decal.position.copy(point);
        decal.lookAt(point.clone().add(normal));
        
        this.engine.scene.add(decal);
        
        // Fade out
        setTimeout(() => {
            const fade = setInterval(() => {
                decal.material.opacity -= 0.05;
                if (decal.material.opacity <= 0) {
                    clearInterval(fade);
                    this.engine.scene.remove(decal);
                }
            }, 100);
        }, 10000);
    }

    shatterGlass(glassObject, point) {
        // Efecto de cristal roto
        glassObject.visible = false;
        
        // Crear shards
        for (let i = 0; i < 8; i++) {
            const shard = new THREE.Mesh(
                new THREE.TetrahedronGeometry(0.1),
                new THREE.MeshPhysicalMaterial({
                    color: 0xaaccff,
                    transparent: true,
                    opacity: 0.6,
                    transmission: 0.9
                })
            );
            
            shard.position.copy(point).add(
                new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                ).multiplyScalar(0.5)
            );
            
            this.engine.scene.add(shard);
            
            // Animar caída
            const velocity = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random(),
                Math.random() - 0.5
            ).multiplyScalar(3);
            
            const startTime = Date.now();
            const animate = () => {
                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed > 2) {
                    shard.parent.remove(shard);
                    return;
                }
                
                shard.position.add(velocity.clone().multiplyScalar(0.016));
                velocity.y -= 9.81 * 0.016;
                shard.rotation.x += Math.random() * 0.1;
                shard.rotation.z += Math.random() * 0.1;
                
                requestAnimationFrame(animate);
            };
            
            animate();
        }
    }

    createEnergyImpact(point) {
        // Explosión de energía
        const explosion = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 16, 16),
            new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.8
            })
        );
        explosion.position.copy(point);
        this.engine.scene.add(explosion);
        
        // Expandir y fade
        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 0.3) {
                explosion.parent.remove(explosion);
                return;
            }
            
            const scale = 1 + elapsed * 5;
            explosion.scale.setScalar(scale);
            explosion.material.opacity = 0.8 * (1 - elapsed / 0.3);
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    destroy() {
        this.isActive = false;
        this.engine.scene.remove(this.mesh);
        this.engine.scene.remove(this.trail);
    }
}

export default Projectile;