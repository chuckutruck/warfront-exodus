/**
 * Gestión de Input - PC y Móvil
 * Soporte completo para teclado/ratón y controles táctiles
 */

class InputManager {
    constructor() {
        // Estado de teclas
        this.keys = new Map();
        this.keysPressed = new Map(); // Solo un frame
        this.keysReleased = new Map();
        
        // Ratón
        this.mouse = {
            x: 0,
            y: 0,
            deltaX: 0,
            deltaY: 0,
            locked: false,
            buttons: { left: false, right: false, middle: false }
        };
        
        // Joystick móvil
        this.touch = {
            leftStick: { x: 0, y: 0, active: false, id: null },
            rightStick: { x: 0, y: 0, active: false, id: null },
            buttons: new Map()
        };
        
        // Configuración
        this.sensitivity = {
            mouse: 1.0,
            touch: 2.0
        };
        
        // Bindings
        this.keyBindings = {
            'forward': ['KeyW', 'ArrowUp'],
            'backward': ['KeyS', 'ArrowDown'],
            'left': ['KeyA', 'ArrowLeft'],
            'right': ['KeyD', 'ArrowRight'],
            'sprint': ['ShiftLeft', 'ShiftRight'],
            'crouch': ['ControlLeft', 'KeyC'],
            'prone': ['KeyZ'],
            'jump': ['Space'],
            'fire': ['Mouse0'],
            'aim': ['Mouse2'],
            'reload': ['KeyR'],
            'weapon1': ['Digit1'],
            'weapon2': ['Digit2'],
            'weapon3': ['Digit3'],
            'melee': ['KeyV'],
            'use': ['KeyE'],
            'scoreboard': ['Tab'],
            'chat': ['Enter'],
            'menu': ['Escape']
        };
        
        this.init();
    }

    init() {
        // Teclado
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Ratón
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        document.addEventListener('mouseup', (e) => this.onMouseUp(e));
        document.addEventListener('wheel', (e) => this.onWheel(e));
        
        // Pointer lock para FPS
        document.addEventListener('pointerlockchange', () => {
            this.mouse.locked = document.pointerLockElement !== null;
        });
        
        // Touch (móvil)
        document.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.onTouchEnd(e));
        document.addEventListener('touchcancel', (e) => this.onTouchEnd(e));
        
