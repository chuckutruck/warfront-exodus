/**
 * WARFRONT: EXODUS - Asset Loader
 * Carga de modelos 3D, texturas, shaders con gestión de caché
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { TextureLoader } from 'three';

class AssetLoader {
    constructor(engine) {
        this.engine = engine;
        this.cache = new Map();
        this.loadingQueue = [];
        this.isLoading = false;
        
        // Loaders
        this.textureLoader = new TextureLoader();
        this.gltfLoader = new GLTFLoader();
        
        // DRACO para compresión
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        this.gltfLoader.setDRACOLoader(dracoLoader);
        
        // Progreso
        this.totalAssets = 0;
        this.loadedAssets = 0;
        
        // Callbacks
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
    }

    // Precargar assets esenciales
    async preloadEssential() {
        const essentialAssets = [
            { type: 'texture', name: 'crosshair', url: 'assets/textures/crosshair.png' },
            { type: 'texture', name: 'noise', url: 'assets/textures/noise.png' },
            { type: 'model', name: 'player', url: 'assets/models/player.glb' },
            { type: 'model', name: 'weapon_ar', url: 'assets/models/weapons/ar_76.glb' }
        ];
        
        return this.loadBatch(essentialAssets);
    }

    // Cargar lote de assets
    async loadBatch(assets) {
        this.totalAssets = assets.length;
        this.loadedAssets = 0;
        
        const promises = assets.map(asset => this.load(asset));
        
        try {
            const results = await Promise.all(promises);
            return results;
        } catch (error) {
            console.error('Error cargando batch:', error);
            throw error;
        }
    }

    // Cargar asset individual
    async load(asset) {
        // Verificar caché
        if (this.cache.has(asset.name)) {
            return this.cache.get(asset.name);
        }
        
        try {
            let result;
            
            switch(asset.type) {
                case 'texture':
                    result = await this.loadTexture(asset.url);
                    break;
                case 'model':
                    result = await this.loadModel(asset.url);
                    break;
                case 'audio':
                    result = await this.loadAudio(asset.url);
                    break;
                case 'shader':
                    result = await this.loadShader(asset.url);
                    break;
                case 'json':
                    result = await this.loadJSON(asset.url);
                    break;
                default:
                    throw new Error(`Tipo de asset desconocido: ${asset.type}`);
            }
            
            // Guardar en caché
            this.cache.set(asset.name, result);
            this.loadedAssets++;
            
            // Notificar progreso
            if (this.onProgress) {
                this.onProgress({
                    loaded: this.loadedAssets,
                    total: this.totalAssets,
                    current: asset.name,
                    progress: this.loadedAssets / this.totalAssets
                });
            }
            
            return result;
            
        } catch (error) {
            console.error(`Error cargando ${asset.name}:`, error);
            
            if (this.onError) {
                this.onError({ asset, error });
            }
            
            // Retornar fallback
            return this.getFallback(asset.type);
        }
    }

    loadTexture(url) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    texture.encoding = THREE.sRGBEncoding;
                    resolve(texture);
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    loadModel(url) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    // Optimizar modelo
                    gltf.scene.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Optimizar materiales
                            if (child.material) {
                                child.material.envMapIntensity = 1;
                            }
                        }
                    });
                    
                    resolve(gltf);
                },
                (progress) => {
                    // Progreso de carga
                },
                (error) => reject(error)
            );
        });
    }

    async loadAudio(url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return arrayBuffer;
    }

    async loadShader(url) {
        const response = await fetch(url);
        return await response.text();
    }

    async loadJSON(url) {
        const response = await fetch(url);
        return await response.json();
    }

    // Generar fallback procedural
    getFallback(type) {
        switch(type) {
            case 'texture':
                return this.generateFallbackTexture();
            case 'model':
                return this.generateFallbackModel();
            default:
                return null;
        }
    }

    generateFallbackTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Patrón de error
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillRect(32, 32, 32, 32);
        ctx.fillStyle = '#000000';
        ctx.fillRect(32, 0, 32, 32);
        ctx.fillRect(0, 32, 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        return texture;
    }

    generateFallbackModel() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xff00ff,
            wireframe: true 
        });
        const mesh = new THREE.Mesh(geometry, material);
        
        const group = new THREE.Group();
        group.add(mesh);
        
        return { scene: group };
    }

    // Obtener de caché
    get(name) {
        return this.cache.get(name);
    }

    // Verificar si está en caché
    has(name) {
        return this.cache.has(name);
    }

    // Liberar memoria
    unload(name) {
        const asset = this.cache.get(name);
        if (!asset) return;
        
        // Liberar recursos Three.js
        if (asset.isTexture) {
            asset.dispose();
        } else if (asset.scene) {
            asset.scene.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
        
        this.cache.delete(name);
    }

    // Liberar todo
    clear() {
        this.cache.forEach((asset, name) => {
            this.unload(name);
        });
    }

    // Precargar nivel completo
    async preloadLevel(levelName) {
        const manifest = await this.load({
            type: 'json',
            name: `${levelName}_manifest`,
            url: `assets/levels/${levelName}/manifest.json`
        });
        
        if (!manifest) {
            console.warn(`No se encontró manifiesto para nivel: ${levelName}`);
            return;
        }
        
        const assets = [];
        
        // Compilar lista de assets
        if (manifest.textures) {
            manifest.textures.forEach(t => {
                assets.push({
                    type: 'texture',
                    name: t.name,
                    url: `assets/levels/${levelName}/textures/${t.file}`
                });
            });
        }
        
        if (manifest.models) {
            manifest.models.forEach(m => {
                assets.push({
                    type: 'model',
                    name: m.name,
                    url: `assets/levels/${levelName}/models/${m.file}`
                });
            });
        }
        
        return this.loadBatch(assets);
    }

    // Crear textura procedural
    createProceduralTexture(type, params = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = params.width || 512;
        canvas.height = params.height || 512;
        const ctx = canvas.getContext('2d');
        
        switch(type) {
            case 'noise':
                this.generateNoiseTexture(ctx, canvas.width, canvas.height, params);
                break;
            case 'grid':
                this.generateGridTexture(ctx, canvas.width, canvas.height, params);
                break;
            case 'gradient':
                this.generateGradientTexture(ctx, canvas.width, canvas.height, params);
                break;
            case 'alien_ground':
                this.generateAlienGroundTexture(ctx, canvas.width, canvas.height);
                break;
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        return texture;
    }

    generateNoiseTexture(ctx, w, h, params) {
        const imageData = ctx.createImageData(w, h);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const value = Math.random() * 255;
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
            data[i + 3] = 255;
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    generateGridTexture(ctx, w, h, params) {
        ctx.fillStyle = params.bgColor || '#111';
        ctx.fillRect(0, 0, w, h);
        
        ctx.strokeStyle = params.lineColor || '#333';
        ctx.lineWidth = 2;
        
        const size = params.gridSize || 64;
        
        for (let x = 0; x <= w; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        
        for (let y = 0; y <= h; y += size) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }

    generateGradientTexture(ctx, w, h, params) {
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, params.topColor || '#000');
        gradient.addColorStop(1, params.bottomColor || '#fff');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
    }

    generateAlienGroundTexture(ctx, w, h) {
        // Suelo alienígena con cristales
        ctx.fillStyle = '#1a0f2e';
        ctx.fillRect(0, 0, w, h);
        
        // Ruido base
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const size = Math.random() * 3;
            
            ctx.fillStyle = `rgba(${100 + Math.random() * 50}, 0, ${150 + Math.random() * 100}, 0.3)`;
            ctx.fillRect(x, y, size, size);
        }
        
        // Cristales
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const size = 10 + Math.random() * 30;
            
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
            gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
            gradient.addColorStop(1, 'rgba(0, 100, 255, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

export default AssetLoader;