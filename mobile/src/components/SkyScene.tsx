import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { PrayerKey } from '../constants';

/** Kun vaqtiga mos manzara: osmon, quyosh/oy, yulduzlar va masjid silueti (vektor, original chizma). */

type Scene = {
  sky: [string, string, string];
  body: 'sun' | 'moon';
  bodyAt: [number, number];
  bodyR: number;
  bodyColor: string;
  glow: string;
  stars: number; // 0..1 yulduzlar ko'rinishi
  clouds: number; // 0..1
  hills: [string, string];
  silhouette: string;
};

export const SCENES: Record<PrayerKey, Scene> = {
  fajr: {
    sky: ['#1B2547', '#5E4F8C', '#E59A7A'],
    body: 'sun', bodyAt: [208, 176], bodyR: 20, bodyColor: '#FFD9A8', glow: '#FFB38A',
    stars: 0.5, clouds: 0, hills: ['#3E3566', '#2A2350'], silhouette: '#161236',
  },
  dhuhr: {
    sky: ['#2F7FC1', '#5FA9DD', '#A9D8F2'],
    body: 'sun', bodyAt: [222, 34], bodyR: 15, bodyColor: '#FFF6D6', glow: '#FFF1B0',
    stars: 0, clouds: 1, hills: ['#4E9A86', '#2F7A66'], silhouette: '#0E4A3E',
  },
  asr: {
    sky: ['#3B7BA8', '#C9A46E', '#F0C98A'],
    body: 'sun', bodyAt: [214, 70], bodyR: 16, bodyColor: '#FFE7B0', glow: '#FFD27A',
    stars: 0, clouds: 0.6, hills: ['#7A8F5E', '#4F6B45'], silhouette: '#203B2C',
  },
  maghrib: {
    sky: ['#2E2452', '#B24C62', '#F39A52'],
    body: 'sun', bodyAt: [206, 178], bodyR: 22, bodyColor: '#FFC777', glow: '#FF8A4C',
    stars: 0.15, clouds: 0.3, hills: ['#6B2E4E', '#3E1D3C'], silhouette: '#1E0F26',
  },
  isha: {
    sky: ['#0A1230', '#13204A', '#22356A'],
    body: 'moon', bodyAt: [228, 24], bodyR: 11, bodyColor: '#F7F1E3', glow: '#9FB4FF',
    stars: 1, clouds: 0, hills: ['#1B2A55', '#111C3D'], silhouette: '#070D22',
  },
};

// Yulduzlar: [x, y, r] — qat'iy joylar, har safar bir xil ko'rinsin
const STARS: [number, number, number][] = [
  [20, 18, 1.2], [48, 40, 0.9], [130, 22, 1.1], [160, 60, 0.8], [196, 30, 1.3], [222, 14, 0.9],
  [248, 52, 1], [282, 24, 1.2], [318, 44, 0.9], [342, 16, 1.1], [30, 80, 0.8], [150, 96, 0.9],
  [210, 84, 0.7], [300, 90, 0.8], [110, 70, 0.7], [270, 74, 1],
];

function Mosque({ color }: { color: string }) {
  return (
    <G fill={color}>
      {/* Minoralar */}
      <Rect x={196} y={112} width={9} height={88} />
      <Path d="M194 114 L200.5 92 L207 114 Z" />
      <Rect x={193} y={132} width={15} height={3} rx={1} />
      <Rect x={339} y={112} width={9} height={88} />
      <Path d="M337 114 L343.5 92 L350 114 Z" />
      <Rect x={336} y={132} width={15} height={3} rx={1} />
      {/* Yon gumbazlar */}
      <Rect x={210} y={164} width={28} height={36} />
      <Path d="M210 165 C210 148 238 148 238 165 Z" />
      <Rect x={306} y={164} width={28} height={36} />
      <Path d="M306 165 C306 148 334 148 334 165 Z" />
      {/* Asosiy bino va gumbaz */}
      <Rect x={232} y={146} width={80} height={54} />
      <Path d="M238 148 C238 112 306 112 306 148 Z" />
      <Rect x={271} y={104} width={2} height={14} />
      {/* Gumbaz ustidagi hilol */}
      <Path d="M272 96 A5 5 0 1 0 272 106 A4 4 0 1 1 272 96 Z" />
    </G>
  );
}

export function SkyScene({ period }: { period: PrayerKey }) {
  const sc = SCENES[period];
  const [bx, by] = sc.bodyAt;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 360 200" preserveAspectRatio="xMaxYMax slice">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sc.sky[0]} />
            <Stop offset="0.6" stopColor={sc.sky[1]} />
            <Stop offset="1" stopColor={sc.sky[2]} />
          </LinearGradient>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={sc.glow} stopOpacity={0.55} />
            <Stop offset="1" stopColor={sc.glow} stopOpacity={0} />
          </RadialGradient>
          {/* Matn o'qilishi uchun chap tomonni biroz qoraytiramiz */}
          <LinearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#000" stopOpacity={0.32} />
            <Stop offset="0.65" stopColor="#000" stopOpacity={0.06} />
            <Stop offset="1" stopColor="#000" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Rect x={0} y={0} width={360} height={200} fill="url(#sky)" />

        {sc.stars > 0 &&
          STARS.map(([x, y, r], i) => (
            <Circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={sc.stars * (0.45 + (i % 3) * 0.2)} />
          ))}

        <Circle cx={bx} cy={by} r={sc.bodyR * 3.2} fill="url(#glow)" />
        {sc.body === 'sun' ? (
          <Circle cx={bx} cy={by} r={sc.bodyR} fill={sc.bodyColor} />
        ) : (
          <Path
            d={`M${bx} ${by - sc.bodyR} A${sc.bodyR} ${sc.bodyR} 0 1 0 ${bx} ${by + sc.bodyR} A${sc.bodyR * 1.25} ${sc.bodyR * 1.25} 0 0 1 ${bx} ${by - sc.bodyR} Z`}
            fill={sc.bodyColor}
          />
        )}

        {sc.clouds > 0 && (
          <G fill="#FFFFFF" opacity={0.55 * sc.clouds}>
            <Ellipse cx={170} cy={132} rx={26} ry={7} />
            <Ellipse cx={186} cy={126} rx={15} ry={8} />
            <Ellipse cx={46} cy={150} rx={20} ry={5} />
          </G>
        )}

        {/* Tepaliklar va masjid */}
        <Path d="M0 176 Q70 156 150 172 T300 166 T360 170 V200 H0 Z" fill={sc.hills[0]} opacity={0.9} />
        <G transform="translate(72 40) scale(0.8)">
          <Mosque color={sc.silhouette} />
        </G>
        <Path d="M0 190 Q120 180 220 190 T360 188 V200 H0 Z" fill={sc.hills[1]} />

        <Rect x={0} y={0} width={360} height={200} fill="url(#shade)" />
      </Svg>
    </View>
  );
}

/** Hozirgi payt qaysi namoz vaqtiga to'g'ri keladi (Bomdoddan oldin — Xufton/tun). */
export function currentPeriod(times: Record<PrayerKey, Date>, now: Date): PrayerKey {
  const order: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  let cur: PrayerKey = 'isha';
  for (const k of order) if (times[k] <= now) cur = k;
  return cur;
}
