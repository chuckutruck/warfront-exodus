/**
 * WARFRONT: EXODUS - HUD System
 * Interfaz táctica militar, minimapa, estado de combate
 */

class HUD {
    constructor(engine) {
        this.engine = engine;
        this.container = null;
        this.elements = {};
        this.isVisible = true;
        
        this.init();
    }

    init() {
        this.container = document.createElement('div');
        this.container.id = 'game-hud';
        this.container.className = 'hud-container';
        
        this.createStructure();
        this.applyStyles();
        
        document.body.appendChild(this.container);
    }

    createStructure() {
        // Crosshair central
        this.elements.crosshair = this.createCrosshair();
        
        // Esquina superior izquierda - Info equipo
        this.elements.teamInfo = this.createTeamInfo();
        
        // Esquina superior derecha - Minimapa
        this.elements.minimap = this.createMinimap();
        
        // Esquina inferior izquierda - Salud y estado
        this.elements.healthPanel = this.createHealthPanel();
        
        // Esquina inferior derecha - Arma y munición
        this.elements.weaponPanel = this.createWeaponPanel();
        
        // Centro inferior - Kill feed
        this.elements.killFeed = this.createKillFeed();
        
        // Centro - Hit markers
        this.elements.hitMarker = this.createHitMarker();
        
        // Notificaciones
        this.elements.notifications = this.createNotifications();
        
        // Indicadores de daño direccionales
        this.elements.damageIndicators = this.createDamageIndicators();
        
        // Chat
        this.elements.chat = this.createChat();
        
        // Scoreboard (inicialmente oculto)
        this.elements.scoreboard = this.createScoreboard();
    }

    createCrosshair() {
        const crosshair = document.createElement('div');
        crosshair.className = 'crosshair';
        
        const dot = document.createElement('div');
        dot.className = 'crosshair-dot';
        
        const lines = document.createElement('div');
        lines.className = 'crosshair-lines';
        lines.innerHTML = `
            <div class="line top"></div>
            <div class="line bottom"></div>
            <div class="line left"></div>
            <div class="line right"></div>
        `;
        
        crosshair.appendChild(dot);
        crosshair.appendChild(lines);
        this.container.appendChild(crosshair);
        
        return { element: crosshair, dot, lines };
    }

    createTeamInfo() {
        const panel = document.createElement('div');
        panel.className = 'hud-panel team-info';
        
        panel.innerHTML = `
            <div class="team-score">
                <div class="team alpha">
                    <span class="team-name">ALPHA</span>
                    <span class="score" id="score-alpha">0</span>
                </div>
                <div class="vs">VS</div>
                <div class="team bravo">
                    <span class="score" id="score-bravo">0</span>
                    <span class="team-name">BRAVO</span>
                </div>
            </div>
            <div class="match-timer" id="match-timer">10:00</div>
            <div class="game-mode" id="game-mode">TEAM DEATHMATCH</div>
        `;
        
        this.container.appendChild(panel);
        return { element: panel };
    }

    createMinimap() {
        const container = document.createElement('div');
        container.className = 'hud-panel minimap-container';
        
        const canvas = document.createElement('canvas');
        canvas.id = 'minimap';
        canvas.width = 200;
        canvas.height = 200;
        
        const compass = document.createElement('div');
        compass.className = 'compass';
        compass.innerHTML = 'N';
        
        container.appendChild(canvas);
        container.appendChild(compass);
        this.container.appendChild(container);
        
        return { 
            element: container, 
            canvas, 
            ctx: canvas.getContext('2d'),
            compass
        };
    }

    createHealthPanel() {
        const panel = document.createElement('div');
        panel.className = 'hud-panel health-panel';
        
        panel.innerHTML = `
            <div class="health-bar-container">
                <div class="health-bar-bg"></div>
                <div class="health-bar" id="health-bar" style="width: 100%"></div>
                <span class="health-text" id="health-text">100</span>
            </div>
            <div class="armor-bar-container" id="armor-container" style="display: none">
                <div class="armor-bar-bg"></div>
                <div class="armor-bar" id="armor-bar"></div>
            </div>
            <div class="status-effects" id="status-effects"></div>
        `;
        
        this.container.appendChild(panel);
        return { element: panel };
    }

