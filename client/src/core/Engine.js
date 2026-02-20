/**
 * WARFRONT: EXODUS - Core Engine
 * Sistema de renderizado 3D con Three.js
 * Optimizado para 60 FPS en múltiples plataformas
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

class GameEngine {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.clock = new THREE.Clock();
        this.deltaTime = 0;
        this.isRunning = false;
        
        // Sistemas
        this.physics = null;
        this.input = null;
        this.audio = null;
        this.network = null;
        
        // Entidades
        this.localPlayer = null;
        this.remotePlayers = new Map();
        this.projectiles = [];
        this.vehicles = [];
        
        // Configuración de calidad
        this.qualitySettings = {
            shadows: true,
            bloom: true,
            antialias: true,
            drawDistance: 1000,
            particleCount: 'high'
        };
        
        // Rendimiento
        this.stats = {
            fps: 0,
            ping: 0,
            memory: 0
        };
    }

    async initialize(containerId) {
        const container = document.getElementById(containerId);
        
        // Escena principal
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050510);
        this.scene.fog = new THREE.FogExp2(0x050510, 0.002);
        
        // Cámara FPS
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            2000
        );
        
        // Renderer WebGL optimizado
        this.renderer = new THREE.WebGLRenderer({
            antialias: this.qualitySettings.antialias,
            powerPreference: "high-performance",
            stencil: false,
            depth: true
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        container.appendChild(this.renderer.domElement);
        
        // Post-procesamiento
        this.setupPostProcessing();
        
        // Iluminación del planeta alienígena
        this.setupAlienLighting();
        
        // Eventos
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Loop principal
        this.isRunning = true;
        this.animate();
        
        return this;
    }

    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        
        // Render pass
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        // Bloom para efectos de energía y luces
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.5,  // strength
            0.4,  // radius
            0.85  // threshold
        );
        this.composer.addPass(bloomPass);
    }

    setupAlienLighting() {
        // Luz ambiental tenue (planeta lejano del sol)
        const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.3);
        this.scene.add(ambientLight);
        
        // Sol azul del planeta
        const sunLight = new THREE.DirectionalLight(0x4a90e2, 1.2);
        sunLight.position.set(100, 200, 100);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.bias = -0.001;
        this.scene.add(sunLight);
        
        // Luna roja cercana
        const moonLight = new THREE.DirectionalLight(0xff4444, 0.4);
        moonLight.position.set(-100, 50, -100);
        this.scene.add(moonLight);
        
        // Nebulosa ambiental (luces puntuales)
        for (let i = 0; i < 5; i++) {
            const nebulaLight = new THREE.PointLight(
                new THREE.Color().setHSL(Math.random(), 0.5, 0.5),
                0.5,
                200
            );
            nebulaLight.position.set(
                (Math.random() - 0.5) * 400,
                Math.random() * 100,
                (Math.random() - 0.5) * 400
            );
            this.scene.add(nebulaLight);
        }
    }

    createAlienSkybox() {
        // Crear cielo con múltiples lunas y planetas
        const skyGeometry = new THREE.SphereGeometry(1500, 32, 32);
        
        // Shader personalizado para cielo alienígena
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                sunPosition: { value: new THREE.Vector3(100, 200, 100) },
                moonPositions: { value: [
                    new THREE.Vector3(-200, 100, -300),
                    new THREE.Vector3(300, 150, -200),
                    new THREE.Vector3(0, 250, 400)
                ]},
                nebulaColor: { value: new THREE.Color(0x2d1b4e) }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 sunPosition;
                uniform vec3 moonPositions[3];
                uniform vec3 nebulaColor;
                varying vec3 vWorldPosition;
                
                // Función de ruido simple
                float random(vec3 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }
                
                void main() {
                    vec3 viewDirection = normalize(vWorldPosition);
                    float sunDot = dot(viewDirection, normalize(sunPosition));
                    
                    // Gradiente atmosférico
                    vec3 atmosphere = mix(
                        vec3(0.05, 0.05, 0.1),
                        vec3(0.1, 0.15, 0.3),
                        max(0.0, viewDirection.y)
                    );
                    
                    // Sol con halo
                    float sunIntensity = pow(max(0.0, sunDot), 256.0);
                    vec3 sunColor = vec3(0.8, 0.9, 1.0) * sunIntensity;
                    
                    // Estrellas
                    float stars = pow(random(floor(viewDirection * 500.0)), 20.0) * 0.8;
                    
                    // Nebulosa
                    float nebula = sin(viewDirection.x * 3.0 + time * 0.1) * 
                                  cos(viewDirection.y * 2.0) * 0.1 + 0.1;
                    
                    gl_FragColor = vec4(atmosphere + sunColor + stars + nebula * nebulaColor, 1.0);
                }
            `,
            side: THREE.BackSide
        });
        
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
        this.skyMaterial = skyMaterial;
        
        // Añadir lunas visibles
        this.createVisibleMoons();
        // Añadir planetas en el cielo
        this.createDistantPlanets();
    }

    createVisibleMoons() {
        const moonGeometry = new THREE.SphereGeometry(10, 32, 32);
        
        // Luna 1: Roja, cercana
        const moon1 = new THREE.Mesh(
            moonGeometry,
            new THREE.MeshStandardMaterial({
                color: 0x8b0000,
                emissive: 0x330000,
                roughness: 0.9
            })
        );
        moon1.position.set(-200, 100, -300);
        this.scene.add(moon1);
        
        // Luna 2: Verde, lejana
        const moon2 = new THREE.Mesh(
            moonGeometry,
            new THREE.MeshStandardMaterial({
                color: 0x006400,
                emissive: 0x002200,
                roughness: 0.8
            })
        );
        moon2.position.set(300, 150, -200);
        moon2.scale.set(0.7, 0.7, 0.7);
        this.scene.add(moon2);
        
        // Luna 3: Azul hielo, muy lejana
        const moon3 = new THREE.Mesh(
            moonGeometry,
            new THREE.MeshStandardMaterial({
                color: 0x4682b4,
                emissive: 0x112244,
                roughness: 0.7
            })
        );
        moon3.position.set(0, 250, 400);
        moon3.scale.set(0.4, 0.4, 0.4);
        this.scene.add(moon3);
    }

    createDistantPlanets() {
        // Planeta gigante con anillos
        const planetGeometry = new THREE.SphereGeometry(30, 32, 32);
        const planetMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0x332200,
            roughness: 0.6
        });
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);
        planet.position.set(500, 300, -800);
        this.scene.add(planet);
        
        // Anillos
        const ringGeometry = new THREE.RingGeometry(40, 60, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6
        });
        const rings = new THREE.Mesh(ringGeometry, ringMaterial);
        rings.position.copy(planet.position);
        rings.rotation.x = Math.PI / 3;
        this.scene.add(rings);
    }

    animate() {
        if (!this.isRunning) return;
        
        requestAnimationFrame(() => this.animate());
        
        this.deltaTime = Math.min(this.clock.getDelta(), 0.1); // Cap delta time
        
        // Actualizar shader del cielo
        if (this.skyMaterial) {
            this.skyMaterial.uniforms.time.value = this.clock.getElapsedTime();
        }
        
        // Actualizar sistemas
        if (this.physics) this.physics.update(this.deltaTime);
        if (this.localPlayer) this.localPlayer.update(this.deltaTime);
        
        // Interpolar jugadores remotos
        this.remotePlayers.forEach(player => player.interpolate(this.deltaTime));
        
        // Actualizar proyectiles
        this.updateProjectiles();
        
        // Renderizado
        if (this.qualitySettings.bloom) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
        
        // Actualizar FPS
        this.stats.fps = Math.round(1 / this.deltaTime);
    }

    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            projectile.update(this.deltaTime);
            
            // Colisión
            if (projectile.checkCollision()) {
                projectile.onImpact();
                this.projectiles.splice(i, 1);
            }
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    // Métodos de entidades
    spawnLocalPlayer(data) {
        // Implementado en Player.js
    }

    addRemotePlayer(id, data) {
        // Implementado en Player.js
    }

    removeRemotePlayer(id) {
        if (this.remotePlayers.has(id)) {
            const player = this.remotePlayers.get(id);
            this.scene.remove(player.mesh);
            this.remotePlayers.delete(id);
        }
    }

    fireProjectile(weaponData, origin, direction) {
        const projectile = new Projectile(weaponData, origin, direction);
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
    }

    dispose() {
        this.isRunning = false;
        this.renderer.dispose();
        this.scene.clear();
    }
}

export default GameEngine;