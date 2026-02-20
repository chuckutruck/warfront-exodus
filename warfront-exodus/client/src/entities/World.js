/**
 * WARFRONT: EXODUS - World System
 * Generación procedural de terreno, biomas, objetos del mundo
 */

import * as THREE from 'three';

class World {
    constructor(engine) {
        this.engine = engine;
        this.scene = engine.scene;
        
        // Configuración del mundo
        this.size = 1000;
        this.chunkSize = 100;
        this.chunks = new Map();
        this.activeChunks = new Set();
        
        // Biomas
        this.biomes = {
            wasteland: { color: 0x8b7355, roughness: 0.9, height: 0 },
            crystal: { color: 0x4a0080, roughness: 0.3, height: 5 },
            toxic: { color: 0x2d5016, roughness: 0.7, height: -2 },
            ruins: { color: 0x666666, roughness: 0.8, height: 2 }
        };
        
        // Objetos del mundo
        this.objects = [];
        this.coverPositions = [];
        this.spawnPoints = {
            alpha: [],
            bravo: []
        };
        
        // Navegación
        this.navGrid = null;
        this.gridResolution = 2; // metros por celda
        
        this.init();
    }

    init() {
        this.generateTerrain();
        this.generateSky();
        this.placeObjects();
        this.generateNavGrid();
    }

    generateTerrain() {
        // Geometría base del terreno
        const geometry = new THREE.PlaneGeometry(
            this.size,
            this.size,
            200,
            200
        );
        
        // Modificar vértices para crear relieve
        const positions = geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            
            // Ruido de múltiples octavas
            let height = 0;
            height += Math.sin(x * 0.01) * Math.cos(y * 0.01) * 5;
            height += Math.sin(x * 0.05) * Math.cos(y * 0.05) * 2;
            height += Math.random() * 0.5;
            
            // Cráteres
            const craterX = 100, craterY = -100;
            const distToCrater = Math.sqrt((x - craterX) ** 2 + (y - craterY) ** 2);
            if (distToCrater < 50) {
                height -= (50 - distToCrater) * 0.5;
            }
            
            positions[i + 2] = Math.max(-10, height);
        }
        
        geometry.computeVertexNormals();
        
        // Material del terreno
        const material = new THREE.MeshStandardMaterial({
            color: 0x8b7355,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true
        });
        
        // Textura procedural
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Ruido de terreno
        for (let i = 0; i < 50000; i++) {
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const gray = Math.random() * 50 + 100;
            ctx.fillStyle = `rgb(${gray}, ${gray * 0.8}, ${gray * 0.6})`;
            ctx.fillRect(x, y, 2, 2);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(20, 20);
        
        material.map = texture;
        
        this.terrain = new THREE.Mesh(geometry, material);
        this.terrain.rotation.x = -Math.PI / 2;
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);
        
