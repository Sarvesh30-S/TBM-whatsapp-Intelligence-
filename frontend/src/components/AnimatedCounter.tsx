'use client';

import React, { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  value: number | string;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export default function AnimatedCounter({
  value,
  duration = 1400,
  decimals,
  prefix = '',
  suffix = '',
  className = '',
}: AnimatedCounterProps) {
  let targetNumber = 0;
  let detectedSuffix = suffix;
  let detectedDecimals = decimals;

  if (typeof value === 'number') {
    targetNumber = value;
    if (detectedDecimals === undefined) {
      detectedDecimals = Number.isInteger(value) ? 0 : 1;
    }
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!suffix && trimmed.endsWith('%')) {
      detectedSuffix = '%';
    }
    const cleanNum = trimmed.replace(/[^0-9.]/g, '');
    targetNumber = parseFloat(cleanNum) || 0;

    if (detectedDecimals === undefined) {
      if (cleanNum.includes('.')) {
        detectedDecimals = cleanNum.split('.')[1].length;
      } else {
        detectedDecimals = 0;
      }
    }
  }

  const [currentValue, setCurrentValue] = useState<number>(0);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const val = easeOut * targetNumber;

      setCurrentValue(val);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setCurrentValue(targetNumber);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [targetNumber, duration]);

  const formattedNumber =
    detectedDecimals !== undefined && detectedDecimals > 0
      ? currentValue.toFixed(detectedDecimals)
      : Math.round(currentValue).toLocaleString();

  return (
    <span className={`animated-counter-value ${className}`}>
      {prefix}
      {formattedNumber}
      {detectedSuffix}
    </span>
  );
}
