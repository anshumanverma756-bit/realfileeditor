import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes } from "../lib/compress-pdf";

interface GaugeSliderProps {
  /** Smallest selectable target, in bytes */
  min: number;
  /** Original file size, in bytes — also the max of the gauge */
  max: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * The site's signature control: a calibrated ruler with a draggable
 * caliper handle, used everywhere a person needs to choose an exact
 * output size instead of picking "low / medium / high".
 */
export default function GaugeSlider({ min, max, value, onChange, disabled }: GaugeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const savedPct = max > 0 ? Math.round((1 - value / max) * 100) : 0;

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onChange(Math.round(clamp(min + ratio * (max - min))));
    },
    [clamp, max, min, onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => setFromClientX(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, setFromClientX]);

  const step = Math.max(1, Math.round((max - min) / 100));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(clamp(value - step));
    if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(clamp(value + step));
    if (e.key === "Home") onChange(min);
    if (e.key === "End") onChange(max);
  };

  // 21 ticks: major every 5th (10%), minor otherwise.
  const ticks = Array.from({ length: 21 }, (_, i) => i);

  return (
    <div className="w-full select-none">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">Target size</p>
          <p className="font-mono text-2xl font-medium mono-num">{formatBytes(value)}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">Estimated saving</p>
          <p className="font-mono text-2xl font-medium mono-num text-[var(--success)]">{savedPct}%</p>
        </div>
      </div>

      <div
        ref={trackRef}
        role="slider"
        aria-label="Target file size"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={formatBytes(value)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          if (disabled) return;
          setDragging(true);
          setFromClientX(e.clientX);
        }}
        className={`relative h-16 border border-[var(--line)] bg-[var(--bg-raised)] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {/* filled range */}
        <div
          className="absolute inset-y-0 left-0 bg-[var(--accent-dim)]"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />

        {/* tick marks */}
        <div className="absolute inset-x-0 bottom-0 flex justify-between px-1" aria-hidden="true">
          {ticks.map((i) => (
            <span
              key={i}
              className="bg-[var(--line)]"
              style={{
                width: "1px",
                height: i % 5 === 0 ? 14 : 7,
              }}
            />
          ))}
        </div>

        {/* caliper handle */}
        <div
          className="absolute top-0 bottom-0 flex items-center"
          style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
          aria-hidden="true"
        >
          <div className="h-full w-[2px] bg-[var(--accent)]" />
          <div className="absolute -top-1 h-3 w-3 border-2 border-[var(--accent)] bg-[var(--bg-raised)]" style={{ transform: "translateX(-50%) rotate(45deg)" }} />
        </div>
      </div>

      <div className="flex justify-between mt-1.5 font-mono text-[10px] text-[var(--fg-muted)]">
        <span>{formatBytes(min)} smallest</span>
        <span>{formatBytes(max)} original</span>
      </div>
    </div>
  );
}
