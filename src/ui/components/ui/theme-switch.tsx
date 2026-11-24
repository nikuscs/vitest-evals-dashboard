import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './button';
import { MOTION } from './motion.constants';

export function ThemeSwitch({ dark, onThemeChange }: { dark: boolean; onThemeChange: (next: boolean, trigger: HTMLButtonElement) => void }) {
  const reduced = useReducedMotion();
  const Icon = dark ? Moon : Sun;
  const angle = dark ? -30 : 30;
  const lift = dark ? 'scale(1.08)' : undefined;

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="relative size-7"
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      aria-pressed={dark}
      onClick={(event) => onThemeChange(!dark, event.currentTarget)}
    >
      <span className="relative inline-grid size-5 shrink-0 place-items-center transition-transform duration-(--duration-spring) ease-(--ease-spring) motion-reduce:transform-none motion-reduce:transition-none" style={{ transform: lift }}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={String(dark)}
            className="absolute grid size-[18px] place-items-center"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7, rotate: angle, filter: `blur(${MOTION.blur.subtle}px)` }}
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
            exit={reduced
              ? { opacity: 0 }
              : {
                opacity: 0,
                scale: 0.7,
                rotate: angle,
                filter: `blur(${MOTION.blur.subtle}px)`,
                transition: { duration: MOTION.duration.fast, ease: MOTION.ease.standard },
              }}
            transition={reduced
              ? { duration: MOTION.duration.instant }
              : {
                ...MOTION.spring.snappy,
                opacity: { duration: MOTION.duration.fast, ease: MOTION.ease.enter },
                filter: { duration: MOTION.duration.fast, ease: MOTION.ease.enter },
              }}
            aria-hidden="true"
          >
            <Icon className="size-4" />
          </motion.span>
        </AnimatePresence>
      </span>
    </Button>
  );
}
