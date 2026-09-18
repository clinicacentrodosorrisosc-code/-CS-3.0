import React, { useEffect, useRef } from 'react';
import { animate, useMotionValue, useReducedMotion, useTransform, motion } from 'motion/react';

type AnimatedNumberProps = { value: number; format?: (value: number) => string; className?: string; duration?: number };

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, format = value => Math.round(value).toLocaleString('pt-BR'), className, duration = 0.55 }) => {
  const reduced = useReducedMotion();
  const previous = useRef(value);
  const motionValue = useMotionValue(value);
  const output = useTransform(motionValue, current => format(current));

  useEffect(() => {
    const control = animate(motionValue, value, reduced ? { duration: 0 } : { duration, ease: [0.16, 1, 0.3, 1] });
    previous.current = value;
    return () => control.stop();
  }, [duration, motionValue, reduced, value]);

  return <motion.span className={className}>{output}</motion.span>;
};
