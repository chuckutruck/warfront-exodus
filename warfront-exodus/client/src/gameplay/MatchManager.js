/**
 * WARFRONT: EXODUS - Match Manager
 * Gestión de partidas, modos de juego, puntuación, temporizador
 */

class MatchManager {
    constructor(engine) {
        this.engine = engine;
        this.currentMatch = null;
        this.gameMode = null;
        this.teams = {
            alpha: { score: 0, players: [] },
            bravo: { score: 0, players: [] }
        };
        
        this.matchState = 'waiting'; // waiting, warmup, playing, overtime, ended
        this.timeRemaining = 0;
        this.scoreLimit = 50;
        this.timeLimit = 600; // 10 minutos
        
        this.objectives = [];
        this.spawnPoints = [];
        
        // Callbacks
        this.onMatchStart = null;
        this.onMatchEnd = null;
        this.onScoreUpdate = null;
        this.onTimeUpdate = null;
    }

    initialize(mode, map, settings = {}) {
        this.gameMode = this.createGameMode(mode);
        this.currentMatch = {
            mode: mode,
            map: map,
            startTime: null,
            settings: {
                scoreLimit: settings.scoreLimit || 50,
                timeLimit: settings.timeLimit || 600,
                friendlyFire: settings.friendlyFire || false,
                respawnDelay: settings.respawnDelay || 3
            }
        };
        
        this.scoreLimit = this.currentMatch.settings.scoreLimit;
        this.timeLimit = this.currentMatch.settings.timeLimit;
        
        // Cargar puntos de spawn del mapa
        this.loadSpawnPoints(map);
        
        // Inicializar objetivos según modo
        this.gameMode.initialize(this);
    }

    createGameMode(modeType) {
        const modes = {
            'team_deathmatch': new TeamDeathmatchMode(),
            'capture_flag': new CaptureTheFlagMode(),
            'domination': new DominationMode(),
            'search_destroy': new SearchDestroyMode(),
            'free_for_all': new FreeForAllMode(),
            'zombies': new ZombieMode()
        };
        
        return modes[modeType] || modes['team_deathmatch'];
    }

    loadSpawnPoints(mapName) {
        // Cargar desde configuración de mapa
        const mapData = this.getMapData(mapName);
        this.spawnPoints = mapData.spawnPoints || [];
        this.objectives = mapData.objectives || [];
    }

    getMapData(mapName) {
        const maps = {
            'alien_wasteland': {
                spawnPoints: {
                    alpha: [{ x: -50, y: 2, z: 0 }, { x: -45, y: 2, z: 10 }],
                    bravo: [{ x: 50, y: 2, z: 0 }, { x: 45, y: 2, z: -10 }]
                },
                objectives: []
            }
        };
        
        return maps[mapName] || maps['alien_wasteland'];
    }

    startMatch() {
        this.matchState = 'warmup';
        this.timeRemaining = 10; // Warmup de 10 segundos
        
        // Asignar equipos
        this.assignTeams();
        
        // Spawn inicial
        this.respawnAllPlayers();
        
        // Iniciar temporizador
        this.startTimer();
        
        if (this.onMatchStart) this.onMatchStart(this.currentMatch);
    }

    assignTeams() {
        const players = Array.from(this.engine.players.values());
        let alphaCount = 0;
        let bravoCount = 0;
        
        players.forEach(player => {
            if (player.team === 'alpha') alphaCount++;
            else if (player.team === 'bravo') bravoCount++;
        });
        
        // Balancear
        players.forEach(player => {
            if (!player.team) {
                if (alphaCount <= bravoCount) {
                    player.team = 'alpha';
                    alphaCount++;
                } else {
                    player.team = 'bravo';
                    bravoCount++;
                }
            }
            
            this.teams[player.team].players.push(player.id);
        });
    }

    respawnAllPlayers() {
        this.engine.players.forEach(player => {
            if (player.isAlive) return;
            this.respawnPlayer(player);
        });
    }

    respawnPlayer(player) {
        const teamSpawns = this.spawnPoints[player.team] || this.spawnPoints.alpha;
        const spawnPoint = this.selectBestSpawn(teamSpawns, player.team);
        
        player.respawn(spawnPoint);
        
        // Dar loadout según modo
        this.gameMode.giveLoadout(player);
    }

    selectBestSpawn(spawnPoints, team) {
        // Seleccionar spawn más alejado de enemigos
        let bestSpawn = spawnPoints[0];
        let maxDistance = 0;
        
        spawnPoints.forEach(spawn => {
            let minEnemyDistance = Infinity;
            
            this.engine.players.forEach(player => {
                if (player.team !== team && player.isAlive) {
                    const dist = player.position.distanceTo(spawn);
                    minEnemyDistance = Math.min(minEnemyDistance, dist);
                }
            });
            
            if (minEnemyDistance > maxDistance) {
                maxDistance = minEnemyDistance;
                bestSpawn = spawn;
            }
        });
        
        return bestSpawn;
    }