        // Prevenir menú contextual
        document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onKeyDown(event) {
        const code = event.code;
        
        if (!this.keys.get(code)) {
            this.keysPressed.set(code, true);
        }
        
        this.keys.set(code, true);
        
        // Prevenir defaults para teclas de juego
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) {
            event.preventDefault();
        }
    }

    onKeyUp(event) {
        const code = event.code;
        this.keys.set(code, false);
        this.keysReleased.set(code, true);
    }

    onMouseMove(event) {
        if (this.mouse.locked) {
            this.mouse.deltaX = event.movementX * this.sensitivity.mouse;
            this.mouse.deltaY = event.movementY * this.sensitivity.mouse;
        } else {
            this.mouse.x = event.clientX;
            this.mouse.y = event.clientY;
        }
    }

    onMouseDown(event) {
        switch(event.button) {
            case 0: this.mouse.buttons.left = true; break;
            case 1: this.mouse.buttons.middle = true; break;
            case 2: this.mouse.buttons.right = true; break;
        }
    }

    onMouseUp(event) {
        switch(event.button) {
            case 0: this.mouse.buttons.left = false; break;
            case 1: this.mouse.buttons.middle = false; break;
            case 2: this.mouse.buttons.right = false; break;
        }
    }

    onWheel(event) {
        // Cambio de arma con scroll
        this.wheelDelta = event.deltaY;
    }

    // Touch controls para móvil
    onTouchStart(event) {
        event.preventDefault();
        
        for (let touch of event.changedTouches) {
            const x = touch.clientX;
            const y = touch.clientY;
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            // Zona izquierda: movimiento
            if (x < width * 0.4 && !this.touch.leftStick.active) {
                this.touch.leftStick.active = true;
                this.touch.leftStick.id = touch.identifier;
                this.touch.leftStick.startX = x;
                this.touch.leftStick.startY = y;
                this.touch.leftStick.currentX = x;
                this.touch.leftStick.currentY = y;
            }
            // Zona derecha: cámara
            else if (x > width * 0.6 && !this.touch.rightStick.active) {
                this.touch.rightStick.active = true;
                this.touch.rightStick.id = touch.identifier;
                this.touch.rightStick.startX = x;
                this.touch.rightStick.startY = y;
                this.touch.rightStick.lastX = x;
                this.touch.rightStick.lastY = y;
            }
            // Botones de acción
            else {
                this.checkTouchButtons(x, y, true);
            }
        }
    }

    onTouchMove(event) {
        event.preventDefault();
        
        for (let touch of event.changedTouches) {
            // Actualizar joystick izquierdo
            if (touch.identifier === this.touch.leftStick.id) {
                const dx = touch.clientX - this.touch.leftStick.startX;
                const dy = touch.clientY - this.touch.leftStick.startY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const maxDistance = 50;
                
                const scale = distance > maxDistance ? maxDistance / distance : 1;
                
                this.touch.leftStick.x = (dx * scale) / maxDistance;
                this.touch.leftStick.y = -(dy * scale) / maxDistance; // Invertir Y
            }
            // Actualizar joystick derecho (cámara)
            else if (touch.identifier === this.touch.rightStick.id) {
                const dx = touch.clientX - this.touch.rightStick.lastX;
                const dy = touch.clientY - this.touch.rightStick.lastY;
                
                this.mouse.deltaX = dx * this.sensitivity.touch;
                this.mouse.deltaY = dy * this.sensitivity.touch;
                
                this.touch.rightStick.lastX = touch.clientX;
                this.touch.rightStick.lastY = touch.clientY;
            }
        }
    }

    onTouchEnd(event) {
        for (let touch of event.changedTouches) {
            if (touch.identifier === this.touch.leftStick.id) {
                this.touch.leftStick.active = false;
                this.touch.leftStick.x = 0;
                this.touch.leftStick.y = 0;
                this.touch.leftStick.id = null;
            }
            else if (touch.identifier === this.touch.rightStick.id) {
                this.touch.rightStick.active = false;
                this.touch.rightStick.id = null;
            }
            else {
                this.checkTouchButtons(touch.clientX, touch.clientY, false);
            }
        }
    }

    checkTouchButtons(x, y, pressed) {
        // Definir zonas de botones táctiles
        const buttons = [
            { name: 'fire', x: 0.85, y: 0.7, radius: 0.08 },
            { name: 'aim', x: 0.85, y: 0.5, radius: 0.06 },
            { name: 'reload', x: 0.7, y: 0.8, radius: 0.05 },
            { name: 'jump', x: 0.75, y: 0.6, radius: 0.05 },
            { name: 'crouch', x: 0.65, y: 0.7, radius: 0.05 },
            { name: 'weapon1', x: 0.9, y: 0.3, radius: 0.04 },
            { name: 'weapon2', x: 0.9, y: 0.2, radius: 0.04 }
        ];
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        buttons.forEach(btn => {
            const bx = btn.x * width;
            const by = btn.y * height;
            const br = btn.radius * Math.min(width, height);
            
            const distance = Math.sqrt((x - bx) ** 2 + (y - by) ** 2);
            if (distance < br) {
                this.touch.buttons.set(btn.name, pressed);
            }
        });
    }

    // API pública
    isPressed(action) {
        const keys = this.keyBindings[action] || [];
        
        // Teclado
        for (let key of keys) {
            if (key.startsWith('Mouse')) {
                const button = parseInt(key.replace('Mouse', ''));
                if (this.mouse.buttons[['left', 'middle', 'right'][button]]) {
                    return true;
                }
            } else if (this.keys.get(key)) {
                return true;
            }
        }
        
        // Touch
        if (this.touch.buttons.get(action)) {
            return true;
        }
        
        return false;
    }

    wasPressed(action) {
        const keys = this.keyBindings[action] || [];
        
        for (let key of keys) {
            if (this.keysPressed.get(key)) {
                this.keysPressed.set(key, false);
                return true;
            }
        }
        
        if (this.touch.buttons.get(action)) {
            // Reset después de leer
            // this.touch.buttons.set(action, false);
            return true;
        }
        
        return false;
    }

    getAxis(axis) {
        let value = 0;
        
        if (axis === 'vertical') {
            if (this.isPressed('forward')) value += 1;
            if (this.isPressed('backward')) value -= 1;
            
            // Touch joystick
            if (this.touch.leftStick.active) {
                value = this.touch.leftStick.y;
            }
        }
        else if (axis === 'horizontal') {
            if (this.isPressed('right')) value += 1;
            if (this.isPressed('left')) value -= 1;
            
            // Touch joystick
            if (this.touch.leftStick.active) {
                value = this.touch.leftStick.x;
            }
        }
        
        return value;
    }

    getLookDelta() {
        const delta = {
            x: this.mouse.deltaX,
            y: this.mouse.deltaY
        };
        
        // Reset después de leer
        this.mouse.deltaX = 0;
        this.mouse.deltaY = 0;
        
        return delta;
    }

    lockPointer() {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.requestPointerLock();
        }
    }

    unlockPointer() {
        document.exitPointerLock();
    }

    update() {
        // Limpiar estados de un frame
        this.keysPressed.clear();
        this.keysReleased.clear();
        this.wheelDelta = 0;
    }
}

export default InputManager;