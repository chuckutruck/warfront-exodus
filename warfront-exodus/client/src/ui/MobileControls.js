/**
 * WARFRONT: EXODUS - Mobile Controls
 * Joysticks táctiles optimizados para shooter en móvil
 */

class MobileControls {
    constructor(engine) {
        this.engine = engine;
        this.isMobile = this.detectMobile();
        this.active = false;
        
        // Zonas táctiles
        this.zones = {
            left: { x: 0, y: 0.5, width: 0.4, height: 1 },    // Movimiento
            right: { x: 0.6, y: 0.5, width: 0.4, height: 1 }   // Cámara
        };
        
        // Joysticks
        this.leftStick = {
            active: false,
            id: null,
            centerX: 0,
            centerY: 0,
            currentX: 0,
            currentY: 0,
            valueX: 0,
            valueY: 0
        };
        
        this.rightStick = {
            active: false,
            id: null,
            lastX: 0,
            lastY: 0,
            deltaX: 0,
            deltaY: 0
        };
        
        // Botones de acción
        this.buttons = {
            fire: { x: 0.85, y: 0.65, radius: 0.08, active: false },
            aim: { x: 0.75, y: 0.5, radius: 0.06, active: false },
            reload: { x: 0.9, y: 0.45, radius: 0.05, active: false },
            jump: { x: 0.7, y: 0.75, radius: 0.06, active: false },
            crouch: { x: 0.8, y: 0.8, radius: 0.05, active: false },
            weapon1: { x: 0.1, y: 0.25, radius: 0.05, active: false },
            weapon2: { x: 0.2, y: 0.2, radius: 0.05, active: false },
            melee: { x: 0.9, y: 0.3, radius: 0.05, active: false }
        };
        
        this.canvas = null;
        this.ctx = null;
        
        if (this.isMobile) {
            this.init();
        }
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        ) || window.innerWidth < 768;
    }

    init() {
        this.createCanvas();
        this.setupEventListeners();
        this.active = true;
        
        // Ocultar en PC
        if (!this.isMobile) {
            this.canvas.style.display = 'none';
        }
    }

    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'mobile-controls';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: auto;
            z-index: 100;
        `;
        
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        document.body.appendChild(this.canvas);
        
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Recalcular posiciones de botones
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        Object.keys(this.buttons).forEach(key => {
            const btn = this.buttons[key];
            btn.pixelX = btn.x * w;
            btn.pixelY = btn.y * h;
            btn.pixelRadius = btn.radius * Math.min(w, h);
        });
        
        this.zones.left.pixelX = 0;
        this.zones.left.pixelY = h * 0.3;
        this.zones.left.pixelWidth = w * 0.4;
        this.zones.left.pixelHeight = h * 0.7;
        
        this.zones.right.pixelX = w * 0.6;
        this.zones.right.pixelY = h * 0.3;
        this.zones.right.pixelWidth = w * 0.4;
        this.zones.right.pixelHeight = h * 0.7;
    }

    setupEventListeners() {
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));
    }

    handleTouchStart(e) {
        e.preventDefault();
        
        for (let touch of e.changedTouches) {
            const x = touch.clientX;
            const y = touch.clientY;
            
            // Verificar botones
            let buttonPressed = false;
            for (let [key, btn] of Object.entries(this.buttons)) {
                const dist = Math.hypot(x - btn.pixelX, y - btn.pixelY);
                if (dist < btn.pixelRadius) {
                    btn.active = true;
                    btn.touchId = touch.identifier;
                    this.onButtonDown(key);
                    buttonPressed = true;
                    break;
                }
            }
            
            if (buttonPressed) continue;
            
            // Zona izquierda - Joystick movimiento
            if (this.isInZone(x, y, this.zones.left)) {
                this.leftStick.active = true;
                this.leftStick.id = touch.identifier;
                this.leftStick.centerX = x;
                this.leftStick.centerY = y;
                this.leftStick.currentX = x;
                this.leftStick.currentY = y;
            }
            // Zona derecha - Joystick cámara
            else if (this.isInZone(x, y, this.zones.right)) {
                this.rightStick.active = true;
                this.rightStick.id = touch.identifier;
                this.rightStick.lastX = x;
                this.rightStick.lastY = y;
                this.rightStick.deltaX = 0;
                this.rightStick.deltaY = 0;
            }
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        
        for (let touch of e.changedTouches) {
            // Actualizar joystick izquierdo
            if (touch.identifier === this.leftStick.id) {
                const maxDist = 60;
                const dx = touch.clientX - this.leftStick.centerX;
                const dy = touch.clientY - this.leftStick.centerY;
                const dist = Math.hypot(dx, dy);
                const scale = dist > maxDist ? maxDist / dist : 1;
                
                this.leftStick.currentX = this.leftStick.centerX + dx * scale;
                this.leftStick.currentY = this.leftStick.centerY + dy * scale;
                
                // Valores normalizados -1 a 1
                this.leftStick.valueX = (dx * scale) / maxDist;
                this.leftStick.valueY = -(dy * scale) / maxDist; // Invertir Y
            }
            
            // Actualizar joystick derecho (cámara)
            if (touch.identifier === this.rightStick.id) {
                const sensitivity = 0.3;
                this.rightStick.deltaX = (touch.clientX - this.rightStick.lastX) * sensitivity;
                this.rightStick.deltaY = (touch.clientY - this.rightStick.lastY) * sensitivity;
                
                this.rightStick.lastX = touch.clientX;
                this.rightStick.lastY = touch.clientY;
            }
        }
    }

    handleTouchEnd(e) {
        for (let touch of e.changedTouches) {
            // Soltar joystick izquierdo
            if (touch.identifier === this.leftStick.id) {
                this.leftStick.active = false;
                this.leftStick.id = null;
                this.leftStick.valueX = 0;
                this.leftStick.valueY = 0;
            }
            
            // Soltar joystick derecho
            if (touch.identifier === this.rightStick.id) {
                this.rightStick.active = false;
                this.rightStick.id = null;
                this.rightStick.deltaX = 0;
                this.rightStick.deltaY = 0;
            }
            
            // Soltar botones
            for (let [key, btn] of Object.entries(this.buttons)) {
                if (btn.touchId === touch.identifier) {
                    btn.active = false;
                    btn.touchId = null;
                    this.onButtonUp(key);
                }
            }
        }
    }

    isInZone(x, y, zone) {
        return x >= zone.pixelX && 
               x <= zone.pixelX + zone.pixelWidth &&
               y >= zone.pixelY && 
               y <= zone.pixelY + zone.pixelHeight;
    }

    onButtonDown(button) {
        const input = this.engine.input;
        
        switch(button) {
            case 'fire':
                input.keys.set('Mouse0', true);
                break;
            case 'aim':
                input.keys.set('Mouse2', true);
                break;
            case 'reload':
                input.keys.set('KeyR', true);
                break;
            case 'jump':
                input.keys.set('Space', true);
                break;
            case 'crouch':
                input.keys.set('ControlLeft', true);
                break;
            case 'weapon1':
                input.keys.set('Digit1', true);
                break;
            case 'weapon2':
                input.keys.set('Digit2', true);
                break;
            case 'melee':
                input.keys.set('KeyV', true);
                break;
        }
    }

    onButtonUp(button) {
        const input = this.engine.input;
        
        switch(button) {
            case 'fire':
                input.keys.set('Mouse0', false);
                break;
            case 'aim':
                input.keys.set('Mouse2', false);
                break;
            case 'reload':
                input.keys.set('KeyR', false);
                break;
            case 'jump':
                input.keys.set('Space', false);
                break;
            case 'crouch':
                input.keys.set('ControlLeft', false);
                break;
            case 'weapon1':
                input.keys.set('Digit1', false);
                break;
            case 'weapon2':
                input.keys.set('Digit2', false);
                break;
            case 'melee':
                input.keys.set('KeyV', false);
                break;
        }
    }

    update() {
        if (!this.active) return;
        
        // Aplicar input a los joysticks
        if (this.leftStick.active) {
            this.engine.input.setAxis('horizontal', this.leftStick.valueX);
            this.engine.input.setAxis('vertical', this.leftStick.valueY);
        } else {
            this.engine.input.setAxis('horizontal', 0);
            this.engine.input.setAxis('vertical', 0);
        }
        
        if (this.rightStick.active) {
            this.engine.input.addLookDelta(
                this.rightStick.deltaX,
                this.rightStick.deltaY
            );
            this.rightStick.deltaX = 0;
            this.rightStick.deltaY = 0;
        }
        
        this.render();
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        ctx.clearRect(0, 0, w, h);
        
        // Dibujar joystick izquierdo
        if (this.leftStick.active) {
            // Base
            ctx.beginPath();
            ctx.arc(this.leftStick.centerX, this.leftStick.centerY, 60, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Stick
            ctx.beginPath();
            ctx.arc(this.leftStick.currentX, this.leftStick.currentY, 25, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
            ctx.fill();
        }
        
        // Dibujar joystick derecho (solo base cuando está activo)
        if (this.rightStick.active) {
            ctx.beginPath();
            ctx.arc(this.rightStick.lastX, this.rightStick.lastY, 40, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fill();
        }
        
        // Dibujar botones
        for (let [key, btn] of Object.entries(this.buttons)) {
            ctx.beginPath();
            ctx.arc(btn.pixelX, btn.pixelY, btn.pixelRadius, 0, Math.PI * 2);
            
            if (btn.active) {
                ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            }
            
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Icono/texto
            ctx.fillStyle = '#fff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const labels = {
                fire: '●',
                aim: '◎',
                reload: 'R',
                jump: '↑',
                crouch: '↓',
                weapon1: '1',
                weapon2: '2',
                melee: '⚔'
            };
            
            ctx.fillText(labels[key] || key, btn.pixelX, btn.pixelY);
        }
        
        // Ayuda visual de zonas (opcional, para debug)
        // this.drawZones();
    }

    drawZones() {
        const ctx = this.ctx;
        
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.strokeRect(
            this.zones.left.pixelX,
            this.zones.left.pixelY,
            this.zones.left.pixelWidth,
            this.zones.left.pixelHeight
        );
        
        ctx.strokeRect(
            this.zones.right.pixelX,
            this.zones.right.pixelY,
            this.zones.right.pixelWidth,
            this.zones.right.pixelHeight
        );
    }

    getLeftStick() {
        return {
            x: this.leftStick.valueX,
            y: this.leftStick.valueY,
            active: this.leftStick.active
        };
    }

    getRightStick() {
        return {
            deltaX: this.rightStick.deltaX,
            deltaY: this.rightStick.deltaY,
            active: this.rightStick.active
        };
    }

    isButtonPressed(button) {
        return this.buttons[button]?.active || false;
    }

    destroy() {
        this.canvas.remove();
        this.active = false;
    }
}

export default MobileControls;