    startTimer() {
        const timer = setInterval(() => {
            if (this.matchState === 'ended') {
                clearInterval(timer);
                return;
            }
            
            this.timeRemaining--;
            
            if (this.timeRemaining <= 0) {
                this.handleTimeExpired();
            }
            
            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.timeRemaining);
            }
        }, 1000);
    }

    handleTimeExpired() {
        if (this.matchState === 'warmup') {
            this.matchState = 'playing';
            this.timeRemaining = this.timeLimit;
            this.currentMatch.startTime = Date.now();
        } else if (this.matchState === 'playing') {
            this.endMatch('time_limit');
        }
    }

    addScore(team, points) {
        this.teams[team].score += points;
        
        if (this.onScoreUpdate) {
            this.onScoreUpdate(team, this.teams[team].score);
        }
        
        // Verificar límite de puntuación
        if (this.teams[team].score >= this.scoreLimit) {
            this.endMatch('score_limit', team);
        }
    }

    registerKill(killer, victim) {
        this.gameMode.handleKill(this, killer, victim);
    }

    endMatch(reason, winner = null) {
        this.matchState = 'ended';
        
        if (!winner) {
            // Determinar ganador por puntuación
            if (this.teams.alpha.score > this.teams.bravo.score) {
                winner = 'alpha';
            } else if (this.teams.bravo.score > this.teams.alpha.score) {
                winner = 'bravo';
            } else {
                winner = 'draw';
            }
        }
        
        const results = {
            winner: winner,
            reason: reason,
            duration: this.currentMatch.settings.timeLimit - this.timeRemaining,
            finalScore: {
                alpha: this.teams.alpha.score,
                bravo: this.teams.bravo.score
            },
            playerStats: this.compilePlayerStats()
        };
        
        if (this.onMatchEnd) this.onMatchEnd(results);
        
        // Guardar resultados
        this.saveMatchResults(results);
    }

    compilePlayerStats() {
        const stats = {};
        
        this.engine.players.forEach(player => {
            stats[player.id] = {
                name: player.name,
                team: player.team,
                kills: player.stats.kills,
                deaths: player.stats.deaths,
                assists: player.stats.assists,
                score: this.calculatePlayerScore(player)
            };
        });
        
        return stats;
    }

    calculatePlayerScore(player) {
        return (player.stats.kills * 100) - 
               (player.stats.deaths * 50) + 
               (player.stats.assists * 25);
    }

    saveMatchResults(results) {
        // Enviar a Firebase
        this.engine.network?.send('matchEnd', results);
    }

    syncState(state) {
        // Sincronizar desde servidor
        this.timeRemaining = state.timeRemaining;
        this.teams.alpha.score = state.scores.alpha;
        this.teams.bravo.score = state.scores.bravo;
        this.matchState = state.phase;
    }

    getTeamScore(team) {
        return this.teams[team]?.score || 0;
    }

    getMatchTime() {
        return this.timeRemaining;
    }

    isFriendlyFireEnabled() {
        return this.currentMatch?.settings.friendlyFire || false;
    }
}

// MODOS DE JUEGO

class TeamDeathmatchMode {
    initialize(manager) {
        manager.scoreLimit = manager.currentMatch.settings.scoreLimit;
    }

    handleKill(manager, killer, victim) {
        if (killer.team === victim.team) {
            // Team kill
            if (manager.isFriendlyFireEnabled()) {
                manager.addScore(killer.team, -1);
            }
        } else {
            manager.addScore(killer.team, 1);
            killer.stats.kills++;
        }
        
        victim.stats.deaths++;
        
        // Respawn
        setTimeout(() => {
            manager.respawnPlayer(victim);
        }, manager.currentMatch.settings.respawnDelay * 1000);
    }

    giveLoadout(player) {
        // Loadout estándar
        player.giveWeapon('ar_standard');
        player.giveWeapon('pistol_standard');
    }
}

class CaptureTheFlagMode {
    initialize(manager) {
        manager.flags = {
            alpha: { heldBy: null, atBase: true, position: manager.objectives[0] },
            bravo: { heldBy: null, atBase: true, position: manager.objectives[1] }
        };
    }

    handleKill(manager, killer, victim) {
        // Si víctima llevaba bandera, soltarla
        Object.keys(manager.flags).forEach(team => {
            if (manager.flags[team].heldBy === victim.id) {
                manager.dropFlag(team, victim.position);
            }
        });
    }

    captureFlag(player, enemyTeam) {
        this.flags[enemyTeam].heldBy = player.id;
        this.flags[enemyTeam].atBase = false;
    }

    dropFlag(team, position) {
        this.flags[team].heldBy = null;
        this.flags[team].position = position;
    }

    returnFlag(team) {
        this.flags[team].atBase = true;
        this.flags[team].heldBy = null;
    }
}

class DominationMode {
    initialize(manager) {
        manager.zones = manager.objectives.map((obj, i) => ({
            id: i,
            position: obj,
            owner: null,
            contested: false,
            captureProgress: 0
        }));
    }

    handleKill(manager, killer, victim) {
        // Puntos por kills cerca de zonas
    }

    updateZones() {
        // Lógica de captura
    }
}

class SearchDestroyMode {
    initialize(manager) {
        this.rounds = {
            alpha: 0,
            bravo: 0
        };
        this.currentRound = 1;
        this.planted = false;
        this.bombPosition = null;
    }

    handleKill(manager, killer, victim) {
        // Sin respawn hasta siguiente ronda
    }
}

class FreeForAllMode {
    initialize(manager) {
        manager.scoreLimit = 30;
    }

    handleKill(manager, killer, victim) {
        manager.addScore(killer.id, 1);
    }

    giveLoadout(player) {
        player.giveWeapon('smg_tactical');
    }
}

class ZombieMode {
    initialize(manager) {
        manager.wave = 0;
        manager.zombies = [];
        manager.survivors = [];
    }

    handleKill(manager, killer, victim) {
        if (victim.isZombie) {
            killer.stats.zombieKills++;
        }
    }

    spawnWave() {
        // Spawn zombies
    }
}

export default MatchManager;