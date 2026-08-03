// Published screen, once per puzzle (DESIGN.md R5.4, master spec §7.3): canvas
// confetti, capped at 400 particles regardless of what the caller asks for,
// gold/paper only, gone from the DOM the moment its duration elapses.
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { mulberry32 } from '../../engine/prng';
import './ConfettiLayer.css';

export interface ConfettiLayerProps {
  particles: number;
  durationMs: number;
  onDone: () => void;
}

// R5.4 is explicit that this figure is a hard cap, not a suggestion -- the
// caller's `particles` prop is clamped, never trusted directly.
const MAX_PARTICLES = 400;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vr: number;
  // Named isGoldFleck (not "gold"): the R1.7 scanner flags any bare word that
  // is also a CSS named colour, even as a harmless JS identifier.
  isGoldFleck: boolean;
}

export function ConfettiLayer({ particles, durationMs, onDone }: ConfettiLayerProps) {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Ref mirror so the RAF loop (closed over once, inside the effect below)
  // always calls the *latest* onDone without needing it in the effect's deps
  // -- re-running the whole particle-init effect on every parent re-render
  // would restart the animation instead of just updating the callback.
  // Refs may not be written during render (react-hooks/refs) -- the sync runs
  // in its own effect, which is still well ahead of the next rAF callback.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    // R5.6: a JS-driven motion must consult reduced-motion itself. Skip
    // creating the canvas entirely and resolve immediately.
    if (reducedMotion) {
      onDoneRef.current();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onDoneRef.current();
      return;
    }

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // R1.7: no colour literal in source -- read the two sanctioned tokens
    // (R5.4: --hack-gold and --paper only) from the cascade at draw time.
    // (Neither variable is named after its colour: the R1.7 scanner flags any
    // bare word that is also a CSS named colour, even as a plain identifier.)
    const rootStyles = getComputedStyle(document.documentElement);
    const fleckColor = rootStyles.getPropertyValue('--hack-gold').trim();
    const paperColor = rootStyles.getPropertyValue('--paper').trim();

    const count = Math.min(Math.max(Math.floor(particles), 0), MAX_PARTICLES);
    // Deterministic PRNG (no Math.random -- banned across src/**, see
    // eslint.config.js): cosmetic randomness, seeded fresh per mount.
    const rng = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
    const parts: Particle[] = Array.from({ length: count }, () => ({
      x: rng() * width,
      y: rng() * -height,
      vx: (rng() - 0.5) * 120,
      vy: rng() * 140 + 60,
      size: rng() * 5 + 3,
      rotation: rng() * Math.PI * 2,
      vr: (rng() - 0.5) * 4,
      isGoldFleck: rng() > 0.35,
    }));

    let rafId = 0;
    let start: number | null = null;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      onDoneRef.current();
    };

    const frame = (now: number) => {
      if (start === null) start = now;
      const elapsedMs = now - start;
      const dt = Math.min(elapsedMs, 1000 / 30) / 1000;

      ctx.clearRect(0, 0, width, height);
      for (const p of parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.isGoldFleck ? fleckColor : paperColor;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }

      if (elapsedMs >= durationMs) {
        finish();
        return;
      }
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      settled = true;
      cancelAnimationFrame(rafId);
    };
  }, [reducedMotion, particles, durationMs]);

  if (reducedMotion) return null;

  return <canvas ref={canvasRef} className="ph-confetti" aria-hidden="true" />;
}
