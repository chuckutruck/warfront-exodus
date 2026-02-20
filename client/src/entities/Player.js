/**
 * Sistema de Jugador - FPS Táctico
 * Incluye: Movimiento realista, físicas, animaciones first-person
 */

import * as THREE from 'three';

class Player {
    constructor(engine, isLocal = false, data = {}) {
        this.engine = engine;
        this.isLocal = isLocal;
        this.id = data.id || Math.random().toString(36).substr(2, 9);
        
        // Datos del jugador
        this.name = data.name || 'Soldado';
        this.team = data.team || 'neutral';
        this.health = 100;
        this.maxHealth = 100;
        this.armor = 0;
        this.isAlive = true;
        
        // Transformación
        this.position = new THREE.Vector3(0, 1.8, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.velocity = new THREE.Vector3();
        
        // Configuración de movimiento
        this.movementConfig = {
            walkSpeed: 4.0,
            sprintSpeed: 6.5,
            crouchSpeed: 2.0,
            proneSpeed: 1.0,
            jumpForce: 6.0,
            acceleration: 10.0,
            deceleration: 8.0,
            airControl: 0.3,
            gravity: 20.0
        };
        
        // Estado de movimiento
        this.movementState = {
            isGrounded: false,
            isSprinting: false,
            isCrouching: false,
            isProne: false,
            isAiming: false,
            isReloading: false
        };
        
        // Cámara y viewmodel (solo local)
        if (isLocal) {
            this.setupFirstPerson();
        } else {
            this.setupThirdPerson();
        }
        
        // Armas
        this.weapons = [];
        this.currentWeapon = null;
        this.inventory = {
            primary: null,
            secondary: null,
            melee: null,
            grenades: []
        };
        
        // Hitboxes para daño
        this.hitboxes = this.createHitboxes();
        
        // Red
        this.lastUpdate = 0;
        this.interpolationBuffer = [];
    }

    setupFirstPerson() {
        // La cámara ya está en el engine, la configuramos para FPS
        this.camera = this.engine.camera;
        this.camera.position.copy(this.position);
        
        // Viewmodel (brazos y arma)
        this.viewmodel = new THREE.Group();
        this.viewmodel.position.set(0.3, -0.3, -0.5);
        this.camera.add(this.viewmodel);
        
        // Cuerpo invisible para colisiones
        this.collider = new THREE.CapsuleGeometry(0.3, 1.8, 4, 8);
        this.colliderMesh = new THREE.Mesh(
            this.collider,
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this.engine.scene.add(this.colliderMesh);
        
        // Raycaster para interacciones
        this.raycaster = new THREE.Raycaster();
    }

    setupThirdPerson() {
        // Modelo 3D del jugador (placeholder)
        const geometry = new THREE.CapsuleGeometry(0.3, 1.8, 4, 8);
        const material = new THREE.MeshStandardMaterial({
            color: this.team === 'red' ? 0x8b0000 : 0x00008b
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Indicador de nombre
        this.createNameTag();
        
        this.engine.scene.add(this.mesh);
    }

    createHitboxes() {
        return {
            head: { damage: 3.0, radius: 0.15, offset: new THREE.Vector3(0, 1.7, 0) },
            chest: { damage: 1.0, radius: 0.25, offset: new THREE.Vector3(0, 1.3, 0) },
            stomach: { damage: 1.0, radius: 0.2, offset: new THREE.Vector3(0, 1.0, 0) },
            arms: { damage: 0.8, radius: 0.12, offset: new THREE.Vector3(0.4, 1.3, 0) },
            legs: { damage: 0.7, radius: 0.15, offset: new THREE.Vector3(0, 0.5, 0.1) }
        };
    }

    update(deltaTime) {
        if (!this.isAlive) return;
        
        if (this.isLocal) {
            this.updateLocal(deltaTime);
        } else {
            this.updateRemote(deltaTime);
        }
    }

    updateLocal(deltaTime) {
        // Input del jugador
        const input = this.engine.input;
        
        // Movimiento
        this.handleMovement(input, deltaTime);
        
        // Acciones
        if (input.isPressed('fire') && this.currentWeapon) {
            this.fireWeapon();
        }
        
        if (input.isPressed('aim')) {
            this.toggleAim(true);
        } else {
            this.toggleAim(false);
        }
        
        if (input.isPressed('reload') && this.currentWeapon) {
            this.reloadWeapon();
        }
        
        if (input.isPressed('jump') && this.movementState.isGrounded) {
            this.jump();
        }
        
        if (input.isPressed('sprint')) {
            this.movementState.isSprinting = true;
        } else {
            this.movementState.isSprinting = false;
        }
        
        if (input.isPressed('crouch')) {
            this.toggleCrouch(true);
        } else {
            this.toggleCrouch(false);
        }
        
        // Cambio de armas
        if (input.isPressed('weapon1')) this.switchWeapon(0);
        if (input.isPressed('weapon2')) this.switchWeapon(1);
        if (input.isPressed('weapon3')) this.switchWeapon(2);
        
        // Actualizar físicas
        this.applyPhysics(deltaTime);
        
        // Sincronizar cámara
        this.updateCamera();
        
        // Sincronización de red
        this.syncToNetwork();
    }

    handleMovement(input, deltaTime) {
        const forward = input.getAxis('vertical');
        const right = input.getAxis('horizontal');
        
        // Dirección relativa a la cámara
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();
        
        const cameraRight = new THREE.Vector3();
        cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));
        
        // Vector de movimiento deseado
        const moveDirection = new THREE.Vector3()
            .addScaledVector(cameraDirection, forward)
            .addScaledVector(cameraRight, right);
        
        if (moveDirection.length() > 1) moveDirection.normalize();
        
        // Velocidad objetivo según estado
        let targetSpeed = this.movementConfig.walkSpeed;
        if (this.movementState.isSprinting && !this.movementState.isAiming) {
            targetSpeed = this.movementConfig.sprintSpeed;
        } else if (this.movementState.isCrouching) {
            targetSpeed = this.movementConfig.crouchSpeed;
        } else if (this.movementState.isProne) {
            targetSpeed = this.movementConfig.proneSpeed;
        }
        
        if (this.movementState.isAiming) targetSpeed *= 0.5;
        
        // Aceleración
        const targetVelocity = moveDirection.multiplyScalar(targetSpeed);
        
        if (this.movementState.isGrounded) {
            // Movimiento en tierra
            this.velocity.x = THREE.MathUtils.lerp(
                this.velocity.x, 
                targetVelocity.x, 
                this.movementConfig.acceleration * deltaTime
            );
            this.velocity.z = THREE.MathUtils.lerp(
                this.velocity.z, 
                targetVelocity.z, 
                this.movementConfig.acceleration * deltaTime
            );
        } else {
            // Control en el aire
            this.velocity.x += targetVelocity.x * this.movementConfig.airControl * deltaTime;
            this.velocity.z += targetVelocity.z * this.movementConfig.airControl * deltaTime;
        }
    }

    applyPhysics(deltaTime) {
        // Gravedad
        this.velocity.y -= this.movementConfig.gravity * deltaTime;
        
        // Colisión con suelo simple
        const nextPosition = this.position.clone().add(
            this.velocity.clone().multiplyScalar(deltaTime)
        );
        
        // Raycast hacia abajo para detectar suelo
        const raycaster = new THREE.Raycaster(nextPosition, new THREE.Vector3(0, -1, 0), 0, 2);
        const intersects = raycaster.intersectObjects(this.engine.scene.children, true);
        
        if (intersects.length > 0 && intersects[0].distance < 1.8) {
            // En el suelo
            this.movementState.isGrounded = true;
            this.velocity.y = Math.max(0, this.velocity.y);
            nextPosition.y = intersects[0].point.y + 1.8;
        } else {
            this.movementState.isGrounded = false;
        }
        
        this.position.copy(nextPosition);
        
        // Actualizar collider
        if (this.colliderMesh) {
            this.colliderMesh.position.copy(this.position);
        }
    }

    updateCamera() {
        // Posición de la cámara sigue al jugador
        const eyeHeight = this.movementState.isCrouching ? 1.0 : 
                         this.movementState.isProne ? 0.4 : 1.7;
        
        this.camera.position.lerp(
            new THREE.Vector3(this.position.x, this.position.y + eyeHeight, this.position.z),
            0.2
        );
        
        // Rotación del mouse
        if (this.engine.input) {
            const look = this.engine.input.getLookDelta();
            this.rotation.y -= look.x * 0.002;
            this.rotation.x -= look.y * 0.002;
            this.rotation.x = THREE.MathUtils.clamp(this.rotation.x, -Math.PI/2, Math.PI/2);
            
            this.camera.rotation.x = this.rotation.x;
            this.camera.rotation.y = this.rotation.y;
        }
    }

    jump() {
        if (this.movementState.isGrounded) {
            this.velocity.y = this.movementConfig.jumpForce;
            this.movementState.isGrounded = false;
            
            // Animación de salto
            this.playAnimation('jump');
        }
    }

    toggleCrouch(crouch) {
        if (crouch && !this.movementState.isCrouching) {
            this.movementState.isCrouching = true;
            this.playAnimation('crouch');
        } else if (!crouch && this.movementState.isCrouching) {
            // Verificar si hay espacio para levantarse
            this.movementState.isCrouching = false;
            this.playAnimation('stand');
        }
    }

    toggleAim(aiming) {
        this.movementState.isAiming = aiming;
        
        // Animación del viewmodel
        if (this.viewmodel) {
            const targetPos = aiming ? 
                new THREE.Vector3(0, -0.2, -0.3) : 
                new THREE.Vector3(0.3, -0.3, -0.5);
            
            this.viewmodel.position.lerp(targetPos, 0.1);
        }
        
        // Cambiar FOV
        const targetFOV = aiming ? 50 : 75;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.1);
        this.camera.updateProjectionMatrix();
    }

    fireWeapon() {
        if (!this.currentWeapon || this.movementState.isReloading) return;
        
        const result = this.currentWeapon.fire();
        if (result.success) {
            // Retroceso
            this.applyRecoil();
            
            // Proyectil
            const muzzlePos = new THREE.Vector3();
            if (this.viewmodel) {
                // Obtener posición del cañón del arma
                this.viewmodel.getWorldPosition(muzzlePos);
                muzzlePos.add(new THREE.Vector3(0, 0, -1));
            }
            
            const direction = new THREE.Vector3(0, 0, -1);
            direction.applyQuaternion(this.camera.quaternion);
            
            // Dispersión
            const spread = this.currentWeapon.getSpread(this.movementState);
            direction.x += (Math.random() - 0.5) * spread;
            direction.y += (Math.random() - 0.5) * spread;
            direction.normalize();
            
            this.engine.fireProjectile(this.currentWeapon.data, muzzlePos, direction);
            
            // Efectos
            this.playMuzzleFlash();
            this.playFireSound();
        }
    }

    applyRecoil() {
        if (!this.currentWeapon) return;
        
        const recoil = this.currentWeapon.data.recoil;
        
        // Rotación de cámara (retroceso visual)
        this.rotation.x -= recoil.vertical * (Math.random() * 0.5 + 0.5);
        this.rotation.y += (Math.random() - 0.5) * recoil.horizontal;
        
        // Movimiento del viewmodel
        if (this.viewmodel) {
            this.viewmodel.position.z += recoil.kickback;
        }
    }

    reloadWeapon() {
        if (!this.currentWeapon || this.movementState.isReloading) return;
        
        this.movementState.isReloading = true;
        this.playAnimation('reload');
        
        setTimeout(() => {
            this.currentWeapon.reload();
            this.movementState.isReloading = false;
        }, this.currentWeapon.data.reloadTime * 1000);
    }

    switchWeapon(slot) {
        if (this.weapons[slot] && this.weapons[slot] !== this.currentWeapon) {
            this.currentWeapon = this.weapons[slot];
            this.updateViewmodel();
        }
    }

    updateViewmodel() {
        // Limpiar viewmodel actual
        while(this.viewmodel.children.length > 0){ 
            this.viewmodel.remove(this.viewmodel.children[0]); 
        }
        
        if (this.currentWeapon && this.currentWeapon.model) {
            this.viewmodel.add(this.currentWeapon.model);
        }
    }

    takeDamage(amount, hitbox, attacker) {
        if (!this.isAlive) return;
        
        const multiplier = this.hitboxes[hitbox]?.damage || 1.0;
        const finalDamage = amount * multiplier;
        
        // Aplicar a armadura primero
        if (this.armor > 0) {
            const armorAbsorb = Math.min(this.armor, finalDamage * 0.5);
            this.armor -= armorAbsorb;
            this.health -= (finalDamage - armorAbsorb);
        } else {
            this.health -= finalDamage;
        }
        
        // Efectos de daño
        this.playDamageEffect(hitbox);
        
        if (this.health <= 0) {
            this.die(attacker);
        }
    }

    die(killer) {
        this.isAlive = false;
        this.playAnimation('death');
        
        // Evento de muerte
        this.engine.network?.send('playerDeath', {
            victim: this.id,
            killer: killer?.id,
            weapon: killer?.currentWeapon?.id
        });
        
        // Respawn
        setTimeout(() => this.respawn(), 3000);
    }

    respawn() {
        this.health = this.maxHealth;
        this.isAlive = true;
        this.position.set(
            (Math.random() - 0.5) * 100,
            10,
            (Math.random() - 0.5) * 100
        );
        this.velocity.set(0, 0, 0);
    }

    // Red: Interpolación para jugadores remotos
    updateRemote(deltaTime) {
        if (this.interpolationBuffer.length < 2) return;
        
        // Interpolación entre snapshots
        const now = Date.now();
        const renderTime = now - 100; // 100ms de delay para interpolación
        
        // Encontrar snapshots para interpolar
        let from = null, to = null;
        for (let i = 0; i < this.interpolationBuffer.length - 1; i++) {
            if (this.interpolationBuffer[i].timestamp <= renderTime &&
                this.interpolationBuffer[i + 1].timestamp >= renderTime) {
                from = this.interpolationBuffer[i];
                to = this.interpolationBuffer[i + 1];
                break;
            }
        }
        
        if (from && to) {
            const t = (renderTime - from.timestamp) / (to.timestamp - from.timestamp);
            
            this.position.lerpVectors(from.position, to.position, t);
            this.rotation.x = THREE.MathUtils.lerp(from.rotation.x, to.rotation.x, t);
            this.rotation.y = THREE.MathUtils.lerp(from.rotation.y, to.rotation.y, t);
            
            this.mesh.position.copy(this.position);
            this.mesh.rotation.y = this.rotation.y;
        }
    }

    syncToNetwork() {
        const now = Date.now();
        if (now - this.lastUpdate < 50) return; // 20 updates/segundo
        
        this.engine.network?.send('playerUpdate', {
            id: this.id,
            position: this.position.toArray(),
            rotation: [this.rotation.x, this.rotation.y],
            velocity: this.velocity.toArray(),
            health: this.health,
            timestamp: now
        });
        
        this.lastUpdate = now;
    }

    receiveSnapshot(data) {
        this.interpolationBuffer.push({
            timestamp: data.timestamp,
            position: new THREE.Vector3(...data.position),
            rotation: { x: data.rotation[0], y: data.rotation[1] }
        });
        
        // Limpiar buffer antiguo
        const cutoff = Date.now() - 1000;
        this.interpolationBuffer = this.interpolationBuffer.filter(s => s.timestamp > cutoff);
    }

    // Utilidades
    playAnimation(name) {
        // Sistema de animaciones
    }

    playMuzzleFlash() {
        // Efecto visual de disparo
    }

    playFireSound() {
        // Audio posicional
    }

    playDamageEffect(hitbox) {
        // Pantalla roja, sonido, etc
    }

    createNameTag() {
        // Canvas con nombre sobre el jugador
    }
}

export default Player;