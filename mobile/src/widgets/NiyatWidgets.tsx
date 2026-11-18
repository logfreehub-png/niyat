import React from 'react';
import {
  FlexWidget,
  ListWidget,
  OverlapWidget,
  SvgWidget,
  TextWidget,
  type ColorProp,
  type HexColor,
  type WidgetRepresentation,
} from 'react-native-android-widget';
import type { WidgetData } from './data';

// Ilova mavzusiga mos ranglar
type Palette = {
  from: ColorProp;
  to: ColorProp;
  text: HexColor;
  muted: HexColor;
  faint: HexColor;
  card: ColorProp;
  cardStrong: ColorProp;
  track: HexColor;
  accent: HexColor;
  onAccent: HexColor;
  gold: HexColor;
};

const LIGHT: Palette = {
  from: '#13866A',
  to: '#0A5A46',
  text: '#FFFFFF',
  muted: '#CDE9DF',
  faint: '#8CC3B1',
  card: 'rgba(255, 255, 255, 0.12)',
  cardStrong: 'rgba(255, 255, 255, 0.22)',
  track: '#3E9A80',
  accent: '#F4D58D',
  onAccent: '#0A3D30',
  gold: '#F4D58D',
};

const DARK: Palette = {
  from: '#16463F',
  to: '#0E1A2B',
  text: '#E9F1F7',
  muted: '#A9C7BE',
  faint: '#6E8C88',
  card: 'rgba(255, 255, 255, 0.06)',
  cardStrong: 'rgba(43, 179, 138, 0.22)',
  track: '#284A50',
  accent: '#2BB38A',
  onAccent: '#06231A',
  gold: '#E9C46A',
};

/** Ilova sozlamasidagi mavzuga qarab yorug'/tungi variant. */
export function themed(data: WidgetData, render: (p: Palette) => React.JSX.Element): WidgetRepresentation {
  if (data.themeMode === 'light') return render(LIGHT);
  if (data.themeMode === 'dark') return render(DARK);
  return { light: render(LIGHT), dark: render(DARK) };
}

// ---------- SVG yordamchilar ----------
function ringSvg(size: number, stroke: number, progress: number, track: string, color: string) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const len = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
  ${p > 0 ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(len * p).toFixed(2)} ${len.toFixed(2)}" transform="rotate(-90 ${c} ${c})"/>` : ''}
</svg>`;
}

function crescentSvg(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path fill="${color}" d="M14.5 2.5a9.5 9.5 0 1 0 7 15.9A8 8 0 1 1 14.5 2.5z"/>
  <path fill="${color}" d="M18 6l.7 1.6 1.7.2-1.3 1.1.4 1.7-1.5-.9-1.5.9.4-1.7-1.3-1.1 1.7-.2z"/>
</svg>`;
}

