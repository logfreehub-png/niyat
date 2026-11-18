import React from 'react';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

/** Onboarding uchun original vektor illyustratsiyalar (viewBox 320x240). */

type ArtProps = { dark: boolean };

const VB = '0 0 320 240';

function Stars({ color, list }: { color: string; list: [number, number, number][] }) {
  return (
    <G fill={color}>
      {list.map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} opacity={0.5 + (i % 3) * 0.2} />
      ))}
    </G>
  );
}

function Sparkle({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <Path
      d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`}
      fill={color}
    />
  );
}

/** 1. Xush kelibsiz — shom osmoni, hilol va masjid. */
export function WelcomeArt({ dark }: ArtProps) {
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="w-sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={dark ? '#0A1230' : '#1D2B5C'} />
          <Stop offset="0.55" stopColor={dark ? '#2A2560' : '#7A4F8C'} />
          <Stop offset="1" stopColor={dark ? '#7A3F5E' : '#F2A36B'} />
        </LinearGradient>
        <LinearGradient id="w-glow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE2A8" stopOpacity={0} />
          <Stop offset="1" stopColor="#FFE2A8" stopOpacity={0.45} />
        </LinearGradient>
      </Defs>
      <Rect width={320} height={240} fill="url(#w-sky)" />
      <Rect y={130} width={320} height={110} fill="url(#w-glow)" />
      <Stars
        color="#FFFFFF"
        list={[[24, 22, 1.3], [60, 50, 1], [98, 18, 1.2], [140, 40, 0.9], [196, 20, 1.1], [282, 60, 1.2], [300, 24, 1], [40, 92, 0.8], [118, 78, 0.9], [262, 98, 0.8]]}
      />
      <Sparkle x={74} y={30} s={5} color="#FFF3D6" />
      <Sparkle x={258} y={34} s={4} color="#FFF3D6" />
      {/* Hilol */}
      <Path d="M236 44 A26 26 0 1 0 236 96 A33 33 0 0 1 236 44 Z" fill="#FFF1CF" />
      {/* Fonar */}
      <G>
        <Line x1={54} y1={0} x2={54} y2={56} stroke="#E8C98A" strokeWidth={1.5} />
        <Path d="M44 60 L64 60 L60 56 L48 56 Z" fill="#C99A4A" />
        <Path d="M44 60 Q42 78 48 92 L60 92 Q66 78 64 60 Z" fill="#FFD27A" opacity={0.9} />
        <Path d="M50 62 L50 90 M58 62 L58 90" stroke="#C99A4A" strokeWidth={1.2} />
        <Path d="M46 92 L62 92 L58 98 L50 98 Z" fill="#C99A4A" />
        <Circle cx={54} cy={78} r={18} fill="#FFD27A" opacity={0.18} />
      </G>
      {/* Tepalik va masjid */}
      <Path d="M0 206 Q80 188 160 200 T320 196 V240 H0 Z" fill={dark ? '#2A1F4A' : '#5A3A66'} />
      <G fill={dark ? '#0B0F26' : '#24163A'}>
        <Rect x={92} y={128} width={9} height={92} />
        <Path d="M90 130 L96.5 106 L103 130 Z" />
        <Rect x={89} y={148} width={15} height={3} />
        <Rect x={219} y={128} width={9} height={92} />
        <Path d="M217 130 L223.5 106 L230 130 Z" />
        <Rect x={216} y={148} width={15} height={3} />
        <Rect x={106} y={180} width={26} height={40} />
        <Path d="M106 181 C106 164 132 164 132 181 Z" />
        <Rect x={188} y={180} width={26} height={40} />
        <Path d="M188 181 C188 164 214 164 214 181 Z" />
        <Rect x={126} y={160} width={68} height={60} />
        <Path d="M130 162 C130 124 190 124 190 162 Z" />
        <Rect x={159} y={116} width={2} height={14} />
        <Path d="M160 106 A5 5 0 1 0 160 116 A6.5 6.5 0 0 1 160 106 Z" />
      </G>
      {/* Derazalar nuri */}
      <G fill="#FFD27A" opacity={0.85}>
        <Path d="M146 220 V196 Q160 184 174 196 V220 Z" />
        <Path d="M112 200 Q119 192 126 200 V210 H112 Z" />
        <Path d="M194 200 Q201 192 208 200 V210 H194 Z" />
      </G>
      <Path d="M0 226 Q120 216 200 226 T320 224 V240 H0 Z" fill={dark ? '#060818' : '#170D26'} />
    </Svg>
  );
}

/** 2. Besh vaqt namoz — quyosh yo'li bo'ylab 5 nuqta. */
export function PrayersArt({ dark }: ArtProps) {
  const cx = 160;
  const cy = 196;
  const r = 118;
  const angles = [168, 128, 90, 52, 12];
  const names = ['Bomdod', 'Peshin', 'Asr', 'Shom', 'Xufton'];
  const colors = ['#F2A36B', '#FFD45C', '#F5B94A', '#E7715A', '#7C8BE0'];
  const done = 3;
  const pts = angles.map((a) => {
    const rad = (a * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)] as const;
  });
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="p-sky" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={dark ? '#1B2547' : '#FBE3C8'} />
          <Stop offset="0.5" stopColor={dark ? '#16304F' : '#D8EEF5'} />
          <Stop offset="1" stopColor={dark ? '#141C42' : '#D9DAF5'} />
        </LinearGradient>
      </Defs>
      <Rect width={320} height={240} fill="url(#p-sky)" />
      <Stars color={dark ? '#FFFFFF' : '#9AA6E6'} list={[[262, 40, 1.2], [290, 70, 1], [300, 30, 0.9], [240, 22, 0.8]]} />
      {/* Quyosh yo'li */}
      <Path
        d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke={dark ? '#3D5A80' : '#B9A98A'}
        strokeWidth={2}
        strokeDasharray="5 6"
        fill="none"
      />
      {/* Bajarilgan qism */}
      <Path
        d={`M${pts[0][0]} ${pts[0][1]} A${r} ${r} 0 0 1 ${pts[done - 1][0]} ${pts[done - 1][1]}`}
        stroke={dark ? '#2BB38A' : '#0F7B5F'}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      {pts.map(([x, y], i) => {
        const isDone = i < done;
        const isNext = i === done;
        return (
          <G key={i}>
            {isNext && <Circle cx={x} cy={y} r={24} fill={colors[i]} opacity={0.22} />}
            <Circle
              cx={x}
              cy={y}
              r={16}
              fill={isDone ? (dark ? '#2BB38A' : '#0F7B5F') : colors[i]}
              stroke={dark ? '#0F1B2D' : '#FFFFFF'}
              strokeWidth={3}
            />
            {isDone ? (
              <Path
                d={`M${x - 6} ${y} L${x - 1.5} ${y + 4.5} L${x + 6.5} ${y - 4.5}`}
                stroke="#FFFFFF"
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ) : i === 4 ? (
              <Path d={`M${x + 1} ${y - 7} A7 7 0 1 0 ${x + 1} ${y + 7} A9 9 0 0 1 ${x + 1} ${y - 7} Z`} fill="#FFFFFF" />
            ) : (
              <Circle cx={x} cy={y} r={5.5} fill="#FFFFFF" />
            )}
            <SvgText
              x={x}
              y={y + 32}
              fontSize={11}
              fontFamily="sans-serif" fontWeight="700"
              fill={dark ? '#C9D6E6' : '#4A4A40'}
              textAnchor="middle"
            >
              {names[i]}
            </SvgText>
          </G>
        );
      })}
      {/* Joynamoz */}
      <G transform="translate(118 176)">
        <Rect width={84} height={44} rx={5} fill={dark ? '#2BB38A' : '#0F7B5F'} />
        <Rect x={5} y={5} width={74} height={34} rx={3} fill="none" stroke="#F7E3B0" strokeWidth={1.4} />
        <Path d="M30 33 V20 Q42 8 54 20 V33" fill="none" stroke="#F7E3B0" strokeWidth={1.6} />
        <Circle cx={42} cy={14} r={1.8} fill="#F7E3B0" />
        <Path d="M0 8 h-4 M0 16 h-4 M0 24 h-4 M0 32 h-4 M84 8 h4 M84 16 h4 M84 24 h4 M84 32 h4" stroke="#F7E3B0" strokeWidth={1.4} />
      </G>
      <SvgText x={160} y={168} fontSize={13} fontFamily="sans-serif" fontWeight="800" fill={dark ? '#2BB38A' : '#0F7B5F'} textAnchor="middle">
        3 / 5
      </SvgText>
    </Svg>
  );
}

/** 3. Elektron tasbeh — munchoqlar halqasi va sanagich. */
export function TasbehArt({ dark }: ArtProps) {
  const cx = 160;
  const cy = 106;
  const R = 76;
  const total = 33;
  const counted = 22;
  const beads = Array.from({ length: total }, (_, i) => {
    // Pastki qismda (imom munchoq uchun) bo'shliq qoldiramiz
    const a = (Math.PI / 2) + 0.32 + (i / (total - 1)) * (2 * Math.PI - 0.64);
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as const;
  });
  const green = dark ? '#2BB38A' : '#0F7B5F';
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="t-bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={dark ? '#14473F' : '#DCEFE6'} />
          <Stop offset="1" stopColor={dark ? '#0F2A3A' : '#F7F1E3'} />
        </LinearGradient>
      </Defs>
      <Rect width={320} height={240} fill="url(#t-bg)" />
      {/* Bosish to'lqinlari */}
      <Circle cx={cx} cy={cy} r={46} fill={green} opacity={0.1} />
      <Circle cx={cx} cy={cy} r={36} fill={green} opacity={0.14} />
      {/* Ip */}
      <Circle cx={cx} cy={cy} r={R} stroke={dark ? '#7A6A4A' : '#B39A6A'} strokeWidth={1.4} fill="none" />
      {beads.map(([x, y], i) => (
        <G key={i}>
          <Circle cx={x} cy={y} r={7} fill={i < counted ? green : dark ? '#C9A46E' : '#D9B97E'} />
          <Circle cx={x - 2} cy={y - 2} r={2} fill="#FFFFFF" opacity={0.45} />
        </G>
      ))}
      {/* Imom munchoq va popuk */}
      <Path d={`M${cx - 6} ${cy + R - 2} Q${cx} ${cy + R + 24} ${cx + 6} ${cy + R - 2} Z`} fill={dark ? '#C9A46E' : '#B98A44'} />
      <Circle cx={cx} cy={cy + R + 22} r={5} fill={dark ? '#C9A46E' : '#B98A44'} />
      <G stroke={dark ? '#C9A46E' : '#B98A44'} strokeWidth={1.6} strokeLinecap="round">
        <Line x1={cx} y1={cy + R + 26} x2={cx - 10} y2={cy + R + 50} />
        <Line x1={cx} y1={cy + R + 26} x2={cx - 4} y2={cy + R + 52} />
        <Line x1={cx} y1={cy + R + 26} x2={cx + 3} y2={cy + R + 52} />
        <Line x1={cx} y1={cy + R + 26} x2={cx + 10} y2={cy + R + 50} />
      </G>
      {/* Sanagich */}
      <SvgText x={cx} y={cy + 8} fontSize={30} fontFamily="sans-serif" fontWeight="800" fill={green} textAnchor="middle">
        66
      </SvgText>
      <SvgText x={cx} y={cy + 26} fontSize={11} fontFamily="sans-serif" fontWeight="600" fill={dark ? '#A9C7BE' : '#6B6A5E'} textAnchor="middle">
        / 100 salovat
      </SvgText>
      {/* Yon bezaklar */}
      <Sparkle x={50} y={60} s={7} color={dark ? '#F7E3B0' : '#E2B866'} />
      <Sparkle x={272} y={150} s={6} color={dark ? '#F7E3B0' : '#E2B866'} />
      <Sparkle x={262} y={46} s={4} color={green} />
      <Sparkle x={62} y={176} s={4} color={green} />
    </Svg>
  );
}

/** 4. Duo va kechki xulosa — kundalik daftar, hilol va baho. */
export function JournalArt({ dark }: ArtProps) {
  const green = dark ? '#2BB38A' : '#0F7B5F';
  const paper = dark ? '#1E3250' : '#FFFBF2';
  const line = dark ? '#35507A' : '#E3D8C0';
  return (
    <Svg width="100%" height="100%" viewBox={VB} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="j-bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={dark ? '#0A1230' : '#22356A'} />
          <Stop offset="1" stopColor={dark ? '#16263D' : '#4C5B9A'} />
        </LinearGradient>
      </Defs>
      <Rect width={320} height={240} fill="url(#j-bg)" />
      <Stars
        color="#FFFFFF"
        list={[[22, 26, 1.2], [58, 60, 0.9], [36, 120, 1], [280, 112, 1.1], [300, 180, 0.8], [20, 200, 0.9], [250, 20, 0.8], [110, 18, 1]]}
      />
      <Path d="M276 30 A20 20 0 1 0 276 70 A25 25 0 0 1 276 30 Z" fill="#FFF1CF" />
      <Sparkle x={240} y={58} s={4} color="#FFF1CF" />
      {/* Daftar */}
      <G transform="rotate(-4 160 130)">
        <Rect x={70} y={44} width={180} height={172} rx={12} fill={dark ? '#0B2E28' : '#0B5E48'} />
        <Rect x={78} y={40} width={168} height={170} rx={10} fill={paper} />
        <Rect x={78} y={40} width={14} height={170} rx={6} fill={green} opacity={0.18} />
        {[0, 1, 2, 3].map((i) => (
          <Circle key={i} cx={85} cy={66 + i * 40} r={3} fill={dark ? '#0F1B2D' : '#E3D8C0'} />
        ))}
        <SvgText x={104} y={68} fontSize={12} fontFamily="sans-serif" fontWeight="800" fill={green}>
          Bugun men...
        </SvgText>
        {[86, 104, 122].map((y, i) => (
          <G key={y}>
            <Line x1={104} y1={y} x2={232} y2={y} stroke={line} strokeWidth={1.2} />
            <Path
              d={`M106 ${y - 4} q${12 + i * 4} -6 ${30 + i * 10} 0 t${34 + i * 8} 0`}
              stroke={dark ? '#93A3B8' : '#8A8470'}
              strokeWidth={1.4}
              fill="none"
              strokeLinecap="round"
            />
          </G>
        ))}
        {/* Yurak */}
        <Path d="M214 64 c-4 -6 -12 -2 -10 4 c1 4 10 10 10 10 s9 -6 10 -10 c2 -6 -6 -10 -10 -4 Z" fill="#E7715A" />
        {/* 1–10 baho */}
        <SvgText x={104} y={150} fontSize={10} fontFamily="sans-serif" fontWeight="700" fill={dark ? '#93A3B8' : '#6B6A5E'}>
          Kun bahosi
        </SvgText>
        {Array.from({ length: 10 }, (_, i) => (
          <Circle key={i} cx={110 + i * 13} cy={164} r={5} fill={i < 8 ? green : line} />
        ))}
        <SvgText x={104} y={194} fontSize={10} fontFamily="sans-serif" fontWeight="700" fill={dark ? '#93A3B8' : '#6B6A5E'}>
          Shukr qilaman:
        </SvgText>
        <Line x1={176} y1={196} x2={232} y2={196} stroke={line} strokeWidth={1.2} />
      </G>
      {/* Qalam */}
      <G transform="rotate(38 252 176)">
        <Rect x={244} y={120} width={12} height={80} rx={3} fill="#E2B866" />
        <Rect x={244} y={120} width={12} height={12} rx={3} fill="#E7715A" />
        <Path d="M244 200 L256 200 L250 214 Z" fill="#F7E3B0" />
        <Path d="M248 209 L252 209 L250 214 Z" fill="#1F2A24" />
      </G>
    </Svg>
  );
}
