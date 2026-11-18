import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, View, type ScrollViewProps } from 'react-native';

const GAP = 24; // input va klaviatura orasidagi bo'shliq

/**
 * Klaviatura ochilganda fokusdagi inputni ko'rinadigan joyga suradigan ScrollView.
 *
 * Expo SDK 54+ Android'da edge-to-edge rejimida ishlaydi: tizim oynani o'zi siqmaydi,
 * shuning uchun pastga klaviatura balandligicha bo'sh joy qo'shamiz va kerakli joyga aylantiramiz.
 */
export function KeyboardScrollView({ children, onScroll, ...props }: ScrollViewProps) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const reveal = (kbTop: number) => {
      const input = TextInput.State.currentlyFocusedInput() as unknown as
        | { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void }
        | null;
      input?.measureInWindow?.((_x, y, _w, h) => {
        const overlap = y + h + GAP - kbTop;
        if (overlap > 0) scrollRef.current?.scrollTo({ y: offset.current + overlap, animated: true });
      });
    };

    const show = Keyboard.addListener(showEvt, (e) => {
      setKbHeight(e.endCoordinates.height);
      // Bo'sh joy chizilgandan keyin aylantiramiz
      setTimeout(() => reveal(e.endCoordinates.screenY), 60);
    });
    const hide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={(e) => {
        offset.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
      {...props}
    >
      {children}
      <View style={{ height: kbHeight }} />
    </ScrollView>
  );
}
