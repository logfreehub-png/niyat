import React from 'react';
import { Platform } from 'react-native';
import type { WidgetInfo, WidgetRepresentation, WidgetTaskHandler } from 'react-native-android-widget';
import type { PrayerKey } from '../constants';
import { loadWidgetData, refreshFromServer, togglePlanFromWidget, togglePrayerFromWidget, type WidgetData } from './data';

/** app.json dagi vidjet nomlari bilan bir xil bo'lishi shart.
 * `NiyatPrayers` nomi eski — uy ekranidagi vidjetlar yo'qolmasligi uchun o'zgartirilmagan;
 * endi u "Kunlik reja va majburiyatlar"ni ko'rsatadi. */
export const WIDGETS = {
  plans: 'NiyatPrayers',
  today: 'NiyatToday',
} as const;

function render(info: Pick<WidgetInfo, 'widgetName' | 'width' | 'height'>, data: WidgetData): WidgetRepresentation {
  // Kechiktirib yuklaymiz: Expo Go'da vidjet moduli yo'q, statik import ilovani yiqitadi
  const { PlansWidget, TodayWidget, themed } = require('./NiyatWidgets') as typeof import('./NiyatWidgets');
  if (info.widgetName === WIDGETS.today) {
    return themed(data, (p) => <TodayWidget data={data} p={p} width={info.width} height={info.height} />);
  }
  return themed(data, (p) => <PlansWidget data={data} p={p} width={info.width} height={info.height} />);
}

/** Ilova yopiq bo'lsa ham Android shu funksiyani chaqiradi (qo'shilganda, har 30 daqiqada, bosilganda). */
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }) => {
  switch (widgetAction) {
    case 'WIDGET_DELETED':
      return;
    case 'WIDGET_CLICK':
      if (clickAction === 'TOGGLE_PRAYER' && typeof clickActionData?.key === 'string') {
        await togglePrayerFromWidget(clickActionData.key as PrayerKey);
      } else if (clickAction === 'TOGGLE_PLAN' && typeof clickActionData?.index === 'number') {
        await togglePlanFromWidget(clickActionData.index);
      } else return;
      // Barcha vidjetlar bir xil holatni ko'rsatsin
      renderWidget(render(widgetInfo, await loadWidgetData()));
      await updateWidgets(false);
      return;
    case 'WIDGET_ADDED':
    case 'WIDGET_RESIZED':
      // Avval keshdan tez chizamiz, so'ng serverdan yangilaymiz
      renderWidget(render(widgetInfo, await loadWidgetData()));
      await refreshFromServer();
      renderWidget(render(widgetInfo, await loadWidgetData()));
      return;
    case 'WIDGET_UPDATE':
      await refreshFromServer();
      renderWidget(render(widgetInfo, await loadWidgetData()));
      return;
  }
};

/** Ilova ichidan: ma'lumot o'zgarganda ekrandagi barcha vidjetlarni qayta chizish. */
export async function updateWidgets(fromServer = false): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { requestWidgetUpdate } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    if (fromServer) await refreshFromServer();
    const data = await loadWidgetData();
    await Promise.all(
      Object.values(WIDGETS).map((name) =>
        requestWidgetUpdate({ widgetName: name, renderWidget: (info) => render(info, data) }),
      ),
    );
  } catch {
    // Expo Go'da yoki vidjet moduli yo'q bo'lsa — jim o'tamiz
  }
}

/** Uy ekraniga vidjet qo'shish oynasini ochadi (Android 8+). */
export async function pinWidget(name: string): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const { requestPinWidget } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    return await requestPinWidget({ widgetName: name });
  } catch {
    return false;
  }
}
