// Keyboard, mouse, left move-stick and right-side aim-stick (twin-stick on mobile).
import * as THREE from 'three';
import { camera, renderer } from './scene';
import { heightAt } from './world';
import { initAudio } from './audio';
import { $, V, player } from './state';

export const keys = new Set<string>();
export const pressed = new Set<string>();
export const stickVec = new THREE.Vector2();
export const aimVec = new THREE.Vector2();
export const inp = { mouseDown: false, mouseOnScreen: false, atkHeld: false };
const mouseNdc = new THREE.Vector2();
let onKey: (k: string) => void = () => {};
export const setKeyHandler = (f: (k: string) => void) => { onKey = f; };

export function initInput() {
  addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const k = e.key.toLowerCase(); if (k === 'tab') e.preventDefault();
    if (!keys.has(k)) pressed.add(k); keys.add(k); onKey(k);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  const cv = renderer.domElement;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; mouseNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); inp.mouseOnScreen = true; });
  cv.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; initAudio(); if (e.button === 0) { inp.mouseDown = true; pressed.add('atk'); } if (e.button === 2) pressed.add('f'); });
  addEventListener('pointerup', (e) => { if (e.button === 0) inp.mouseDown = false; });

  // left: movement stick
  const stick = $('#stick'), knob = $('#knob'); let sid = -1, sc = { x: 0, y: 0 };
  const move = (e: PointerEvent) => { let dx = e.clientX - sc.x, dy = e.clientY - sc.y; const l = Math.hypot(dx, dy), mx = 48; if (l > mx) { dx *= mx / l; dy *= mx / l; } stickVec.set(dx / mx, dy / mx); knob.style.transform = `translate(${dx}px,${dy}px)`; };
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); sc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; try { stick.setPointerCapture(e.pointerId); } catch {} move(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) move(e); });
  const end = (e: PointerEvent) => { if (e.pointerId !== sid) return; sid = -1; stickVec.set(0, 0); knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end); stick.addEventListener('lostpointercapture', end as any);

  // right: drag anywhere in the free right area to aim + hold basic attack
  const az = $('#aimZone'), ring = $('#aimRing'), dot = ring.firstElementChild as HTMLElement; let aid = -1, ac = { x: 0, y: 0 };
  az.addEventListener('pointerdown', (e) => { aid = e.pointerId; ac = { x: e.clientX, y: e.clientY }; try { az.setPointerCapture(e.pointerId); } catch {} ring.style.display = 'block'; ring.style.left = ac.x + 'px'; ring.style.top = ac.y + 'px'; dot.style.transform = ''; initAudio(); });
  az.addEventListener('pointermove', (e) => {
    if (e.pointerId !== aid) return; let dx = e.clientX - ac.x, dy = e.clientY - ac.y; const l = Math.hypot(dx, dy);
    if (l > 12) { aimVec.set(dx / l, dy / l); inp.atkHeld = true; player.aimT = 0.6; }
    if (l > 40) { dx *= 40 / l; dy *= 40 / l; } dot.style.transform = `translate(${dx}px,${dy}px)`;
  });
  const endA = (e: PointerEvent) => { if (e.pointerId !== aid) return; aid = -1; inp.atkHeld = false; ring.style.display = 'none'; };
  az.addEventListener('pointerup', endA); az.addEventListener('pointercancel', endA);

  // touch action buttons
  const map: Record<string, string> = { q: 'q', e: 'e', r: 'r', dash: ' ', parry: 'f', lock: 'tab', atk: 'atk', catch: 'c' };
  document.querySelectorAll<HTMLElement>('#tbtns button').forEach((b) => {
    const a = b.dataset.a!;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); initAudio(); pressed.add(map[a]); if (a === 'atk') inp.atkHeld = true; });
    const up = () => { if (a === 'atk') inp.atkHeld = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
  });

  // block iOS double-tap / pinch zoom
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  let lastEnd = 0;
  document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastEnd < 350 && !(e.target as HTMLElement).closest('input,select,.scrollable')) e.preventDefault(); lastEnd = n; }, { passive: false });
  for (const sel of ['#touch', '#gl', '#hud']) document.querySelector(sel)!.addEventListener('touchstart', (e) => { if (e.cancelable && !(e.target as HTMLElement).closest('button,canvas#minimap')) e.preventDefault(); }, { passive: false });
}

const ray = new THREE.Raycaster(), plane = new THREE.Plane(V(0, 1, 0), 0);
export function mouseGround() { plane.constant = -heightAt(player.pos.x, player.pos.z); ray.setFromCamera(mouseNdc, camera); const p = V(); return ray.ray.intersectPlane(plane, p) ? p : null; }
export function moveVec() {
  const mv = V(); if (keys.has('w') || keys.has('arrowup')) mv.z -= 1; if (keys.has('s') || keys.has('arrowdown')) mv.z += 1;
  if (keys.has('a') || keys.has('arrowleft')) mv.x -= 1; if (keys.has('d') || keys.has('arrowright')) mv.x += 1;
  if (stickVec.lengthSq() > 0.02) mv.set(stickVec.x, 0, stickVec.y); if (mv.lengthSq() > 1) mv.normalize(); return mv;
}
