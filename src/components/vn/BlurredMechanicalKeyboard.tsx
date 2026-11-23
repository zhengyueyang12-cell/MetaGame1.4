import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface BlurredMechanicalKeyboardProps {
  visible: boolean;
  /** Subtle LED tint shift when terminal / meta intrusion is active */
  anomalyTone?: boolean;
}

interface KeyDef {
  code: string;
  label: string;
  w: number; // width units (1u = standard keycap)
  role?: 'base' | 'mod' | 'accent' | 'space';
}

const KEYBOARD_ROWS: KeyDef[][] = [
  [
    { code: 'Escape', label: 'ESC', w: 1.05, role: 'accent' },
    { code: 'Digit1', label: '1', w: 1 },
    { code: 'Digit2', label: '2', w: 1 },
    { code: 'Digit3', label: '3', w: 1 },
    { code: 'Digit4', label: '4', w: 1 },
    { code: 'Digit5', label: '5', w: 1 },
    { code: 'Digit6', label: '6', w: 1 },
    { code: 'Digit7', label: '7', w: 1 },
    { code: 'Digit8', label: '8', w: 1 },
    { code: 'Digit9', label: '9', w: 1 },
    { code: 'Digit0', label: '0', w: 1 },
    { code: 'Minus', label: '-', w: 1 },
    { code: 'Equal', label: '=', w: 1 },
    { code: 'Backspace', label: 'BACK', w: 1.95, role: 'mod' },
  ],
  [
    { code: 'Tab', label: 'TAB', w: 1.45, role: 'mod' },
    { code: 'KeyQ', label: 'Q', w: 1 },
    { code: 'KeyW', label: 'W', w: 1 },
    { code: 'KeyE', label: 'E', w: 1 },
    { code: 'KeyR', label: 'R', w: 1 },
    { code: 'KeyT', label: 'T', w: 1 },
    { code: 'KeyY', label: 'Y', w: 1 },
    { code: 'KeyU', label: 'U', w: 1 },
    { code: 'KeyI', label: 'I', w: 1 },
    { code: 'KeyO', label: 'O', w: 1 },
    { code: 'KeyP', label: 'P', w: 1 },
    { code: 'BracketLeft', label: '[', w: 1 },
    { code: 'BracketRight', label: ']', w: 1 },
    { code: 'Backslash', label: '\\', w: 1.55, role: 'mod' },
  ],
  [
    { code: 'CapsLock', label: 'CAPS', w: 1.75, role: 'mod' },
    { code: 'KeyA', label: 'A', w: 1 },
    { code: 'KeyS', label: 'S', w: 1 },
    { code: 'KeyD', label: 'D', w: 1 },
    { code: 'KeyF', label: 'F', w: 1 },
    { code: 'KeyG', label: 'G', w: 1 },
    { code: 'KeyH', label: 'H', w: 1 },
    { code: 'KeyJ', label: 'J', w: 1 },
    { code: 'KeyK', label: 'K', w: 1 },
    { code: 'KeyL', label: 'L', w: 1 },
    { code: 'Semicolon', label: ';', w: 1 },
    { code: 'Quote', label: "'", w: 1 },
    { code: 'Enter', label: 'ENTER', w: 2.25, role: 'accent' },
  ],
  [
    { code: 'ShiftLeft', label: 'SHIFT', w: 2.25, role: 'mod' },
    { code: 'KeyZ', label: 'Z', w: 1 },
    { code: 'KeyX', label: 'X', w: 1 },
    { code: 'KeyC', label: 'C', w: 1 },
    { code: 'KeyV', label: 'V', w: 1 },
    { code: 'KeyB', label: 'B', w: 1 },
    { code: 'KeyN', label: 'N', w: 1 },
    { code: 'KeyM', label: 'M', w: 1 },
    { code: 'Comma', label: ',', w: 1 },
    { code: 'Period', label: '.', w: 1 },
    { code: 'Slash', label: '/', w: 1 },
    { code: 'ShiftRight', label: 'SHIFT', w: 2.75, role: 'mod' },
  ],
  [
    { code: 'ControlLeft', label: 'CTRL', w: 1.35, role: 'mod' },
    { code: 'MetaLeft', label: 'OS', w: 1.2, role: 'mod' },
    { code: 'AltLeft', label: 'ALT', w: 1.25, role: 'mod' },
    { code: 'Space', label: '', w: 6.45, role: 'space' },
    { code: 'AltRight', label: 'ALT', w: 1.25, role: 'mod' },
    { code: 'ArrowLeft', label: '◀', w: 1.15, role: 'mod' },
    { code: 'ArrowDown', label: '▼', w: 1.15, role: 'mod' },
    { code: 'ArrowRight', label: '▶', w: 1.2, role: 'mod' },
  ],
];

