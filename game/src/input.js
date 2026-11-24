// Keyboard and mouse: held keys, one-shot presses, pointer-lock mouse look, fire and wheel.
const SWALLOW = ['Space', 'ArrowUp', 'ArrowDown', 'Tab'];

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.wantLock = false;
    addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (SWALLOW.includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
      if (this.wantLock && document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.dx += e.movementX;
        this.dy += e.movementY;
      }
    });
    addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
    });
  }
  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }
  endFrame() {
    this.pressed.clear();
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
  }
}