    createWeaponPanel() {
        const panel = document.createElement('div');
        panel.className = 'hud-panel weapon-panel';
        
        panel.innerHTML = `
            <div class="weapon-info">
                <div class="weapon-name" id="weapon-name">AR-76</div>
                <div class="fire-mode" id="fire-mode">AUTO</div>
            </div>
            <div class="ammo-counter">
                <span class="current-ammo" id="current-ammo">30</span>
                <span class="ammo-separator">/</span>
                <span class="reserve-ammo" id="reserve-ammo">120</span>
            </div>
            <div class="weapon-icons">
                <div class="weapon-slot active" id="slot-primary">1</div>
                <div class="weapon-slot" id="slot-secondary">2</div>
                <div class="weapon-slot" id="slot-melee">3</div>
            </div>
        `;
        
        this.container.appendChild(panel);
        return { element: panel };
    }

    createKillFeed() {
        const container = document.createElement('div');
        container.className = 'kill-feed';
        container.id = 'kill-feed';
        
        this.container.appendChild(container);
        return { element: container, entries: [] };
    }

    createHitMarker() {
        const marker = document.createElement('div');
        marker.className = 'hit-marker';
        marker.id = 'hit-marker';
        marker.innerHTML = `
            <div class="marker-x"></div>
            <div class="marker-dot"></div>
        `;
        
        this.container.appendChild(marker);
        return { element: marker };
    }

    createNotifications() {
        const container = document.createElement('div');
        container.className = 'notifications';
        container.id = 'notifications';
        
        this.container.appendChild(container);
        return { element: container };
    }

    createDamageIndicators() {
        const container = document.createElement('div');
        container.className = 'damage-indicators';
        
        // 8 indicadores direccionales
        for (let i = 0; i < 8; i++) {
            const indicator = document.createElement('div');
            indicator.className = `damage-indicator dir-${i}`;
            indicator.style.display = 'none';
            container.appendChild(indicator);
        }
        
        this.container.appendChild(container);
        return { element: container, indicators: container.children };
    }

    createChat() {
        const container = document.createElement('div');
        container.className = 'chat-container';
        container.id = 'chat';
        
        const messages = document.createElement('div');
        messages.className = 'chat-messages';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'chat-input';
        input.placeholder = 'Presiona ENTER para chat...';
        input.style.display = 'none';
        
        container.appendChild(messages);
        container.appendChild(input);
        this.container.appendChild(container);
        
        return { element: container, messages, input };
    }

    createScoreboard() {
        const board = document.createElement('div');
        board.className = 'scoreboard';
        board.id = 'scoreboard';
        board.style.display = 'none';
        
        board.innerHTML = `
            <div class="scoreboard-header">
                <h2 id="sb-map">Alien Wasteland</h2>
                <div class="sb-scores">
                    <div class="sb-team alpha">
                        <span class="sb-team-name">ALPHA</span>
                        <span class="sb-score" id="sb-score-alpha">0</span>
                    </div>
                    <div class="sb-timer" id="sb-timer">10:00</div>
                    <div class="sb-team bravo">
                        <span class="sb-score" id="sb-score-bravo">0</span>
                        <span class="sb-team-name">BRAVO</span>
                    </div>
                </div>
            </div>
            <div class="scoreboard-body">
                <div class="sb-column alpha" id="sb-alpha"></div>
                <div class="sb-column bravo" id="sb-bravo"></div>
            </div>
        `;
        
        this.container.appendChild(board);
        return { element: board };
    }

    // ACTUALIZACIONES EN TIEMPO REAL

    updateHealth(health, maxHealth = 100) {
        const percentage = (health / maxHealth) * 100;
        const bar = document.getElementById('health-bar');
        const text = document.getElementById('health-text');
        
        bar.style.width = `${percentage}%`;
        text.textContent = Math.ceil(health);
        
        // Cambiar color según salud
        if (percentage > 60) {
            bar.className = 'health-bar healthy';
        } else if (percentage > 30) {
            bar.className = 'health-bar warning';
        } else {
            bar.className = 'health-bar critical';
        }
    }

    updateArmor(armor) {
        const container = document.getElementById('armor-container');
        const bar = document.getElementById('armor-bar');
        
        if (armor > 0) {
            container.style.display = 'block';
            bar.style.width = `${armor}%`;
        } else {
            container.style.display = 'none';
        }
    }

    updateAmmo(current, reserve) {
        document.getElementById('current-ammo').textContent = current;
        document.getElementById('reserve-ammo').textContent = reserve;
        
        // Alerta de baja munición
        if (current === 0) {
            document.getElementById('current-ammo').classList.add('empty');
        } else if (current < 5) {
            document.getElementById('current-ammo').classList.add('low');
        } else {
            document.getElementById('current-ammo').classList.remove('empty', 'low');
        }
    }

    updateWeapon(weaponName, fireMode) {
        document.getElementById('weapon-name').textContent = weaponName;
        document.getElementById('fire-mode').textContent = fireMode;
    }

