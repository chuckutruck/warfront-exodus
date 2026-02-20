/**
 * WARFRONT: EXODUS - Main Entry Point
 * Inicialización del juego y gestión de ciclo de vida
 */

import GameEngine from './core/Engine.js';
import InputManager from './core/InputManager.js';
import AudioSystem from './core/AudioSystem.js';
import NetworkManager from './network/NetworkManager.js';
import LobbySystem from './network/LobbySystem.js';
import MatchManager from './gameplay/MatchManager.js';
import DamageSystem from './gameplay/DamageSystem.js';
import AIController from './gameplay/AIController.js';
import HUD from './ui/HUD.js';
import MenuSystem from './ui/MenuSystem.js';
import MobileControls from './ui/MobileControls.js';
import { auth, signInAnonymous, signInWithGoogle } from './firebase-config.js';

class WarfrontExodus {
    constructor() {
        this.engine = null;
        this.input = null;
        this.audio = null;
        this.network = null;
        this.lobby = null;
        this.match = null;
        this.damage = null;
        this.ai = null;
        this.hud = null;
        this.menu = null;
        this.mobile = null;
        
        this.gameState = 'boot'; // boot, auth, menu, lobby, loading, playing, paused
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        console.log('WARFRONT: EXODUS - Iniciando...');
        
        // Mostrar pantalla de carga
        this.showBootScreen();
        
        try {
            // 1. Inicializar Firebase Auth
            await this.initializeAuth();
            
            // 2. Inicializar motor gráfico
            await this.initializeEngine();
            
            // 3. Inicializar sistemas
            await this.initializeSystems();
            
            // 4. Configurar eventos
            this.setupEventListeners();
            
            this.isInitialized = true;
            this.gameState = 'menu';
            
            // Mostrar menú principal
            this.menu.showScreen('main');
            
            console.log('Juego inicializado correctamente');
            
        } catch (error) {
            console.error('Error de inicialización:', error);
            this.showError(error.message);
        }
    }

    showBootScreen() {
        const boot = document.createElement('div');
        boot.id = 'boot-screen';
        boot.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #00ffff;
            font-family: 'Orbitron', monospace;
            z-index: 9999;
        `;
        
        boot.innerHTML = `
            <h1 style="font-size: 48px; letter-spacing: 10px; margin-bottom: 20px;">
                WARFRONT: EXODUS
            </h1>
            <div class="loading-bar" style="
                width: 300px;
                height: 4px;
                background: #111;
                overflow: hidden;
            ">
                <div class="loading-progress" style="
                    width: 0%;
                    height: 100%;
                    background: #00ffff;
                    transition: width 0.3s;
                "></div>
            </div>
            <p class="loading-text" style="margin-top: 20px; color: #888;">Inicializando sistemas...</p>
        `;
        
        document.body.appendChild(boot);
        this.bootScreen = boot;
    }

    updateBootProgress(progress, text) {
        const bar = this.bootScreen.querySelector('.loading-progress');
        const txt = this.bootScreen.querySelector('.loading-text');
        
        bar.style.width = `${progress}%`;
        if (text) txt.textContent = text;
    }

    async initializeAuth() {
        this.updateBootProgress(10, 'Conectando a servidores...');
        
        try {
            // Intentar sesión anónima primero
            await signInAnonymous();
            console.log('Autenticado anónimamente');
        } catch (error) {
            console.warn('Auth anónima fallida, modo offline');
        }
        
        this.updateBootProgress(20, 'Cargando recursos...');
    }

    async initializeEngine() {
        this.updateBootProgress(30, 'Inicializando motor gráfico...');
        
        this.engine = new GameEngine();
        await this.engine.initialize('game-container');
        
        // Crear contenedor si no existe
        if (!document.getElementById('game-container')) {
            const container = document.createElement('div');
            container.id = 'game-container';
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1;
            `;
            document.body.appendChild(container);
            await this.engine.initialize('game-container');
        }
        
