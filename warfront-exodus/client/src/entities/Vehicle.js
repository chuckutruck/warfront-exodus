/**
 * WARFRONT: EXODUS - Vehicle System
 * Vehículos terrestres con física realista, daño por partes y control
 */

import * as THREE from 'three';

class Vehicle {
    constructor(engine, type = 'jeep') {
        this.engine = engine;
        this.type = type;
        this.id = Math.random().toString(36).substr(2, 9);
        
        // Física
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.rotation = new THREE.Euler();
        this.angularVelocity = new THREE.Vector3();
        
        // Configuración por tipo
        this.config = this.getVehicleConfig(type);
        
        // Estado
        this.health = 100;
        this.maxHealth = 100;
        this.isDestroyed = false;
        this.engineOn = false;
        this.speed = 0;
        this.gear = 0; // -1 reversa, 0 neutral, 1-5 adelante
        
        // Componentes dañables
        this.parts = {
            engine: { health: 100, functional: true },
            transmission: { health: 100, functional: true },
            wheels: [
                { health: 100, functional: true, steering: true, powered: true }, // FL
                { health: 100, functional: true, steering: true, powered: true }, // FR
                { health: 100, functional: true, steering: false, powered: true }, // RL
                { health: 100, functional: true, steering: false, powered: true }  // RR
            ],
            fuelTank: { health: 100, functional: true, fuel: 100 }
        };
        
        // Ocupantes
        this.driver = null;
        this.passengers = [];
        this.maxPassengers = this.config.seats - 1;
        
        // Visual
        this.mesh = null;
        this.wheelMeshes = [];
        this.createMesh();
        
        // Input
        this.input = {
            throttle: 0, // -1 a 1
            steering: 0, // -1 a 1
            brake: 0,
            handbrake: false
        };
    }

    getVehicleConfig(type) {
        const configs = {
            jeep: {
                mass: 1500,
                maxSpeed: 35,
                acceleration: 8,
                braking: 15,
                turnSpeed: 2.5,
                seats: 4,
                armor: 0.3,
                offroad: true,
                width: 2,
                length: 4,
                height: 1.8
            },
            tank: {
                mass: 45000,
                maxSpeed: 15,
                acceleration: 3,
                braking: 10,
                turnSpeed: 1.0,
                seats: 3,
                armor: 0.9,
                offroad: true,
                width: 3.5,
                length: 7,
                height: 2.5,
                turret: true,
                cannonDamage: 150
            },
            hoverbike: {
                mass: 300,
                maxSpeed: 80,
                acceleration: 15,
                braking: 20,
                turnSpeed: 4,
                seats: 1,
                armor: 0.1,
                offroad: true,
                hoverHeight: 2,
                width: 1,
                length: 2.5,
                height: 1
            },
            apc: {
                mass: 12000,
                maxSpeed: 25,
                acceleration: 5,
                braking: 12,
                turnSpeed: 1.8,
                seats: 8,
                armor: 0.7,
                offroad: true,
                width: 3,
                length: 6,
                height: 2.2
            }
        };
        
        return configs[type] || configs.jeep;
    }