const ALL_KEY_CODES = new Set(KEYBOARD_ROWS.flat().map((k) => k.code));
const FALLBACK_TYPING_KEYS = [
  'KeyF',
  'KeyJ',
  'KeyD',
  'KeyK',
  'KeyS',
  'KeyL',
  'KeyA',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyI',
  'KeyO',
];

function resolveVisualKeyCode(e: KeyboardEvent): string {
  if (ALL_KEY_CODES.has(e.code)) return e.code;
  if (e.code === 'ArrowUp') return 'KeyW';
  if (e.code === 'NumpadEnter') return 'Enter';
  if (e.code === 'ControlRight') return 'ControlLeft';
  if (e.code === 'MetaRight') return 'MetaLeft';
  const k = e.key?.toUpperCase();
  if (k && k.length === 1 && k >= 'A' && k <= 'Z') return `Key${k}`;
  if (k && k.length === 1 && k >= '0' && k <= '9') return `Digit${k}`;
  return FALLBACK_TYPING_KEYS[Math.floor(Math.random() * FALLBACK_TYPING_KEYS.length)];
}

export function triggerKeyboardLedPulse(codes?: string[]): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('twilight-keyboard-pulse', {
      detail: { codes },
    })
  );
}

export const BlurredMechanicalKeyboard: React.FC<BlurredMechanicalKeyboardProps> = ({
  visible,
  anomalyTone = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({});
  const [litKeys, setLitKeys] = useState<Record<string, number>>({});
  const timeoutsRef = useRef<Map<string, number>>(new Map());
  const pulseSequenceTimersRef = useRef<number[]>([]);

  const flashKeyLed = useCallback((code: string, holdPressed = false, decayMs = 340) => {
    const existing = timeoutsRef.current.get(code);
    if (existing !== undefined) {
      window.clearTimeout(existing);
    }

    setLitKeys((prev) => ({ ...prev, [code]: Date.now() }));
    if (holdPressed) {
      setPressedKeys((prev) => ({ ...prev, [code]: true }));
    }

    const timer = window.setTimeout(() => {
      setLitKeys((prev) => {
        if (!(code in prev)) return prev;
        const next = { ...prev };
        delete next[code];
        return next;
      });
      if (holdPressed) {
        setPressedKeys((prev) => {
          if (!prev[code]) return prev;
          const next = { ...prev };
          delete next[code];
          return next;
        });
      }
      timeoutsRef.current.delete(code);
    }, decayMs);

    timeoutsRef.current.set(code, timer);
  }, []);

  useEffect(() => {
    const timeoutsMap = timeoutsRef.current;
    const pulseTimers = pulseSequenceTimersRef.current;

    if (!visible) {
      setPressedKeys({});
      setLitKeys({});
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const code = resolveVisualKeyCode(e);
      setPressedKeys((prev) => (prev[code] ? prev : { ...prev, [code]: true }));
      flashKeyLed(code, false, 360);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = resolveVisualKeyCode(e);
      setPressedKeys((prev) => {
        if (!prev[code]) return prev;
        const next = { ...prev };
        delete next[code];
        return next;
      });
    };

    const onCustomPulse = (evt: Event) => {
      const custom = evt as CustomEvent<{ codes?: string[] }>;
      const codes =
        custom.detail?.codes && custom.detail.codes.length > 0
          ? custom.detail.codes
          : [
              FALLBACK_TYPING_KEYS[Math.floor(Math.random() * FALLBACK_TYPING_KEYS.length)],
              FALLBACK_TYPING_KEYS[Math.floor(Math.random() * FALLBACK_TYPING_KEYS.length)],
              'Enter',
            ];

      codes.forEach((c, idx) => {
        const t = window.setTimeout(() => {
          flashKeyLed(c, true, 210);
        }, idx * 55);
        pulseTimers.push(t);
      });
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('twilight-keyboard-pulse', onCustomPulse);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('twilight-keyboard-pulse', onCustomPulse);
      for (const timer of timeoutsMap.values()) {
        window.clearTimeout(timer);
      }
      timeoutsMap.clear();
      for (const t of pulseTimers) {
        window.clearTimeout(t);
      }
      pulseTimers.length = 0;
    };
  }, [visible, flashKeyLed]);

  if (!visible) return null;

  const hasActiveLed = Object.keys(litKeys).length > 0;
  const ledRgb = anomalyTone ? '255, 118, 152' : '116, 226, 248';
  const ledSecondaryRgb = anomalyTone ? '255, 184, 140' : '255, 188, 138';

  return (
    <motion.div
      aria-hidden="true"
      initial={prefersReducedMotion ? { opacity: 0.92, y: 0 } : { opacity: 0, y: 26 }}
      animate={{ opacity: 0.92, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.34, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[35] flex justify-center overflow-hidden"
      style={{
        height: '132px',
        maskImage:
          'linear-gradient(to top, rgba(0,0,0,0.96) 24%, rgba(0,0,0,0.68) 72%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to top, rgba(0,0,0,0.96) 24%, rgba(0,0,0,0.68) 72%, transparent 100%)',
      }}
    >
      {/* Out-of-focus foreground depth-of-field mechanical keyboard deck */}
      <div
        className="relative flex flex-col items-center justify-end pb-1"
        style={{
          width: 'min(720px, 92vw)',
          transform: 'perspective(540px) rotateX(48deg) translateY(18px)',
          transformOrigin: '50% 100%',
          filter: 'blur(2.2px)',
        }}
      >
        {/* Subtle ambient breathing backlight across the keyboard deck */}
        <div
          className="animate-kbd-breathe pointer-events-none absolute -inset-x-6 -top-3 bottom-0 rounded-2xl"
          style={{
            background: `radial-gradient(ellipse 68% 58% at 50% 45%, rgba(${ledRgb}, 0.24), transparent 72%)`,
          }}
        />

        {/* Extra reactive ambient desk halo during active keystrokes (compositor opacity only) */}
        <div
          className="pointer-events-none absolute -inset-x-6 -top-3 bottom-0 rounded-2xl transition-opacity duration-200"
          style={{
            opacity: hasActiveLed ? 0.65 : 0,
            background: `radial-gradient(ellipse 62% 52% at 50% 46%, rgba(${ledRgb}, 0.28), transparent 72%)`,
          }}
        />

        {/* Dark anodized mechanical keyboard housing */}
        <div className="relative w-full rounded-xl border border-white/10 bg-[#171321]/92 p-2 shadow-[0_16px_34px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.10)]">
          {/* Recessed switch plate bed */}
          <div className="flex flex-col gap-[4px] rounded-lg bg-[#0d0a14] p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.9)]">
            {KEYBOARD_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="flex items-center gap-[4px]">
                {row.map((keyDef) => {
                  const isPressed = Boolean(pressedKeys[keyDef.code]);
                  const isLit = Boolean(litKeys[keyDef.code]);
                  const isAccent = keyDef.role === 'accent';
                  const isMod = keyDef.role === 'mod';

                  const baseKeyBg = isAccent
                    ? '#4e394d'
                    : isMod
                      ? '#2b2438'
                      : '#3a324b';

                  const glowColor = isAccent ? ledSecondaryRgb : ledRgb;

                  return (
                    <div
                      key={keyDef.code}
                      style={{
                        flexGrow: keyDef.w,
                        flexBasis: 0,
                        backgroundColor: baseKeyBg,
                        transform: isPressed
                          ? 'translate3d(0, 2.5px, 0) scale(0.97)'
                          : 'translate3d(0, 0, 0) scale(1)',
                        transition: 'transform 75ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                      className="relative flex h-[17px] items-center justify-center rounded-[3px] border border-white/10 text-[7px] font-mono tracking-tight shadow-[0_2px_0_rgba(10,8,16,0.95),inset_0_1px_0_rgba(255,255,255,0.09)] select-none"
                    >
                      {/* Faint resting switch LED bleed */}
                      <span
                        className="pointer-events-none absolute inset-x-[18%] bottom-[1px] h-[2px] rounded-full opacity-20"
                        style={{ backgroundColor: `rgb(${glowColor})` }}
                      />

                      {/* Subtle keystroke LED illumination overlay (compositor opacity only) */}
                      <span
                        className="pointer-events-none absolute -inset-[1px] rounded-[3px] transition-opacity duration-200 ease-out"
                        style={{
                          opacity: isLit ? 1 : 0,
                          backgroundColor: `rgba(${glowColor}, 0.28)`,
                          border: `1px solid rgba(${glowColor}, 0.62)`,
                          boxShadow: `0 0 10px rgba(${glowColor}, 0.44), 0 0 18px rgba(${glowColor}, 0.20)`,
                        }}
                      />

                      {keyDef.label && (
                        <span
                          className="relative z-10 leading-none transition-opacity duration-150"
                          style={{
                            color: '#efe7fa',
                            opacity: isLit ? 0.9 : 0.38,
                          }}
                        >
                          {keyDef.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
