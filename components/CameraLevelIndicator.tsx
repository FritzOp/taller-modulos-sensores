import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/constants/theme';

interface Props {
  angle: number;
  isLevel: boolean;
  isAvailable: boolean | null;
}

export function CameraLevelIndicator({ angle, isLevel, isAvailable }: Props) {
  if (isAvailable === false) {
    return null;
  }

  // Constrain rotation display between -45 and 45 degrees for UI clarity
  const clampedAngle = Math.max(-45, Math.min(45, angle));
  const activeColor = isLevel ? colors.primary : colors.warning;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Static center crosshair guides */}
      <View style={styles.centerGuide}>
        <View style={styles.staticTickLeft} />
        <View style={styles.centerDot} />
        <View style={styles.staticTickRight} />
      </View>

      {/* Rotating artificial horizon line */}
      <View
        style={[
          styles.horizonLineContainer,
          {
            transform: [{ rotate: `${-clampedAngle}deg` }],
          },
        ]}
      >
        <View
          style={[
            styles.horizonLine,
            { backgroundColor: activeColor, opacity: isLevel ? 0.95 : 0.75 },
          ]}
        />
      </View>

      {/* Angular degrees readout */}
      <View style={[styles.badge, isLevel ? styles.badgeLevel : styles.badgeTilt]}>
        <Text style={[styles.badgeText, { color: activeColor }]}>
          {isLevel ? 'NIVELADO (0.0°)' : `${angle > 0 ? '+' : ''}${angle.toFixed(1)}°`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  centerGuide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 220,
  },
  staticTickLeft: {
    width: 36,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 1,
  },
  centerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 16,
  },
  staticTickRight: {
    width: 36,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 1,
  },
  horizonLineContainer: {
    position: 'absolute',
    width: 140,
    height: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizonLine: {
    width: 140,
    height: 2,
    borderRadius: 1,
  },
  badge: {
    position: 'absolute',
    top: '56%',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  badgeLevel: {
    borderWidth: 1,
    borderColor: '#10b981',
  },
  badgeTilt: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
});