        // Agua/lagos tóxicos
        this.createToxicLakes();
    }

    createToxicLakes() {
        const lakePositions = [
            { x: 100, z: -100, radius: 40 },
            { x: -150, z: 200, radius: 30 },
            { x: 300, z: 300, radius: 25 }
        ];
        
        lakePositions.forEach(lake => {
            const geometry = new THREE.CircleGeometry(lake.radius, 32);
            const material = new THREE.MeshStandardMaterial({
                color: 0x39ff14,
                emissive: 0x1a8008,
                emissiveIntensity: 0.5,
                roughness: 0.1,
                metalness: 0.8,
                transparent: true,
                opacity: 0.8
            });
            
            const water = new THREE.Mesh(geometry, material);
            water.rotation.x = -Math.PI / 2;
            water.position.set(lake.x, -2, lake.z);
            
            // Animación de ondas
            const animate = () => {
                const time = Date.now() * 0.001;
                water.position.y = -2 + Math.sin(time) * 0.2;
                requestAnimationFrame(animate);
            };
            animate();
            
            this.scene.add(water);
            
            // Daño por radiación
            this.objects.push({
                type: 'hazard',
                position: new THREE.Vector3(lake.x, 0, lake.z),
                radius: lake.radius,
                damage: 5,
                damageType: 'radiation'
            });
        });
    }

    generateSky() {
        // Cielo con gradiente
        const vertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `;
        
        const uniforms = {
            topColor: { value: new THREE.Color(0x0077ff) },
            bottomColor: { value: new THREE.Color(0x0a0a2e) },
            offset: { value: 33 },
            exponent: { value: 0.6 }
        };
        
        const skyGeo = new THREE.SphereGeometry(500, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms,
            side: THREE.BackSide
        });
        
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
        
        // Estrellas
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 3000;
        const posArray = new Float32Array(starsCount * 3);
        const colorArray = new Float32Array(starsCount * 3);
        
        for (let i = 0; i < starsCount; i++) {
            const i3 = i * 3;
            
            // Posición esférica
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 400 + Math.random() * 100;
            
            posArray[i3] = r * Math.sin(phi) * Math.cos(theta);
            posArray[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            posArray[i3 + 2] = r * Math.cos(phi);
            
            // Colores variados
            const starType = Math.random();
            if (starType > 0.9) { // Azul
                colorArray[i3] = 0.5;
                colorArray[i3 + 1] = 0.7;
                colorArray[i3 + 2] = 1;
            } else if (starType > 0.7) { // Rojo
                colorArray[i3] = 1;
                colorArray[i3 + 1] = 0.5;
                colorArray[i3 + 2] = 0.5;
            } else { // Blanco
                colorArray[i3] = 1;
                colorArray[i3 + 1] = 1;
                colorArray[i3 + 2] = 1;
            }
        }
        
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        starsGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
        
        const starsMaterial = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });
        
        this.stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(this.stars);
        
        // Nebulosas
        this.createNebula();
    }

    createNebula() {
        const nebulaGeo = new THREE.PlaneGeometry(200, 200);
        const nebulaMat = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        for (let i = 0; i < 5; i++) {
            const nebula = new THREE.Mesh(nebulaGeo, nebulaMat.clone());
            nebula.material.color.setHSL(Math.random(), 0.5, 0.5);
            nebula.position.set(
                (Math.random() - 0.5) * 600,
                100 + Math.random() * 200,
                (Math.random() - 0.5) * 600
            );
            nebula.rotation.x = Math.random() * Math.PI;
            nebula.rotation.y = Math.random() * Math.PI;
            this.scene.add(nebula);
        }
    }

    placeObjects() {
        // Rocas
        this.placeRocks(50);
        
        // Cristales alienígenas
        this.placeCrystals(30);
        
        // Estructuras ruinosas
        this.placeRuins(10);
        
        // Vegetación alienígena
        this.placeVegetation(40);
        
        // Cobertura táctica
        this.identifyCover();
        
        // Puntos de spawn
        this.placeSpawnPoints();
    }

    placeRocks(count) {
        const geometries = [
            new THREE.DodecahedronGeometry(1, 0),
            new THREE.IcosahedronGeometry(1, 0),
            new THREE.OctahedronGeometry(1, 0)
        ];
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x666666,
            roughness: 0.9,
            flatShading: true
        });
        
        for (let i = 0; i < count; i++) {
            const geo = geometries[Math.floor(Math.random() * geometries.length)];
            const rock = new THREE.Mesh(geo, material);
            
            const x = (Math.random() - 0.5) * this.size * 0.8;
            const z = (Math.random() - 0.5) * this.size * 0.8;
            const scale = 2 + Math.random() * 5;
            
            rock.position.set(x, scale * 0.5, z);
            rock.scale.setScalar(scale);
            rock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            rock.castShadow = true;
            rock.receiveShadow = true;
            
            this.scene.add(rock);
            this.objects.push({
                type: 'obstacle',
                mesh: rock,
                bounds: new THREE.Sphere(rock.position, scale)
            });
        }
    }

    placeCrystals(count) {
        const geometry = new THREE.ConeGeometry(1, 4, 6);
        
        for (let i = 0; i < count; i++) {
            const hue = Math.random() > 0.5 ? 0.8 : 0.5; // Púrpura o cian
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(hue, 1, 0.5),
                emissive: new THREE.Color().setHSL(hue, 1, 0.2),
                emissiveIntensity: 0.5,
                roughness: 0.2,
                metalness: 0.8,
                transparent: true,
                opacity: 0.9
            });
            
            const crystal = new THREE.Mesh(geometry, material);
            
            const x = (Math.random() - 0.5) * this.size * 0.6;
            const z = (Math.random() - 0.5) * this.size * 0.6;
            const scale = 3 + Math.random() * 8;
            
            crystal.position.set(x, scale * 1.5, z);
            crystal.scale.set(scale * 0.5, scale, scale * 0.5);
            crystal.rotation.y = Math.random() * Math.PI;
            
            // Luz pulsante
            const light = new THREE.PointLight(
                material.color,
                2,
                scale * 3
            );
            light.position.y = scale * 0.5;
            crystal.add(light);
            
            // Animación
            const baseIntensity = 2;
            const animate = () => {
                const time = Date.now() * 0.001;
                light.intensity = baseIntensity + Math.sin(time * 2) * 0.5;
                requestAnimationFrame(animate);
            };
            animate();
            
            crystal.castShadow = true;
            this.scene.add(crystal);
            
            this.objects.push({
                type: 'cover',
                mesh: crystal,
                protectionLevel: 0.6
            });
        }
    }

    placeRuins(count) {
        const material = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.9
        });
        
        for (let i = 0; i < count; i++) {
            const group = new THREE.Group();
            
            // Paredes
            for (let j = 0; j < 4; j++) {
                const wall = new THREE.Mesh(
                    new THREE.BoxGeometry(10, 8, 2),
                    material
                );
                wall.position.set(
                    (j % 2 === 0 ? 6 : 0) * (j < 2 ? 1 : -1),
                    4,
                    (j % 2 === 1 ? 6 : 0) * (j < 2 ? 1 : -1)
                );
                wall.rotation.y = j % 2 === 0 ? 0 : Math.PI / 2;
                wall.castShadow = true;
                group.add(wall);
            }
            
            group.position.set(
                (Math.random() - 0.5) * this.size * 0.7,
                0,
                (Math.random() - 0.5) * this.size * 0.7
            );
            
            this.scene.add(group);
            
            this.objects.push({
                type: 'cover',
                mesh: group,
                protectionLevel: 0.9
            });
        }
    }

    placeVegetation(count) {
        const material = new THREE.MeshStandardMaterial({
            color: 0x2d5016,
            roughness: 0.8
        });
        
        for (let i = 0; i < count; i++) {
            const group = new THREE.Group();
            
            // Tallos
            for (let j = 0; j < 5; j++) {
                const stem = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.1, 0.2, 3, 8),
                    material
                );
                stem.position.set(
                    (Math.random() - 0.5) * 2,
                    1.5,
                    (Math.random() - 0.5) * 2
                );
                stem.rotation.z = (Math.random() - 0.5) * 0.3;
                group.add(stem);
                
                // Copa
                const top = new THREE.Mesh(
                    new THREE.SphereGeometry(0.8, 8, 8),
                    new THREE.MeshStandardMaterial({
                        color: 0x39ff14,
                        emissive: 0x1a8008,
                        emissiveIntensity: 0.3
                    })
                );
                top.position.copy(stem.position);
                top.position.y += 1.5;
                group.add(top);
            }
            
            group.position.set(
                (Math.random() - 0.5) * this.size * 0.8,
                0,
                (Math.random() - 0.5) * this.size * 0.8
            );
            
            this.scene.add(group);
        }
    }

    identifyCover() {
        // Identificar posiciones de cobertura para IA
        this.objects.forEach(obj => {
            if (obj.type === 'cover') {
                // Posiciones alrededor del objeto
                for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                    const offset = 3;
                    const coverPos = new THREE.Vector3(
                        obj.mesh.position.x + Math.cos(angle) * offset,
                        0,
                        obj.mesh.position.z + Math.sin(angle) * offset
                    );
                    
                    this.coverPositions.push({
                        position: coverPos,
                        normal: new THREE.Vector3(-Math.cos(angle), 0, -Math.sin(angle)),
                        protectionLevel: obj.protectionLevel
                    });
                }
            }
        });
    }

    placeSpawnPoints() {
        // Puntos de spawn para equipos
        const spawnConfigs = [
            { team: 'alpha', x: -200, z: 0 },
            { team: 'alpha', x: -180, z: 50 },
            { team: 'bravo', x: 200, z: 0 },
            { team: 'bravo', x: 180, z: -50 }
        ];
        
        spawnConfigs.forEach(config => {
            const marker = new THREE.Mesh(
                new THREE.ConeGeometry(2, 4, 4),
                new THREE.MeshBasicMaterial({
                    color: config.team === 'alpha' ? 0x00aaff : 0xff4444,
                    transparent: true,
                    opacity: 0.5
                })
            );
            marker.position.set(config.x, 2, config.z);
            this.scene.add(marker);
            
            this.spawnPoints[config.team].push({
                position: new THREE.Vector3(config.x, 2, config.z),
                rotation: config.team === 'alpha' ? 0 : Math.PI
            });
        });
    }

    generateNavGrid() {
        // Grid de navegación para IA
        const size = Math.ceil(this.size / this.gridResolution);
        this.navGrid = {
            size: size,
            resolution: this.gridResolution,
            cells: new Array(size * size).fill(0)
        };
        
        // Marcar obstáculos
        this.objects.forEach(obj => {
            if (obj.type === 'obstacle' || obj.type === 'cover') {
                const gx = Math.floor((obj.mesh.position.x + this.size/2) / this.gridResolution);
                const gz = Math.floor((obj.mesh.position.z + this.size/2) / this.gridResolution);
                const radius = Math.ceil((obj.bounds?.radius || 3) / this.gridResolution);
                
                for (let dx = -radius; dx <= radius; dx++) {
                    for (let dz = -radius; dz <= radius; dz++) {
                        const idx = (gz + dz) * size + (gx + dx);
                        if (idx >= 0 && idx < size * size) {
                            this.navGrid.cells[idx] = 1; // Bloqueado
                        }
                    }
                }
            }
        });
    }

    // Obtener altura del terreno en posición
    getHeightAt(x, z) {
        // Interpolación simple
        const y1 = Math.sin(x * 0.01) * Math.cos(z * 0.01) * 5;
        const y2 = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2;
        return Math.max(-10, y1 + y2);
    }

    // Obtener cobertura cercana
    getNearbyCover(position, radius) {
        return this.coverPositions.filter(cover => 
            cover.position.distanceTo(position) <= radius
        );
    }

    // Verificar si posición es válida
    isValidPosition(position, radius = 1) {
        // Dentro de límites
        if (Math.abs(position.x) > this.size/2 || Math.abs(position.z) > this.size/2) {
            return false;
        }
        
        // No en obstáculo
        const gx = Math.floor((position.x + this.size/2) / this.gridResolution);
        const gz = Math.floor((position.z + this.size/2) / this.gridResolution);
        const idx = gz * this.navGrid.size + gx;
        
        return this.navGrid.cells[idx] === 0;
    }

    // Raycast contra terreno
    raycastTerrain(origin, direction) {
        // Simplificado: intersección con plano aproximado
        const t = -origin.y / direction.y;
        if (t > 0) {
            const hit = origin.clone().add(direction.clone().multiplyScalar(t));
            hit.y = this.getHeightAt(hit.x, hit.z);
            return hit;
        }
        return null;
    }

    update(deltaTime) {
        // Rotar estrellas lentamente
        if (this.stars) {
            this.stars.rotation.y += 0.0001;
        }
    }
}

export default World;