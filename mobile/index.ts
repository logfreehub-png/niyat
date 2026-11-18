import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// Android uy ekrani vidjetlari: ilova yopiq bo'lsa ham shu handler orqali chiziladi
if (Platform.OS === 'android') {
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    const { widgetTaskHandler } = require('./src/widgets');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch {
    // Expo Go'da vidjet moduli yo'q — development/production build kerak
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