    createMesh() {
        this.mesh = new THREE.Group();
        
        // Chasis
        const chassisGeo = new THREE.BoxGeometry(
            this.config.width,
            this.config.height,
            this.config.length
        );
        const chassisMat = new THREE.MeshStandardMaterial({ 
            color: this.getVehicleColor(),
            roughness: 0.7,
            metalness: 0.3
        });
        const chassis = new THREE.Mesh(chassisGeo, chassisMat);
        chassis.position.y = this.config.height / 2 + 0.5;
        chassis.castShadow = true;
        this.mesh.add(chassis);
        
        // Cabina (visual)
        const cabinGeo = new THREE.BoxGeometry(
            this.config.width * 0.8,
            this.config.height * 0.6,
            this.config.length * 0.4
        );
        const cabin = new THREE.Mesh(cabinGeo, chassisMat);
        cabin.position.set(0, this.config.height + 0.3, -0.5);
        cabin.castShadow = true;
        this.mesh.add(cabin);
        
        // Ruedas
        const wheelRadius = 0.4;
        const wheelWidth = 0.3;
        const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
        
        const wheelPositions = [
            { x: -this.config.width/2, y: wheelRadius, z: this.config.length/3 },   // FL
            { x: this.config.width/2, y: wheelRadius, z: this.config.length/3 },    // FR
            { x: -this.config.width/2, y: wheelRadius, z: -this.config.length/3 },  // RL
            { x: this.config.width/2, y: wheelRadius, z: -this.config.length/3 }    // RR
        ];
        
        wheelPositions.forEach((pos, i) => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.castShadow = true;
            
            this.mesh.add(wheel);
            this.wheelMeshes.push(wheel);
        });
        
        // Luces
        const headlightGeo = new THREE.BoxGeometry(0.3, 0.2, 0.1);
        const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
        
        const leftLight = new THREE.Mesh(headlightGeo, headlightMat);
        leftLight.position.set(-0.6, this.config.height/2 + 0.5, this.config.length/2);
        this.mesh.add(leftLight);
        
        const rightLight = new THREE.Mesh(headlightGeo, headlightMat);
        rightLight.position.set(0.6, this.config.height/2 + 0.5, this.config.length/2);
        this.mesh.add(rightLight);
        
        // Focos de luz
        this.headlights = new THREE.SpotLight(0xffffaa, 1, 50, Math.PI / 6, 0.5);
        this.headlights.position.set(0, this.config.height, this.config.length/2);
        this.headlights.target.position.set(0, 0, 20);
        this.mesh.add(this.headlights);
        this.mesh.add(this.headlights.target);
        
