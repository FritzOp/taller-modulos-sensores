import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';

interface ShakeOptions {
  threshold?: number;
  cooldownMs?: number;
}

export function useShake(
  onShake: () => void,
  options: ShakeOptions = {}
): { isAvailable: boolean | null } {
  const { threshold = 1.8, cooldownMs = 1000 } = options;
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  const lastShakeRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (cancelled) return;
        setIsAvailable(available);

        if (!available) return;

        Accelerometer.setUpdateInterval(100);

        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();

          if (magnitude > threshold && now - lastShakeRef.current > cooldownMs) {
            lastShakeRef.current = now;
            onShakeRef.current();
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          setIsAvailable(false);
        }
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [threshold, cooldownMs]);

  return { isAvailable };
}
