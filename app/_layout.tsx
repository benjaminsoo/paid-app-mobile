import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { AuthProvider } from '@/contexts/AuthContext';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Aeonik-Black': require('../assets/fonts/Aeonik-Black.otf'),
    'AeonikBlack-Regular': require('../assets/fonts/AeonikBlack-Regular.otf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Hide splash screen once resources are loaded
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
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
            name="profile-edit" 
            options={{ 
              presentation: 'modal',
              headerShown: false,
              animation: 'slide_from_right',
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