        this.updateBootProgress(50, 'Cargando sistemas de juego...');
    }

    async initializeSystems() {
        // Input
        this.input = new InputManager();
        this.engine.input = this.input;
        
        this.updateBootProgress(60);
        
        // Audio
        this.audio = new AudioSystem(this.engine);
        this.engine.audio = this.audio;
        
        // Red
        this.network = new NetworkManager(this.engine);
        this.engine.network = this.network;
        await this.network.connect();
        
        this.updateBootProgress(70);
        
        // Lobby
        this.lobby = new LobbySystem(this.network);
        
        // Gameplay
        this.match = new MatchManager(this.engine);
        this.engine.matchManager = this.match;
        
        this.damage = new DamageSystem(this.engine);
        this.engine.damageSystem = this.damage;
        
        this.ai = new AIController(this.engine);
        this.engine.aiController = this.ai;
        
        this.updateBootProgress(80);
        
        // UI
        this.hud = new HUD(this.engine);
        this.engine.hud = this.hud;
        this.hud.toggleVisibility(false);
        
        this.menu = new MenuSystem(this.engine);
        
        // Controles móviles
        this.mobile = new MobileControls(this.engine);
        
        this.updateBootProgress(90, 'Finalizando...');
        
        // Crear cielo alienígena
        this.engine.createAlienSkybox();
        
        // Ocultar pantalla de carga
        setTimeout(() => {
            this.bootScreen.style.opacity = '0';
            setTimeout(() => this.bootScreen.remove(), 500);
        }, 500);
        
        this.updateBootProgress(100);
    }

    setupEventListeners() {
        // Tecla ESC para menú de pausa
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.gameState === 'playing') {
                    this.menu.togglePause();
                }
            }
        });
        
        // Cambio de visibilidad de página
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.gameState === 'playing') {
                this.audio?.setMasterVolume(0.3);
            } else {
                this.audio?.setMasterVolume(1.0);
            }
        });
        
        // Antes de cerrar
        window.addEventListener('beforeunload', () => {
            this.network?.disconnect();
        });
        
        // Errores
        window.addEventListener('error', (e) => {
            console.error('Error global:', e.error);
            this.showError('Error crítico: ' + e.message);
        });
        
        // Resize
        window.addEventListener('resize', () => {
            this.engine?.onWindowResize();
        });
    }

    async startMatch(mode, map, settings = {}) {
        this.gameState = 'loading';
        this.menu.hide();
        
        // Mostrar pantalla de carga
        this.hud.showNotification('Cargando partida...', 'info', 2000);
        
        // Inicializar match
        this.match.initialize(mode, map, settings);
        
        // Spawn jugador
        const spawnPoint = this.match.spawnPoints.alpha[0];
        this.engine.spawnLocalPlayer({
            position: spawnPoint,
            team: 'alpha'
        });
        
        // Conectar a sala
        await this.network.joinOrCreateSession('public', settings.maxPlayers || 8);
        
        // Esperar jugadores si es necesario
        setTimeout(() => {
            this.match.startMatch();
            this.gameState = 'playing';
            this.hud.toggleVisibility(true);
        }, 3000);
    }

    endMatch(results) {
        this.gameState = 'menu';
        this.hud.toggleVisibility(false);
        this.menu.showScreen('main');
        
        // Mostrar resultados
        console.log('Partida finalizada:', results);
    }

    showError(message) {
        const error = document.createElement('div');
        error.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: #fff;
            padding: 30px;
            border-radius: 10px;
            z-index: 10000;
            text-align: center;
        `;
        
        error.innerHTML = `
            <h2>Error</h2>
            <p>${message}</p>
            <button onclick="location.reload()">Reintentar</button>
        `;
        
        document.body.appendChild(error);
    }

    // API Pública para desarrollo
    devCommand(command, ...args) {
        switch(command) {
            case 'godmode':
                this.engine.localPlayer.health = 9999;
                break;
            case 'giveWeapon':
                this.engine.localPlayer.giveWeapon(args[0]);
                break;
            case 'spawnBot':
                this.ai.createBot(args[0] || 'normal');
                break;
            case 'teleport':
                this.engine.localPlayer.position.set(args[0], args[1], args[2]);
                break;
            case 'setTime':
                this.match.timeRemaining = args[0];
                break;
        }
    }
}

// Iniciar juego cuando DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.game = new WarfrontExodus();
});

export default WarfrontExodus;