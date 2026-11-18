import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';

export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Ilova bo'ylab yagona uslubdagi ikonka. */
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
