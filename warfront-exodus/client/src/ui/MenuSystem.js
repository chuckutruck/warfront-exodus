/**
 * WARFRONT: EXODUS - Menu System
 * Menús principales, lobby, configuración, personalización
 */

class MenuSystem {
    constructor(engine) {
        this.engine = engine;
        this.currentScreen = null;
        this.screens = {};
        this.isVisible = true;
        
        this.init();
    }

    init() {
        this.createContainer();
        this.createMainMenu();
        this.createPlayMenu();
        this.createLobbyMenu();
        this.createLoadoutMenu();
        this.createSettingsMenu();
        this.createPauseMenu();
        
        this.showScreen('main');
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'menu-system';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0a0a1a 100%);
            z-index: 1000;
            font-family: 'Orbitron', 'Roboto', sans-serif;
            color: #fff;
            overflow: hidden;
        `;
        
        // Fondo animado
        this.createAnimatedBackground();
        
        document.body.appendChild(this.container);
    }

    createAnimatedBackground() {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0.3;
        `;
        
        this.container.appendChild(canvas);
        
        // Animación de partículas
        const ctx = canvas.getContext('2d');
        let particles = [];
        
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        
        resize();
        window.addEventListener('resize', resize);
        
        // Crear partículas
        for (let i = 0; i < 100; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2
            });
        }
        
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#00ffff';
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            
            // Líneas conexiones
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.lineWidth = 0.5;
            
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.hypot(dx, dy);
                    
                    if (dist < 100) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    createMainMenu() {
        const screen = document.createElement('div');
        screen.className = 'menu-screen main-menu';
        screen.innerHTML = `
            <div class="game-title">
                <h1>WARFRONT</h1>
                <h2>EXODUS</h2>
            </div>
            
            <div class="menu-buttons">
                <button class="menu-btn primary" data-action="play">JUGAR</button>
                <button class="menu-btn" data-action="loadout">EQUIPAMIENTO</button>
                <button class="menu-btn" data-action="settings">CONFIGURACIÓN</button>
                <button class="menu-btn" data-action="credits">CRÉDITOS</button>
                <button class="menu-btn danger" data-action="quit">SALIR</button>
            </div>
            
            <div class="player-stats">
                <div class="stat">
                    <span class="stat-value" id="player-rank">12</span>
                    <span class="stat-label">RANGO</span>
                </div>
                <div class="stat">
                    <span class="stat-value" id="player-level">47</span>
                    <span class="stat-label">NIVEL</span>
                </div>
                <div class="stat">
                    <span class="stat-value" id="player-kd">1.8</span>
                    <span class="stat-label">K/D</span>
                </div>
            </div>
            
            <div class="news-ticker">
                <span>ÚLTIMAS NOTICIAS: Nuevo mapa "Nebula Station" disponible • Evento de fin de semana: Doble XP</span>
            </div>
        `;
        
        this.addStyles(`
            .main-menu {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
            }
            
            .game-title {
                text-align: center;
                margin-bottom: 60px;
            }
            
            .game-title h1 {
                font-size: 80px;
                font-weight: 900;
                letter-spacing: 20px;
                margin: 0;
                background: linear-gradient(180deg, #fff 0%, #00ffff 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-shadow: 0 0 40px rgba(0, 255, 255, 0.5);
            }
            
            .game-title h2 {
                font-size: 40px;
                letter-spacing: 30px;
                margin: 0;
                color: #ff4444;
                text-shadow: 0 0 20px rgba(255, 68, 68, 0.5);
            }
            
            .menu-buttons {
                display: flex;
                flex-direction: column;
                gap: 15px;
                width: 300px;
            }
            
            .menu-btn {
                padding: 15px 30px;
                font-size: 18px;
                font-family: inherit;
                background: rgba(0, 255, 255, 0.1);
                border: 2px solid rgba(0, 255, 255, 0.3);
                color: #fff;
                cursor: pointer;
                transition: all 0.3s;
                text-transform: uppercase;
                letter-spacing: 3px;
            }
            
            .menu-btn:hover {
                background: rgba(0, 255, 255, 0.3);
                border-color: #00ffff;
                transform: scale(1.05);
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
            }
            
            .menu-btn.primary {
                background: rgba(0, 255, 255, 0.2);
                border-color: #00ffff;
                font-weight: bold;
            }
            
            .menu-btn.danger {
                border-color: #ff4444;
                color: #ff4444;
            }
            
            .menu-btn.danger:hover {
                background: rgba(255, 68, 68, 0.3);
                box-shadow: 0 0 20px rgba(255, 68, 68, 0.3);
            }
            
            .player-stats {
                position: absolute;
                top: 30px;
                right: 30px;
                display: flex;
                gap: 30px;
            }
            
            .stat {
                text-align: center;
            }
            
            .stat-value {
                display: block;
                font-size: 36px;
                font-weight: bold;
                color: #00ffff;
            }
            
            .stat-label {
                font-size: 12px;
                color: #888;
                letter-spacing: 2px;
            }
            
            .news-ticker {
                position: absolute;
                bottom: 30px;
                width: 100%;
                text-align: center;
                color: #888;
                font-size: 14px;
                animation: ticker 20s linear infinite;
            }
        `);
        
        this.bindButtons(screen);
        this.screens.main = screen;
        this.container.appendChild(screen);
    }

    createPlayMenu() {
        const screen = document.createElement('div');
        screen.className = 'menu-screen play-menu';
        screen.style.display = 'none';
        screen.innerHTML = `
            <h2 class="screen-title">MODO DE JUEGO</h2>
            
            <div class="game-modes">
                <div class="mode-card" data-mode="quick">
                    <div class="mode-icon">⚡</div>
                    <h3>PARTIDA RÁPIDA</h3>
                    <p>Entra inmediatamente a una partida en curso</p>
                </div>
                
                <div class="mode-card" data-mode="ranked">
                    <div class="mode-icon">🏆</div>
                    <h3>COMPETITIVO</h3>
                    <p>Sube de rango y demuestra tus habilidades</p>
                </div>
                
                <div class="mode-card" data-mode="squad">
                    <div class="mode-icon">👥</div>
                    <h3>ESCUADRÓN</h3>
                    <p>Juega con amigos en equipo coordinado</p>
                </div>
                
                <div class="mode-card" data-mode="custom">
                    <div class="mode-icon">⚙️</div>
                    <h3>PARTIDA PRIVADA</h3>
                    <p>Crea tu propia partida con reglas personalizadas</p>
                </div>
            </div>
            
            <div class="mode-details" id="mode-details">
                <h4>Selecciona un modo</h4>
            </div>
            
            <button class="back-btn" data-action="back">← VOLVER</button>
        `;
        
        this.addStyles(`
            .play-menu {
                padding: 60px;
            }
            
            .screen-title {
                font-size: 48px;
                margin-bottom: 40px;
                text-align: center;
            }
            
            .game-modes {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 30px;
                max-width: 800px;
                margin: 0 auto;
            }
            
            .mode-card {
                background: rgba(0, 20, 40, 0.6);
                border: 2px solid rgba(0, 255, 255, 0.2);
                padding: 30px;
                cursor: pointer;
                transition: all 0.3s;
                text-align: center;
            }
            
            .mode-card:hover {
                border-color: #00ffff;
                transform: translateY(-5px);
                box-shadow: 0 10px 30px rgba(0, 255, 255, 0.2);
            }
            
            .mode-icon {
                font-size: 48px;
                margin-bottom: 15px;
            }
            
            .mode-card h3 {
                margin: 0 0 10px 0;
                color: #00ffff;
            }
            
            .mode-card p {
                margin: 0;
                color: #888;
                font-size: 14px;
            }
            
            .mode-details {
                margin-top: 40px;
                padding: 20px;
                background: rgba(0, 0, 0, 0.3);
                border-left: 4px solid #00ffff;
            }
            
            .back-btn {
                position: absolute;
                bottom: 30px;
                left: 30px;
                padding: 10px 20px;
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: #fff;
                cursor: pointer;
            }
        `);
        
        // Eventos de selección de modo
        screen.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                const mode = card.dataset.mode;
                this.onModeSelected(mode);
            });
        });
        
        this.bindButtons(screen);
        this.screens.play = screen;
        this.container.appendChild(screen);
    }

    createLobbyMenu() {
        const screen = document.createElement('div');
        screen.className = 'menu-screen lobby-menu';
        screen.style.display = 'none';
        screen.innerHTML = `
            <div class="lobby-container">
                <div class="lobby-sidebar">
                    <h3>ESCUADRÓN</h3>
                    <div class="squad-list" id="squad-list">
                        <div class="squad-member leader">
                            <div class="member-avatar"></div>
                            <div class="member-info">
                                <span class="member-name">Tú (Líder)</span>
                                <span class="member-status">Listo</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="lobby-actions">
                        <button class="menu-btn" id="invite-btn">Invitar Jugador</button>
                        <button class="menu-btn" id="leave-squad">Abandonar Escuadrón</button>
                    </div>
                </div>
                
                <div class="lobby-main">
                    <h2>PREPARÁNDOSE PARA EL DESPLIEGUE</h2>
                    
                    <div class="match-settings">
                        <div class="setting">
                            <label>Modo</label>
                            <select id="lobby-mode">
                                <option>Team Deathmatch</option>
                                <option>Capturar la Bandera</option>
                                <option>Buscar y Destruir</option>
                                <option>Dominación</option>
                            </select>
                        </div>
                        
                        <div class="setting">
                            <label>Mapa</label>
                            <select id="lobby-map">
                                <option>Alien Wasteland</option>
                                <option>Nebula Station</option>
                                <option>Crystal Caverns</option>
                                <option>Orbital Defense</option>
                            </select>
                        </div>
                        
                        <div class="setting">
                            <label>Jugadores Máx</label>
                            <select id="lobby-maxplayers">
                                <option>4</option>
                                <option>8</option>
                                <option>16</option>
                                <option>32</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="map-preview" id="map-preview">
                        <div class="preview-placeholder">
                            <span>Selecciona un mapa</span>
                        </div>
                    </div>
                    
                    <button class="menu-btn primary start-btn" id="start-match">
                        INICIAR PARTIDA
                    </button>
                </div>
                
                <div class="lobby-chat">
                    <h3>CHAT DEL ESCUADRÓN</h3>
                    <div class="chat-messages" id="lobby-chat-messages"></div>
                    <input type="text" class="chat-input" placeholder="Escribe un mensaje..." id="lobby-chat-input">
                </div>
            </div>
        `;
        
        this.addStyles(`
            .lobby-menu {
                padding: 30px;
                height: 100%;
                box-sizing: border-box;
            }
            
            .lobby-container {
                display: grid;
                grid-template-columns: 250px 1fr 300px;
                gap: 30px;
                height: 100%;
            }
            
            .lobby-sidebar, .lobby-chat {
                background: rgba(0, 10, 20, 0.8);
                padding: 20px;
                border: 1px solid rgba(0, 255, 255, 0.2);
            }
            
            .squad-list {
                margin: 20px 0;
            }
            
            .squad-member {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                background: rgba(255, 255, 255, 0.05);
                margin-bottom: 10px;
            }
            
            .squad-member.leader {
                border-left: 3px solid #ffd700;
            }
            
            .member-avatar {
                width: 40px;
                height: 40px;
                background: #333;
                border-radius: 50%;
            }
            
            .member-info {
                display: flex;
                flex-direction: column;
            }
            
            .member-name {
                font-weight: bold;
            }
            
            .member-status {
                font-size: 12px;
                color: #0f0;
            }
            
            .lobby-main {
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            .match-settings {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin: 30px 0;
                width: 100%;
            }
            
            .setting {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .setting label {
                font-size: 12px;
                color: #888;
                text-transform: uppercase;
            }
            
            .setting select {
                padding: 10px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(0, 255, 255, 0.3);
                color: #fff;
            }
            
            .map-preview {
                width: 100%;
                height: 300px;
                background: rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(0, 255, 255, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 30px;
            }
            
            .start-btn {
                padding: 20px 60px;
                font-size: 24px;
            }
            
            .lobby-chat {
                display: flex;
                flex-direction: column;
            }
            
            .chat-messages {
                flex: 1;
                overflow-y: auto;
                margin: 20px 0;
                font-size: 14px;
            }
            
            .chat-input {
                padding: 10px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(0, 255, 255, 0.3);
                color: #fff;
            }
        `);
        
        this.screens.lobby = screen;
        this.container.appendChild(screen);
    }

    createLoadoutMenu() {
        const screen = document.createElement('div');
        screen.className = 'menu-screen loadout-menu';
        screen.style.display = 'none';
        screen.innerHTML = `
            <h2 class="screen-title">EQUIPAMIENTO TÁCTICO</h2>
            
            <div class="loadout-container">
                <div class="loadout-presets">
                    <h3>CONFIGURACIONES</h3>
                    <div class="preset-list">
                        <div class="preset active" data-preset="1">Config 1</div>
                        <div class="preset" data-preset="2">Config 2</div>
                        <div class="preset" data-preset="3">Config 3</div>
                        <div class="preset" data-preset="4">Config 4</div>
                        <div class="preset" data-preset="5">Config 5</div>
                    </div>
                </div>
                
                <div class="loadout-slots">
                    <div class="weapon-slot primary">
                        <h4>ARMA PRINCIPAL</h4>
                        <div class="weapon-display" id="primary-weapon">
                            <div class="weapon-image"></div>
                            <span class="weapon-name">AR-76 Standard</span>
                        </div>
                        <div class="attachments">
                            <div class="attachment-slot" data-type="optic">Óptica</div>
                            <div class="attachment-slot" data-type="barrel">Cañón</div>
                            <div class="attachment-slot" data-type="grip">Empuñadura</div>
                            <div class="attachment-slot" data-type="mag">Cargador</div>
                        </div>
                    </div>
                    
                    <div class="weapon-slot secondary">
                        <h4>ARMA SECUNDARIA</h4>
                        <div class="weapon-display" id="secondary-weapon">
                            <div class="weapon-image"></div>
                            <span class="weapon-name">M6C Sidearm</span>
                        </div>
                    </div>
                    
                    <div class="equipment-slots">
                        <div class="equipment">
                            <h4>TÁCTICO</h4>
                            <div class="equip-item">Granada de Frag</div>
                        </div>
                        <div class="equipment">
                            <h4>LETAL</h4>
                            <div class="equip-item">C4</div>
                        </div>
                        <div class="equipment">
                            <h4>PERK 1</h4>
                            <div class="equip-item">Chaleco antibalas</div>
                        </div>
                        <div class="equipment">
                            <h4>PERK 2</h4>
                            <div class="equip-item">Silencio de movimiento</div>
                        </div>
                    </div>
                </div>
                
                <div class="weapon-stats">
                    <h3>ESTADÍSTICAS</h3>
                    <div class="stat-bar">
                        <label>DAÑO</label>
                        <div class="bar"><div style="width: 70%"></div></div>
                    </div>
                    <div class="stat-bar">
                        <label>PRECISIÓN</label>
                        <div class="bar"><div style="width: 80%"></div></div>
                    </div>
                    <div class="stat-bar">
                        <label>ALCANCE</label>
                        <div class="bar"><div style="width: 60%"></div></div>
                    </div>
                    <div class="stat-bar">
                        <label>CADENCIA</label>
                        <div class="bar"><div style="width: 75%"></div></div>
                    </div>
                    <div class="stat-bar">
                        <label>MOVILIDAD</label>
                        <div class="bar"><div style="width: 85%"></div></div>
                    </div>
                </div>
            </div>
            
            <button class="back-btn" data-action="back">← VOLVER</button>
        `;
        
        this.addStyles(`
            .loadout-menu {
                padding: 60px;
            }
            
            .loadout-container {
                display: grid;
                grid-template-columns: 200px 1fr 300px;
                gap: 40px;
                margin-top: 40px;
            }
            
            .preset-list {
                margin-top: 20px;
            }
            
            .preset {
                padding: 15px;
                background: rgba(0, 0, 0, 0.3);
                margin-bottom: 10px;
                cursor: pointer;
                border-left: 3px solid transparent;
            }
            
            .preset.active, .preset:hover {
                border-left-color: #00ffff;
                background: rgba(0, 255, 255, 0.1);
            }
            
            .weapon-slot {
                background: rgba(0, 10, 20, 0.6);
                padding: 30px;
                margin-bottom: 20px;
                border: 1px solid rgba(0, 255, 255, 0.2);
            }
            
            .weapon-slot h4 {
                margin: 0 0 20px 0;
                color: #00ffff;
            }
            
            .weapon-display {
                display: flex;
                align-items: center;
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .weapon-image {
                width: 200px;
                height: 100px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 1px solid rgba(0, 255, 255, 0.3);
            }
            
            .attachments {
                display: flex;
                gap: 10px;
            }
            
            .attachment-slot {
                flex: 1;
                padding: 15px;
                background: rgba(0, 0, 0, 0.3);
                text-align: center;
                font-size: 12px;
                cursor: pointer;
                border: 1px dashed rgba(0, 255, 255, 0.3);
            }
            
            .attachment-slot:hover {
                border-style: solid;
                background: rgba(0, 255, 255, 0.1);
            }
            
            .equipment-slots {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
            }
            
            .equipment {
                background: rgba(0, 0, 0, 0.3);
                padding: 15px;
            }
            
            .equipment h4 {
                margin: 0 0 10px 0;
                font-size: 12px;
                color: #888;
            }
            
            .equip-item {
                padding: 10px;
                background: rgba(0, 255, 255, 0.1);
                border: 1px solid rgba(0, 255, 255, 0.3);
                cursor: pointer;
            }
            
            .weapon-stats {
                background: rgba(0, 10, 20, 0.6);
                padding: 30px;
            }
            
            .stat-bar {
                margin-bottom: 20px;
            }
            
            .stat-bar label {
                display: block;
                font-size: 12px;
                color: #888;
                margin-bottom: 5px;
            }
            
            .stat-bar .bar {
                height: 10px;
                background: rgba(0, 0, 0, 0.5);
                overflow: hidden;
            }
            
            .stat-bar .bar div {
                height: 100%;
                background: linear-gradient(90deg, #00ffff, #0088ff);
            }
        `);
        
        this.bindButtons(screen);
        this.screens.loadout = screen;
        this.container.appendChild(screen);
    }

    createSettingsMenu() {
        const screen = document.createElement('div');
        screen.className = 'menu-screen settings-menu';
        screen.style.display = 'none';
        screen.innerHTML = `
            <h2 class="screen-title">CONFIGURACIÓN</h2>
            
            <div class="settings-tabs">
                <button class="tab-btn active" data-tab="video">VIDEO</button>
                <button class="tab-btn" data-tab="audio">AUDIO</button>
                <button class="tab-btn" data-tab="controls">CONTROLES</button>
                <button class="tab-btn" data-tab="gameplay">GAMEPLAY</button>
            </div>
            
            <div class="settings-content" id="settings-video">
                <div class="setting-item">
                    <label>Resolución</label>
                    <select id="setting-resolution">
                        <option>1920x1080</option>
                        <option>2560x1440</option>
                        <option>3840x2160</option>
                    </select>
                </div>
                
                <div class="setting-item">
                    <label>Pantalla Completa</label>
                    <input type="checkbox" id="setting-fullscreen" checked>
                </div>
                
                <div class="setting-item">
                    <label>Sincronización Vertical</label>
                    <input type="checkbox" id="setting-vsync">
                </div>
                
                <div class="setting-item">
                    <label>Límite de FPS</label>
                    <select id="setting-fps">
                        <option>Sin límite</option>
                                <option>30</option>
                                <option>60</option>
                                <option>120</option>
                                <option>144</option>
                            </select>
                        </div>
                        
                        <div class="setting-item">
                            <label>Calidad de Texturas</label>
                            <input type="range" min="0" max="3" value="2" id="setting-textures">
                        </div>
                        
                        <div class="setting-item">
                            <label>Sombras</label>
                            <input type="checkbox" id="setting-shadows" checked>
                        </div>
                        
                        <div class="setting-item">
                            <label>Efectos de Partículas</label>
                            <select id="setting-particles">
                                <option>Bajo</option>
                                <option selected>Medio</option>
                                <option>Alto</option>
                                <option>Ultra</option>
                            </select>
                        </div>
                        
                        <div class="setting-item">
                            <label>Bloom</label>
                            <input type="checkbox" id="setting-bloom" checked>
                        </div>
                    </div>
                    
                    <div class="settings-actions">
                        <button class="menu-btn" id="save-settings">GUARDAR</button>
                        <button class="menu-btn" id="reset-settings">RESTABLECER</button>
                    </div>
                    
                    <button class="back-btn" data-action="back">← VOLVER</button>
                `;
                
                this.addStyles(`
                    .settings-menu {
                        padding: 60px;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    
                    .settings-tabs {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 30px;
                        border-bottom: 2px solid rgba(0, 255, 255, 0.2);
                    }
                    
                    .tab-btn {
                        padding: 15px 30px;
                        background: transparent;
                        border: none;
                        color: #888;
                        cursor: pointer;
                        font-family: inherit;
                        font-size: 16px;
                        text-transform: uppercase;
                    }
                    
                    .tab-btn.active {
                        color: #00ffff;
                        border-bottom: 2px solid #00ffff;
                    }
                    
                    .settings-content {
                        background: rgba(0, 10, 20, 0.6);
                        padding: 30px;
                    }
                    
                    .setting-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 15px 0;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    }
                    
                    .setting-item label {
                        font-size: 14px;
                    }
                    
                    .setting-item select, .setting-item input {
                        padding: 8px 15px;
                        background: rgba(0, 0, 0, 0.5);
                        border: 1px solid rgba(0, 255, 255, 0.3);
                        color: #fff;
                        min-width: 150px;
                    }
                    
                    .settings-actions {
                        margin-top: 30px;
                        display: flex;
                        gap: 15px;
                        justify-content: center;
                    }
                `);
                
                this.bindButtons(screen);
                this.screens.settings = screen;
                this.container.appendChild(screen);
            }

            createPauseMenu() {
                const screen = document.createElement('div');
                screen.className = 'menu-screen pause-menu';
                screen.style.display = 'none';
                screen.innerHTML = `
                    <div class="pause-overlay">
                        <h2>MENÚ DE PAUSA</h2>
                        
                        <div class="pause-buttons">
                            <button class="menu-btn" data-action="resume">REANUDAR</button>
                            <button class="menu-btn" data-action="settings">CONFIGURACIÓN</button>
                            <button class="menu-btn" data-action="leave">ABANDONAR PARTIDA</button>
                        </div>
                        
                        <div class="match-info">
                            <div class="info-row">
                                <span>Mapa:</span>
                                <span id="pause-map">Alien Wasteland</span>
                            </div>
                            <div class="info-row">
                                <span>Modo:</span>
                                <span id="pause-mode">Team Deathmatch</span>
                            </div>
                            <div class="info-row">
                                <span>Tiempo restante:</span>
                                <span id="pause-time">05:32</span>
                            </div>
                            <div class="info-row">
                                <span>Puntuación:</span>
                                <span id="pause-score">25 - 18</span>
                            </div>
                        </div>
                    </div>
                `;
                
                this.addStyles(`
                    .pause-menu {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.8);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    
                    .pause-overlay {
                        background: rgba(10, 10, 30, 0.95);
                        padding: 60px;
                        border: 2px solid rgba(0, 255, 255, 0.3);
                        text-align: center;
                        min-width: 400px;
                    }
                    
                    .pause-overlay h2 {
                        margin-bottom: 40px;
                        color: #00ffff;
                    }
                    
                    .pause-buttons {
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                        margin-bottom: 40px;
                    }
                    
                    .match-info {
                        text-align: left;
                        padding-top: 20px;
                        border-top: 1px solid rgba(255, 255, 255, 0.1);
                    }
                    
                    .info-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 10px 0;
                        color: #888;
                    }
                    
                    .info-row span:last-child {
                        color: #fff;
                    }
                `);
                
                this.bindButtons(screen);
                this.screens.pause = screen;
                this.container.appendChild(screen);
            }

            bindButtons(screen) {
                screen.querySelectorAll('[data-action]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const action = btn.dataset.action;
                        this.handleAction(action);
                    });
                });
            }

            handleAction(action) {
                switch(action) {
                    case 'play':
                        this.showScreen('play');
                        break;
                    case 'loadout':
                        this.showScreen('loadout');
                        break;
                    case 'settings':
                        this.showScreen('settings');
                        break;
                    case 'back':
                        this.goBack();
                        break;
                    case 'quit':
                        if (confirm('¿Salir del juego?')) {
                            window.close();
                        }
                        break;
                    case 'resume':
                        this.hide();
                        break;
                    case 'leave':
                        if (confirm('¿Abandonar la partida actual?')) {
                            this.engine.matchManager?.endMatch('player_left');
                            this.showScreen('main');
                        }
                        break;
                }
            }

            onModeSelected(mode) {
                const details = document.getElementById('mode-details');
                
                const descriptions = {
                    quick: 'Unirse rápidamente a una partida en curso con jugadores de habilidad similar.',
                    ranked: 'Compite en partidas clasificatorias para subir de rango y obtener recompensas exclusivas.',
                    squad: 'Forma un escuadrón con amigos y enfrentaos a otros equipos organizados.',
                    custom: 'Crea una partida privada con tus propias reglas e invita a quien quieras.'
                };
                
                details.innerHTML = `<h4>${mode.toUpperCase()}</h4><p>${descriptions[mode]}</p>`;
                
                // Iniciar matchmaking
                setTimeout(() => {
                    this.showScreen('lobby');
                }, 500);
            }

            showScreen(name) {
                Object.values(this.screens).forEach(s => s.style.display = 'none');
                
                if (this.screens[name]) {
                    this.screens[name].style.display = 'block';
                    this.currentScreen = name;
                }
                
                this.show();
            }

            goBack() {
                const hierarchy = {
                    play: 'main',
                    loadout: 'main',
                    settings: 'main',
                    lobby: 'play'
                };
                
                const previous = hierarchy[this.currentScreen];
                if (previous) {
                    this.showScreen(previous);
                }
            }

            show() {
                this.isVisible = true;
                this.container.style.display = 'block';
                document.exitPointerLock?.();
            }

            hide() {
                this.isVisible = false;
                this.container.style.display = 'none';
                
                // Solicitar pointer lock para FPS
                this.engine.renderer?.domElement.requestPointerLock();
            }

            togglePause() {
                if (this.currentScreen === 'pause') {
                    this.hide();
                } else {
                    this.showScreen('pause');
                }
            }

            addStyles(css) {
                const style = document.createElement('style');
                style.textContent = css;
                document.head.appendChild(style);
            }

            destroy() {
                this.container.remove();
            }
        }

        export default MenuSystem;