function checkSvg(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <path fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.5 4.5L19 7.5"/>
</svg>`;
}

function Root({ p, children, padding = 16 }: { p: Palette; children: React.ReactNode; padding?: number }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        padding,
        borderRadius: 26,
        backgroundGradient: { from: p.from, to: p.to, orientation: 'TL_BR' },
      }}
    >
      {children}
    </FlexWidget>
  );
}

function LoginPrompt({ p }: { p: Palette }) {
  return (
    <Root p={p}>
      <FlexWidget style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <SvgWidget svg={crescentSvg(p.gold)} style={{ width: 30, height: 30 }} />
        <TextWidget text="Niyat" style={{ fontSize: 20, fontWeight: 'bold', color: p.text, marginTop: 6 }} />
        <TextWidget text="Kirish uchun bosing" style={{ fontSize: 13, color: p.muted, marginTop: 2 }} />
      </FlexWidget>
    </Root>
  );
}

/** Halqa ichida matn (OverlapWidget bilan). */
function Ring({ p, size, progress, big, small }: { p: Palette; size: number; progress: number; big: string; small: string }) {
  return (
    <OverlapWidget style={{ width: size, height: size }}>
      <SvgWidget svg={ringSvg(size, size * 0.11, progress, p.track, p.accent)} style={{ width: size, height: size }} />
      <FlexWidget style={{ width: size, height: size, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <TextWidget text={big} style={{ fontSize: size * 0.27, fontWeight: 'bold', color: p.text }} />
        <TextWidget text={small} style={{ fontSize: size * 0.15, color: p.muted }} />
      </FlexWidget>
    </OverlapWidget>
  );
}

function Bar({ p, value }: { p: Palette; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <FlexWidget style={{ width: 'match_parent', height: 7, borderRadius: 4, backgroundColor: p.track, flexDirection: 'row' }}>
      {v > 0 && <FlexWidget style={{ flex: v, height: 7, borderRadius: 4, backgroundColor: p.accent }} />}
      {v < 100 && <FlexWidget style={{ flex: 100 - v, height: 7 }} />}
    </FlexWidget>
  );
}

function CheckDot({ p, done, size = 18 }: { p: Palette; done: boolean; size?: number }) {
  return (
    <FlexWidget
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: done ? p.accent : 'rgba(0, 0, 0, 0)',
        borderWidth: done ? 0 : 1.5,
        borderColor: p.track,
      }}
    >
      {done ? <SvgWidget svg={checkSvg(p.onAccent)} style={{ width: size * 0.65, height: size * 0.65 }} /> : <FlexWidget style={{ width: 1, height: 1 }} />}
    </FlexWidget>
  );
}

/**
 * 4×2: "Kunlik reja va majburiyatlar".
 * Tepada — ilovada yozilgan reja qatorlari (bosib ✓ belgilanadi),
 * pastda — kunlik majburiyatlar: 5 mahal namoz (bosib belgilanadi) va zikr foizi.
 */
export function PlansWidget({ data, p, width }: { data: WidgetData; p: Palette; width: number; height: number }) {
  if (!data.loggedIn) return <LoginPrompt p={p} />;
  const compact = width < 300;
  const plans = data.plans;
  const doneCount = plans.filter((x) => x.done).length;

  return (
    <Root p={p} padding={compact ? 12 : 14}>
      {/* Sarlavha */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <SvgWidget svg={crescentSvg(p.gold)} style={{ width: 14, height: 14, marginRight: 5 }} />
        <TextWidget text="Kunlik reja" style={{ fontSize: 13, fontWeight: 'bold', color: p.text }} />
        <FlexWidget style={{ flex: 1, height: 1 }} />
        {plans.length > 0 && (
          <FlexWidget style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: p.cardStrong }}>
            <TextWidget text={`${doneCount}/${plans.length}`} style={{ fontSize: 11, fontWeight: 'bold', color: p.text }} />
          </FlexWidget>
        )}
      </FlexWidget>

      {/* Reja qatorlari — sig'masa vidjet ichida yuqoriga/pastga suriladi */}
      {plans.length === 0 ? (
        <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', flex: 1, justifyContent: 'center', marginTop: 6 }}>
          <TextWidget text="✎ Bugungi rejangizni ilovada yozing" style={{ fontSize: 12, color: p.muted }} />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ width: 'match_parent', flex: 1, marginTop: 6 }}>
        <ListWidget style={{ width: 'match_parent', height: 'match_parent' }}>
          {plans.map((item, i) => (
            <FlexWidget
              key={String(item.index)}
              clickAction="TOGGLE_PLAN"
              clickActionData={{ index: item.index }}
              style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
            >
              <CheckDot p={p} done={item.done} size={16} />
              <TextWidget
                text={`${i + 1}. ${item.text}`}
                maxLines={2}
                truncate="END"
                style={{ fontSize: 13, marginLeft: 8, color: item.done ? p.faint : p.text }}
              />
            </FlexWidget>
          ))}
        </ListWidget>
        </FlexWidget>
      )}

      {/* Majburiyatlar: 5 mahal namoz + zikr */}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: compact ? 3 : 5, marginTop: 4 }}>
        {data.times.map((t) => (
          <FlexWidget
            key={t.key}
            clickAction="TOGGLE_PRAYER"
            clickActionData={{ key: t.key }}
            accessibilityLabel={`${t.label} ${t.done ? "o'qildi" : "o'qilmadi"}`}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 7,
              borderRadius: 12,
              backgroundColor: t.done ? p.cardStrong : p.card,
            }}
          >
            {t.done ? <SvgWidget svg={checkSvg(p.accent)} style={{ width: 11, height: 11, marginRight: 2 }} /> : <FlexWidget style={{ width: 1, height: 1 }} />}
            <TextWidget text={t.label} maxLines={1} style={{ fontSize: compact ? 9 : 11, fontWeight: t.done ? 'bold' : 'normal', color: t.done ? p.text : p.muted }} />
          </FlexWidget>
        ))}
        <FlexWidget
          clickAction="OPEN_APP"
          style={{ paddingHorizontal: compact ? 6 : 8, paddingVertical: 7, borderRadius: 12, backgroundColor: p.card, flexDirection: 'row', alignItems: 'center' }}
        >
          <SvgWidget svg={crescentSvg(p.gold)} style={{ width: 11, height: 11, marginRight: 3 }} />
          <TextWidget text={`${data.adhkarProgress}%`} style={{ fontSize: compact ? 10 : 11, fontWeight: 'bold', color: p.text }} />
        </FlexWidget>
      </FlexWidget>
    </Root>
  );
}

/** 2×2 (kengaytirsa bo'ladi): bugungi zikr va salovatlar — umumiy foiz va har birining sanog'i (suriladi). */
export function TodayWidget({ data, p, width }: { data: WidgetData; p: Palette; width: number; height: number }) {
  if (!data.loggedIn) return <LoginPrompt p={p} />;
  const wide = width >= 250;
  const zikrs = data.zikrs;
  const done = zikrs.filter((z) => z.count >= z.target).length;

  return (
    <Root p={p} padding={12}>
      <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <Ring p={p} size={wide ? 46 : 40} progress={data.adhkarProgress / 100} big={`${data.adhkarProgress}%`} small="" />
        <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 10 }}>
          <TextWidget text="Zikr va salovatlar" maxLines={1} style={{ fontSize: 13, fontWeight: 'bold', color: p.text }} />
          <TextWidget text={zikrs.length ? `${done}/${zikrs.length} bajarildi` : 'Bugun'} style={{ fontSize: 11, color: p.muted }} />
        </FlexWidget>
      </FlexWidget>

      {zikrs.length === 0 ? (
        <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', flex: 1, justifyContent: 'center' }}>
          <TextWidget text="Ilovani bir marta oching" style={{ fontSize: 12, color: p.muted }} />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ width: 'match_parent', flex: 1, marginTop: 8 }}>
        <ListWidget style={{ width: 'match_parent', height: 'match_parent' }}>
          {zikrs.map((z, i) => {
            const ok = z.count >= z.target;
            return (
              <FlexWidget
                key={String(i)}
                clickAction="OPEN_APP"
                style={{ width: 'match_parent', flexDirection: 'column', paddingVertical: 4 }}
              >
                <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
                  {ok ? <SvgWidget svg={checkSvg(p.accent)} style={{ width: 12, height: 12, marginRight: 4 }} /> : <FlexWidget style={{ width: 1, height: 1 }} />}
                  <FlexWidget style={{ flex: 1 }}>
                    <TextWidget text={z.title} maxLines={1} truncate="END" style={{ fontSize: 12, color: ok ? p.muted : p.text }} />
                  </FlexWidget>
                  <TextWidget text={`${z.count}/${z.target}`} style={{ fontSize: 11, fontWeight: 'bold', color: ok ? p.accent : p.text, marginLeft: 4 }} />
                </FlexWidget>
                <FlexWidget style={{ width: 'match_parent', marginTop: 3 }}>
                  <Bar p={p} value={z.target > 0 ? (100 * Math.min(z.count, z.target)) / z.target : 0} />
                </FlexWidget>
              </FlexWidget>
            );
          })}
        </ListWidget>
        </FlexWidget>
      )}
    </Root>
  );
}
