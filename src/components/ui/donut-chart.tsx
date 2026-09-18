"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface DonutChartSegment {
  value: number;
  color: string;
  label: string;
  [key: string]: unknown;
}

interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: DonutChartSegment[];
  totalValue?: number;
  size?: number;
  strokeWidth?: number;
  animationDuration?: number;
  animationDelayPerSegment?: number;
  highlightOnHover?: boolean;
  centerContent?: React.ReactNode;
  onSegmentHover?: (segment: DonutChartSegment | null) => void;
}

const DonutChart = React.forwardRef<HTMLDivElement, DonutChartProps>(({ data, totalValue: propTotalValue, size = 200, strokeWidth = 20, animationDuration = 0.9, animationDelayPerSegment = 0.05, highlightOnHover = true, centerContent, onSegmentHover, className, ...props }, ref) => {
  const [hoveredSegment, setHoveredSegment] = React.useState<DonutChartSegment | null>(null);
  const reduceMotion = useReducedMotion();
  const total = propTotalValue ?? data.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;

  React.useEffect(() => onSegmentHover?.(hoveredSegment), [hoveredSegment, onSegmentHover]);

  return (
    <div ref={ref} className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }} onMouseLeave={() => setHoveredSegment(null)} {...props}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible" role="img" aria-label="Gráfico de distribuição">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="var(--border)" strokeOpacity="0.5" strokeWidth={strokeWidth} />
        <AnimatePresence>
          {data.map((segment, index) => {
            if (segment.value <= 0) return null;
            const percentage = total === 0 ? 0 : (segment.value / total) * 100;
            const dash = (percentage / 100) * circumference;
            const offsetPercentage = total === 0 ? 0 : data.slice(0, index).reduce((sum, item) => sum + Math.max(0, item.value), 0) / total * 100;
            const offset = (offsetPercentage / 100) * circumference;
            const isActive = hoveredSegment?.label === segment.label;
            return (
              <motion.circle key={`${segment.label}-${index}`} cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke={segment.color} strokeWidth={strokeWidth} strokeDasharray={`${dash} ${circumference}`} strokeDashoffset={-offset} strokeLinecap="round" initial={reduceMotion ? false : { opacity: 0, strokeDashoffset: circumference }} animate={{ opacity: 1, strokeDashoffset: -offset }} transition={{ opacity: { duration: 0.25, delay: index * animationDelayPerSegment }, strokeDashoffset: { duration: reduceMotion ? 0 : animationDuration, delay: index * animationDelayPerSegment, ease: "easeOut" } }} className={cn(highlightOnHover && "cursor-pointer")} style={{ filter: isActive ? `drop-shadow(0 0 6px ${segment.color}) brightness(1.1)` : undefined, transform: isActive ? "scale(1.03)" : "scale(1)", transformOrigin: "center", transition: "filter 0.2s ease-out, transform 0.2s ease-out" }} onMouseEnter={() => setHoveredSegment(segment)} />
            );
          })}
        </AnimatePresence>
      </svg>
      {centerContent && <div className="pointer-events-none absolute flex flex-col items-center justify-center text-center" style={{ width: size - strokeWidth * 2.5, height: size - strokeWidth * 2.5 }}>{centerContent}</div>}
    </div>
  );
});

DonutChart.displayName = "DonutChart";
export { DonutChart };