    updateScore(alpha, bravo) {
        document.getElementById('score-alpha').textContent = alpha;
        document.getElementById('score-bravo').textContent = bravo;
        document.getElementById('sb-score-alpha').textContent = alpha;
        document.getElementById('sb-score-bravo').textContent = bravo;
    }

    updateTimer(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        document.getElementById('match-timer').textContent = timeStr;
        document.getElementById('sb-timer').textContent = timeStr;
    }

    showHitMarker(isCritical = false, isKill = false) {
        const marker = this.elements.hitMarker.element;
        marker.classList.remove('critical', 'kill');
        
        if (isKill) marker.classList.add('kill');
        else if (isCritical) marker.classList.add('critical');
        
        marker.style.display = 'block';
        
        setTimeout(() => {
            marker.style.display = 'none';
        }, 100);
    }

    showDamageIndicator(direction, intensity = 1) {
        // Convertir dirección a índice 0-7
        const angle = Math.atan2(direction.x, direction.z);
        const index = Math.round((angle + Math.PI) / (Math.PI / 4)) % 8;
        
        const indicator = this.elements.damageIndicators.indicators[index];
        indicator.style.opacity = intensity;
        indicator.style.display = 'block';
        
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 500);
    }

    addKillFeedEntry(killer, victim, weapon, isHeadshot = false) {
        const entry = document.createElement('div');
        entry.className = 'kill-feed-entry';
        
        const headshotIcon = isHeadshot ? '<span class="headshot-icon">🎯</span>' : '';
        
        entry.innerHTML = `
            <span class="killer">${killer}</span>
            <span class="weapon-icon">${weapon}</span>
            ${headshotIcon}
            <span class="victim">${victim}</span>
        `;
        
        this.elements.killFeed.element.appendChild(entry);
        this.elements.killFeed.entries.push(entry);
        
        // Limitar a 5 entradas
        if (this.elements.killFeed.entries.length > 5) {
            const old = this.elements.killFeed.entries.shift();
            old.remove();
        }
        
        setTimeout(() => {
            entry.style.opacity = '0';
            setTimeout(() => entry.remove(), 500);
        }, 5000);
    }

    showNotification(text, type = 'info', duration = 3000) {
        const notif = document.createElement('div');
        notif.className = `notification ${type}`;
        notif.textContent = text;
        
        this.elements.notifications.element.appendChild(notif);
        
        setTimeout(() => {
            notif.style.opacity = '0';
            setTimeout(() => notif.remove(), 300);
        }, duration);
    }

    updateMinimap(playerPos, playerRot, teammates, enemies, objectives) {
        const { canvas, ctx } = this.elements.minimap;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const scale = 0.5; // Escala del mapa
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Fondo
        ctx.fillStyle = 'rgba(0, 20, 0, 0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Grid
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < canvas.width; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(canvas.width, i);
            ctx.stroke();
        }
        
        // Jugador (centro)
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-playerRot.y);
        
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(-5, 5);
        ctx.lineTo(5, 5);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
        
        // Compañeros
        teammates.forEach(mate => {
            const relX = (mate.position.x - playerPos.x) * scale;
            const relY = (mate.position.z - playerPos.z) * scale;
            
            ctx.fillStyle = '#00aaff';
            ctx.beginPath();
            ctx.arc(centerX + relX, centerY + relY, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Enemigos (solo si fueron spotteados)
        enemies.forEach(enemy => {
            if (!enemy.spotted) return;
            
            const relX = (enemy.position.x - playerPos.x) * scale;
            const relY = (enemy.position.z - playerPos.z) * scale;
            
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(centerX + relX, centerY + relY, 4, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Objetivos
        objectives.forEach(obj => {
            const relX = (obj.position.x - playerPos.x) * scale;
            const relY = (obj.position.z - playerPos.z) * scale;
            
            ctx.strokeStyle = obj.captured ? '#00ff00' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(centerX + relX - 5, centerY + relY - 5, 10, 10);
        });
        
        // Brújula
        this.elements.minimap.compass.style.transform = 
            `rotate(${-playerRot.y}rad)`;
    }

    toggleScoreboard(show) {
        this.elements.scoreboard.element.style.display = show ? 'block' : 'none';
        
        if (show) {
            this.updateScoreboardData();
        }
    }

    updateScoreboardData() {
        // Obtener datos del match manager
        const players = this.engine.matchManager?.getPlayerStats() || [];
        
        const alphaTeam = players.filter(p => p.team === 'alpha');
        const bravoTeam = players.filter(p => p.team === 'bravo');
        
        this.renderTeamColumn('sb-alpha', alphaTeam);
        this.renderTeamColumn('sb-bravo', bravoTeam);
    }

    renderTeamColumn(elementId, players) {
        const container = document.getElementById(elementId);
        container.innerHTML = '';
        
        // Ordenar por puntuación
        players.sort((a, b) => b.score - a.score);
        
        players.forEach(player => {
            const row = document.createElement('div');
            row.className = 'sb-player-row';
            row.innerHTML = `
                <span class="sb-rank">${player.rank || ''}</span>
                <span class="sb-name">${player.name}</span>
                <span class="sb-kda">${player.kills}/${player.deaths}/${player.assists}</span>
                <span class="sb-score">${player.score}</span>
                <span class="sb-ping">${player.ping}ms</span>
            `;
            container.appendChild(row);
        });
    }

    showChat() {
        this.elements.chat.input.style.display = 'block';
        this.elements.chat.input.focus();
    }

    hideChat() {
        this.elements.chat.input.style.display = 'none';
        this.elements.chat.input.value = '';
    }

    addChatMessage(sender, text, team = false) {
        const msg = document.createElement('div');
        msg.className = `chat-message ${team ? 'team' : 'all'}`;
        msg.innerHTML = `<span class="sender">${sender}:</span> ${text}`;
        
        this.elements.chat.messages.appendChild(msg);
        this.elements.chat.messages.scrollTop = this.elements.chat.messages.scrollHeight;
        
        // Auto-limpiar
        setTimeout(() => {
            msg.style.opacity = '0.5';
        }, 10000);
    }

    updateCrosshair(spread) {
        const lines = this.elements.crosshair.lines;
        const size = 10 + spread * 100;
        
        lines.style.setProperty('--spread', `${size}px`);
    }

    applyStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .hud-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                font-family: 'Roboto Mono', monospace;
                color: #fff;
                text-shadow: 0 0 4px rgba(0,0,0,0.8);
            }
            
            .hud-panel {
                position: absolute;
                background: rgba(0, 20, 40, 0.6);
                border: 1px solid rgba(0, 255, 255, 0.3);
                padding: 10px;
                border-radius: 4px;
            }
            
            /* Crosshair */
            .crosshair {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 20px;
                height: 20px;
            }
            
            .crosshair-dot {
                position: absolute;
                width: 4px;
                height: 4px;
                background: rgba(0, 255, 0, 0.8);
                border-radius: 50%;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
            
            .crosshair-lines .line {
                position: absolute;
                background: rgba(0, 255, 0, 0.6);
                transition: all 0.1s;
            }
            
            .line.top, .line.bottom {
                width: 2px;
                height: var(--spread, 10px);
                left: 50%;
                transform: translateX(-50%);
            }
            
            .line.top { bottom: 50%; margin-bottom: 2px; }
            .line.bottom { top: 50%; margin-top: 2px; }
            
            .line.left, .line.right {
                height: 2px;
                width: var(--spread, 10px);
                top: 50%;
                transform: translateY(-50%);
            }
            
            .line.left { right: 50%; margin-right: 2px; }
            .line.right { left: 50%; margin-left: 2px; }
            
            /* Team Info */
            .team-info {
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                text-align: center;
                background: rgba(0,0,0,0.5);
            }
            
            .team-score {
                display: flex;
                align-items: center;
                gap: 20px;
                font-size: 24px;
                font-weight: bold;
            }
            
            .team.alpha { color: #00aaff; }
            .team.bravo { color: #ff4444; }
            
            .match-timer {
                font-size: 28px;
                margin-top: 5px;
            }
            
            /* Minimap */
            .minimap-container {
                top: 20px;
                right: 20px;
                width: 200px;
                height: 220px;
            }
            
            #minimap {
                border: 2px solid rgba(0, 255, 0, 0.5);
                border-radius: 50%;
            }
            
            .compass {
                position: absolute;
                top: 5px;
                left: 50%;
                transform: translateX(-50%);
                color: #0f0;
                font-weight: bold;
            }
            
            /* Health */
            .health-panel {
                bottom: 20px;
                left: 20px;
                width: 250px;
            }
            
            .health-bar-container, .armor-bar-container {
                position: relative;
                height: 20px;
                background: rgba(0,0,0,0.5);
                margin-bottom: 5px;
                border-radius: 2px;
                overflow: hidden;
            }
            
            .health-bar, .armor-bar {
                height: 100%;
                transition: width 0.2s, background 0.2s;
            }
            
            .health-bar.healthy { background: linear-gradient(90deg, #0f0, #0a0); }
            .health-bar.warning { background: linear-gradient(90deg, #ff0, #aa0); }
            .health-bar.critical { background: linear-gradient(90deg, #f00, #a00); animation: pulse 0.5s infinite; }
            
            .armor-bar { background: linear-gradient(90deg, #aaf, #66f); }
            
            .health-text {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-weight: bold;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            /* Weapon */
            .weapon-panel {
                bottom: 20px;
                right: 20px;
                text-align: right;
            }
            
            .ammo-counter {
                font-size: 48px;
                font-weight: bold;
            }
            
            .current-ammo { color: #fff; }
            .current-ammo.low { color: #ff0; }
            .current-ammo.empty { color: #f00; animation: blink 0.5s infinite; }
            
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
            
            .ammo-separator { color: #888; font-size: 32px; }
            .reserve-ammo { color: #888; font-size: 32px; }
            
            .weapon-icons {
                display: flex;
                gap: 5px;
                margin-top: 10px;
                justify-content: flex-end;
            }
            
            .weapon-slot {
                width: 30px;
                height: 30px;
                border: 2px solid #444;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
            }
            
            .weapon-slot.active {
                border-color: #0f0;
                background: rgba(0, 255, 0, 0.2);
            }
            
            /* Kill Feed */
            .kill-feed {
                position: absolute;
                top: 100px;
                right: 20px;
                width: 300px;
                text-align: right;
            }
            
            .kill-feed-entry {
                background: rgba(0,0,0,0.6);
                padding: 5px 10px;
                margin-bottom: 3px;
                font-size: 14px;
                animation: slideIn 0.3s;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            .killer { color: #0af; }
            .victim { color: #f44; }
            .headshot-icon { color: #ff0; margin: 0 5px; }
            
            /* Hit Marker */
            .hit-marker {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 40px;
                height: 40px;
                display: none;
            }
            
            .hit-marker.critical .marker-x {
                color: #ff0;
                font-size: 40px;
            }
            
            .hit-marker.kill .marker-x {
                color: #f00;
                font-size: 50px;
            }
            
            .marker-x {
                position: absolute;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 30px;
                color: #fff;
            }
            
            .marker-x::before {
                content: '✕';
            }
            
            /* Scoreboard */
            .scoreboard {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 800px;
                max-height: 80vh;
                background: rgba(0, 10, 20, 0.95);
                border: 2px solid rgba(0, 255, 255, 0.5);
                pointer-events: auto;
            }
            
            .scoreboard-header {
                padding: 20px;
                text-align: center;
                border-bottom: 1px solid rgba(0, 255, 255, 0.3);
            }
            
            .sb-scores {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 10px;
                font-size: 32px;
            }
            
            .scoreboard-body {
                display: flex;
                padding: 20px;
                gap: 20px;
            }
            
            .sb-column {
                flex: 1;
            }
            
            .sb-player-row {
                display: flex;
                justify-content: space-between;
                padding: 8px;
                background: rgba(255,255,255,0.05);
                margin-bottom: 3px;
            }
            
            /* Chat */
            .chat-container {
                position: absolute;
                bottom: 150px;
                left: 20px;
                width: 400px;
            }
            
            .chat-messages {
                max-height: 200px;
                overflow-y: auto;
                font-size: 14px;
            }
            
            .chat-message {
                margin-bottom: 3px;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
            }
            
            .chat-message.team { color: #0f0; }
            .chat-message.all { color: #fff; }
            
            .chat-input {
                width: 100%;
                padding: 8px;
                background: rgba(0,0,0,0.7);
                border: 1px solid #0ff;
                color: #fff;
                margin-top: 5px;
                pointer-events: auto;
            }
            
            /* Damage Indicators */
            .damage-indicators {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 300px;
                height: 300px;
            }
            
            .damage-indicator {
                position: absolute;
                width: 0;
                height: 0;
                border-left: 10px solid transparent;
                border-right: 10px solid transparent;
                border-bottom: 30px solid rgba(255, 0, 0, 0.8);
                transform-origin: 50% 150px;
            }
            
            ${Array.from({length: 8}, (_, i) => {
                const angle = i * 45;
                return `.damage-indicator.dir-${i} { transform: rotate(${angle}deg); top: 0; left: 50%; margin-left: -10px; }`;
            }).join('\n')}
        `;
        
        document.head.appendChild(style);
    }

    toggleVisibility(show) {
        this.isVisible = show;
        this.container.style.display = show ? 'block' : 'none';
    }

    destroy() {
        this.container.remove();
    }
}

export default HUD;