        this.engine.scene.add(this.mesh);
    }

    getVehicleColor() {
        const colors = {
            jeep: 0x4a5d23,
            tank: 0x3d4a2c,
            hoverbike: 0x2a3d5c,
            apc: 0x4a4a4a
        };
        return colors[this.type] || 0x666666;
    }

    update(deltaTime) {
        if (this.isDestroyed) return;
        
        // Actualizar física
        this.updatePhysics(deltaTime);
        
        // Actualizar visual
        this.updateVisuals();
        
        // Verificar destrucción
        if (this.health <= 0) {
            this.destroy();
        }
    }

    updatePhysics(deltaTime) {
        if (!this.driver || !this.engineOn) {
            // Fricción cuando no hay conductor
            this.velocity.multiplyScalar(0.95);
            return;
        }
        
        // Dirección basada en rotación
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            this.rotation.y
        );
        
        // Aceleración
        let targetSpeed = this.input.throttle * this.config.maxSpeed;
        
        // Modificadores por daño
        if (!this.parts.engine.functional) targetSpeed *= 0.3;
        
        // Aplicar fuerza
        const speedDiff = targetSpeed - this.speed;
        const acceleration = speedDiff > 0 ? this.config.acceleration : this.config.braking;
        
        this.speed += Math.sign(speedDiff) * acceleration * deltaTime;
        this.speed = THREE.MathUtils.clamp(this.speed, -this.config.maxSpeed/3, this.config.maxSpeed);
        
        // Dirección
        if (Math.abs(this.speed) > 0.1) {
            const turnAmount = this.input.steering * this.config.turnSpeed * deltaTime;
            
            // Solo ruedas delanteras giran visualmente
            this.wheelMeshes[0].rotation.y = turnAmount * 0.5;
            this.wheelMeshes[1].rotation.y = turnAmount * 0.5;
            
            // Giro real del vehículo
            this.rotation.y += turnAmount * Math.sign(this.speed);
        }
        
        // Frenado
        if (this.input.brake > 0) {
            this.speed *= (1 - this.input.brake * this.config.braking * deltaTime);
        }
        
        if (this.input.handbrake) {
            this.speed *= 0.9;
        }
        
        // Velocidad angular (derrape)
        this.angularVelocity.y = this.input.steering * this.speed * 0.1;
        
        // Actualizar velocidad lineal
        this.velocity.copy(forward).multiplyScalar(this.speed);
        
        // Hover para hoverbike
        if (this.type === 'hoverbike') {
            this.updateHover(deltaTime);
        }
        
        // Aplicar movimiento
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Colisión con terreno
        this.groundCollision();
        
        // Consumo de combustible
        if (Math.abs(this.speed) > 0.1) {
            this.parts.fuelTank.fuel -= deltaTime * 0.5;
            if (this.parts.fuelTank.fuel <= 0) {
                this.engineOn = false;
            }
        }
    }

    updateHover(deltaTime) {
        // Raycast hacia abajo para mantener altura
        const targetHeight = this.config.hoverHeight;
        const currentHeight = this.position.y;
        
        const diff = targetHeight - currentHeight;
        this.velocity.y += diff * 10 * deltaTime;
        this.velocity.y *= 0.9; // Amortiguación
    }

    groundCollision() {
        // Simple: mantener sobre suelo
        if (this.position.y < 0.5) {
            this.position.y = 0.5;
            this.velocity.y = 0;
        }
    }

    updateVisuals() {
        if (!this.mesh) return;
        
        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation.y;
        
        // Animar ruedas
        const wheelCircumference = 2 * Math.PI * 0.4;
        const rotationSpeed = this.speed / wheelCircumference;
        
        this.wheelMeshes.forEach(wheel => {
            wheel.rotation.x += rotationSpeed * 0.016;
        });
        
        // Cabeceo según aceleración/frenado
        this.mesh.rotation.x = -this.input.throttle * 0.05;
        this.mesh.rotation.z = -this.input.steering * this.speed * 0.01;
    }

    // Entrar al vehículo
    enter(player, seat = 'driver') {
        if (seat === 'driver' && this.driver) return false;
        if (seat !== 'driver' && this.passengers.length >= this.maxPassengers) return false;
        
        if (seat === 'driver') {
            this.driver = player;
            this.engineOn = true;
        } else {
            this.passengers.push(player);
        }
        
        // Teletransportar jugador a posición del asiento
        player.vehicle = this;
        player.inVehicle = true;
        
        return true;
    }

    // Salir del vehículo
    exit(player) {
        if (this.driver === player) {
            this.driver = null;
            this.engineOn = false;
            this.input.throttle = 0;
            this.input.steering = 0;
        } else {
            this.passengers = this.passengers.filter(p => p !== player);
        }
        
        player.vehicle = null;
        player.inVehicle = false;
        
        // Posición de salida
        player.position.copy(this.position);
        player.position.x += this.config.width;
        
        return true;
    }

    // Aplicar daño
    takeDamage(amount, hitPoint, hitDirection) {
        // Reducir por armadura
        const actualDamage = amount * (1 - this.config.armor);
        this.health -= actualDamage;
        
        // Daño a partes específicas
        this.damagePart(hitPoint, amount);
        
        // Efectos visuales
        this.spawnDamageEffect(hitPoint, hitDirection);
        
        // Daño a ocupantes
        const occupantDamage = amount * 0.3;
        if (this.driver) this.driver.takeDamage(occupantDamage);
        this.passengers.forEach(p => p.takeDamage(occupantDamage));
    }

    damagePart(hitPoint, damage) {
        // Determinar qué parte fue golpeada
        const localPoint = this.mesh.worldToLocal(hitPoint.clone());
        
        // Motor (frontal)
        if (localPoint.z > this.config.length * 0.3) {
            this.parts.engine.health -= damage;
            if (this.parts.engine.health <= 0) {
                this.parts.engine.functional = false;
                this.engineOn = false;
            }
        }
        // Combustible (trasero)
        else if (localPoint.z < -this.config.length * 0.3) {
            this.parts.fuelTank.health -= damage;
            if (this.parts.fuelTank.health <= 0 && this.parts.fuelTank.functional) {
                this.parts.fuelTank.functional = false;
                this.explode();
            }
        }
        // Ruedas
        else {
            const wheelIndex = this.getClosestWheel(localPoint);
            if (wheelIndex >= 0) {
                this.parts.wheels[wheelIndex].health -= damage;
                if (this.parts.wheels[wheelIndex].health <= 0) {
                    this.parts.wheels[wheelIndex].functional = false;
                }
            }
        }
    }

    getClosestWheel(localPoint) {
        const wheelZ = [this.config.length/3, this.config.length/3, -this.config.length/3, -this.config.length/3];
        const wheelX = [-this.config.width/2, this.config.width/2, -this.config.width/2, this.config.width/2];
        
        let closest = -1;
        let minDist = Infinity;
        
        for (let i = 0; i < 4; i++) {
            const dist = Math.sqrt(
                Math.pow(localPoint.x - wheelX[i], 2) +
                Math.pow(localPoint.z - wheelZ[i], 2)
            );
            if (dist < minDist) {
                minDist = dist;
                closest = i;
            }
        }
        
        return minDist < 1 ? closest : -1;
    }

    spawnDamageEffect(position, direction) {
        // Chispas
        for (let i = 0; i < 10; i++) {
            const spark = new THREE.Mesh(
                new THREE.BoxGeometry(0.05, 0.05, 0.05),
                new THREE.MeshBasicMaterial({ color: 0xffaa00 })
            );
            
            spark.position.copy(position);
            spark.position.add(new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ));
            
            this.engine.scene.add(spark);
            
            // Animar
            const velocity = direction.clone().multiplyScalar(5).add(
                new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    Math.random() * 5,
                    (Math.random() - 0.5) * 5
                )
            );
            
            const startTime = Date.now();
            const animate = () => {
                const elapsed = (Date.now() - startTime) / 1000;
                if (elapsed > 0.5) {
                    spark.parent.remove(spark);
                    return;
                }
                
                spark.position.add(velocity.clone().multiplyScalar(0.016));
                velocity.y -= 9.81 * 0.016;
                
                requestAnimationFrame(animate);
            };
            
            animate();
        }
    }

    explode() {
        // Explosión grande
        const explosion = new THREE.Mesh(
            new THREE.SphereGeometry(5, 16, 16),
            new THREE.MeshBasicMaterial({
                color: 0xff4400,
                transparent: true,
                opacity: 0.8
            })
        );
        explosion.position.copy(this.position);
        this.engine.scene.add(explosion);
        
        // Daño en área
        this.engine.damageSystem?.applyAreaDamage(
            this.position,
            10,
            100,
            this.driver || { team: 'neutral' },
            'vehicle_explosion'
        );
        
        // Destruir vehículo
        this.destroy();
        
        // Animar explosión
        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 1) {
                explosion.parent.remove(explosion);
                return;
            }
            
            explosion.scale.setScalar(1 + elapsed * 5);
            explosion.material.opacity = 0.8 * (1 - elapsed);
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    destroy() {
        this.isDestroyed = true;
        this.engineOn = false;
        
        // Expulsar ocupantes
        if (this.driver) this.exit(this.driver);
        [...this.passengers].forEach(p => this.exit(p));
        
        // Cambiar apariencia
        this.mesh.children.forEach(child => {
            if (child.material) {
                child.material.color.setHex(0x333333);
                child.material.wireframe = true;
            }
        });
    }

    // Input del conductor
    setInput(throttle, steering, brake, handbrake) {
        this.input.throttle = THREE.MathUtils.clamp(throttle, -1, 1);
        this.input.steering = THREE.MathUtils.clamp(steering, -1, 1);
        this.input.brake = THREE.MathUtils.clamp(brake, 0, 1);
        this.input.handbrake = handbrake;
    }
}

export default Vehicle;