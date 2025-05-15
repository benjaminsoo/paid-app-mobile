import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Aeonik-Black': require('../assets/fonts/Aeonik-Black.otf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
          <Stack.Screen 
            name="add-debt" 
            options={{ 
              presentation: 'modal',
              headerTitle: 'Add Debt',
              headerTitleStyle: {
                fontFamily: 'Aeonik-Black',
              },
              headerTintColor: Colors.light.tint,
              headerStyle: {
                backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
              }
            }} 
          />
          <Stack.Screen 
            name="auth/login" 
            options={{ 
              headerTitle: 'Login',
              headerTitleStyle: {
                fontFamily: 'Aeonik-Black',
              },
              headerShown: false,
            }} 
          />
          <Stack.Screen 
            name="auth/signup" 
            options={{ 
              headerTitle: 'Sign Up',
              headerTitleStyle: {
                fontFamily: 'Aeonik-Black',
              },
              headerShown: false,
            }} 
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
