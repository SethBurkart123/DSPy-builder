"use client";

import * as React from "react";

interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onValueChange: (value: number) => void;
}

export function Slider({ min = 0, max = 100, step = 1, value, onValueChange }: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={isNaN(value) ? 0 : value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className="h-2 w-full appearance-none rounded bg-muted outline-none accent-primary [::-webkit-slider-thumb]:appearance-none [::-webkit-slider-thumb]:h-4 [::-webkit-slider-thumb]:w-4 [::-webkit-slider-thumb]:rounded-full [::-webkit-slider-thumb]:bg-primary [::-webkit-slider-thumb]:cursor-pointer"
    />
  );
}

