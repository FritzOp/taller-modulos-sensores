import { useEffect, useState } from 'react';
import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';

export interface CameraLevelState {
  angle: number;
  isLevel: boolean;
  isAvailable: boolean | null;
}

export function useCameraLevel(updateIntervalMs: number = 100): CameraLevelState {
  const [state, setState] = useState<CameraLevelState>({
    angle: 0,
    isLevel: true,
    isAvailable: null,
  });

  useEffect(() => {
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    DeviceMotion.isAvailableAsync()
      .then((available) => {
        if (cancelled) return;
        if (!available) {
          setState((prev) => ({ ...prev, isAvailable: false }));
          return;
        }

        DeviceMotion.setUpdateInterval(updateIntervalMs);

        subscription = DeviceMotion.addListener((data: DeviceMotionMeasurement) => {
          if (cancelled) return;

          let rollDeg = 0;
          if (data.rotation && typeof data.rotation.gamma === 'number') {
            rollDeg = (data.rotation.gamma * 180) / Math.PI;
          } else if (data.accelerationIncludingGravity) {
            const { x, y } = data.accelerationIncludingGravity;
            rollDeg = Math.atan2(x, -y) * (180 / Math.PI);
          }

          // Round to 1 decimal place for visual stability
          const roundedAngle = Math.round(rollDeg * 10) / 10;
          const isLevel = Math.abs(roundedAngle) <= 1.5;

          setState({
            angle: isLevel ? 0 : roundedAngle,
            isLevel,
            isAvailable: true,
          });
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isAvailable: false }));
        }
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [updateIntervalMs]);

  return state;
}
