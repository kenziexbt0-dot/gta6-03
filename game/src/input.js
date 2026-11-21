// Solmarina — keyboard and mouse input.
// One object holds the live state; the game loop reads it, never the DOM events.

import { KEYS } from './config.js';

// Build a fresh input state object.
export function createInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    punch: false,
    shoot: false,
    // Edge-triggered actions: true for exactly one frame after the key goes down.
    enterCarPressed: false,
    pausePressed: false,
    savePressed: false,
    loadPressed: false,
    mutePressed: false,
    // Mouse position in screen pixels, and whether the button is held.
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
    // Synthetic input the screenshot autopilot writes into; real keys override it.
    auto: null,
    // Set by the main loop while a menu is up, so held keys do not leak through.
    frozen: false,
  };
}

// Attach listeners to the window. Returns a cleanup function.
export function attachInput(input, canvas) {
  const held = new Set();

  function actionFor(code) {
    for (const [action, codes] of Object.entries(KEYS)) {
      if (codes.includes(code)) return action;
    }
    return null;
  }

  function onKeyDown(event) {
    if (event.repeat) return;
    const action = actionFor(event.code);
    if (!action) return;
    if (['up', 'down', 'left', 'right', 'shoot'].includes(action)) event.preventDefault();
    held.add(action);
    syncHeld(input, held);
    if (action === 'enterCar') input.enterCarPressed = true;
    if (action === 'pause') input.pausePressed = true;
    if (action === 'save') input.savePressed = true;
    if (action === 'load') input.loadPressed = true;
    if (action === 'mute') input.mutePressed = true;
  }

  function onKeyUp(event) {
    const action = actionFor(event.code);
    if (!action) return;
    held.delete(action);
    syncHeld(input, held);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    onMouseMove(event);
    input.mouseDown = true;
    input.mouseClicked = true;
  }

  function onMouseUp(event) {
    if (event.button !== 0) return;
    input.mouseDown = false;
  }

  function onBlur() {
    held.clear();
    syncHeld(input, held);
    input.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return function detachInput() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  };
}

// Copy the held-key set into the live input flags.
function syncHeld(input, held) {
  input.up = held.has('up');
  input.down = held.has('down');
  input.left = held.has('left');
  input.right = held.has('right');
  input.run = held.has('run');
  input.punch = held.has('punch');
  input.shoot = held.has('shoot') || input.mouseDown;
}

// Clear the one-frame edge flags. The main loop calls this at the end of each frame.
export function endFrameInput(input) {
  input.enterCarPressed = false;
  input.pausePressed = false;
  input.savePressed = false;
  input.loadPressed = false;
  input.mutePressed = false;
  input.mouseClicked = false;
}

// Read an action, letting the screenshot autopilot override the real keys.
export function readAction(input, action) {
  if (input.auto && input.auto[action] !== undefined) return input.auto[action];
  return input[action];
}
