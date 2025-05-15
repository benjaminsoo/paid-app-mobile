import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LinearGradient } from 'expo-linear-gradient';
import AuthGuard from '@/components/AuthGuard';

// Custom tab bar with modern styling
function CustomTabBar({ state, descriptors, navigation }: any) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.tabBarContainer}>
      <LinearGradient
        colors={['rgba(18,18,18,0.95)', 'rgba(28,28,28,0.98)']}
        style={styles.tabBarBackground}
      />
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel || options.title || route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <HapticTab
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            style={styles.tab}
          >
            {options.tabBarIcon && 
              options.tabBarIcon({ 
                color: isFocused ? Colors.light.tint : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', 
                size: 24,
                focused: isFocused
              })
            }
            
            <View style={[
              styles.tabLabel,
              isFocused && styles.activeTabLabel
            ]}>
              {isFocused && (
                <View style={styles.activeDot} />
              )}
            </View>
          </HapticTab>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <AuthGuard>
      <Tabs
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarLabelStyle: {
            fontFamily: 'Aeonik-Black',
            fontSize: 12,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
                <IconSymbol size={size} name="house.fill" color={color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size, focused }) => (
              <View style={[styles.iconContainer, focused && styles.activeIconContainer]}>
                <IconSymbol size={size} name="person.fill" color={color} />
              </View>
            ),
          }}
        />
      </Tabs>
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    height: Platform.OS === 'ios' ? 90 : 70,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    borderTopWidth: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    height: 4,
    width: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  activeTabLabel: {
    width: 20,
  },
  activeDot: {
    height: 4,
    width: 20,
    borderRadius: 2,
    backgroundColor: Colors.light.tint,
  },
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
  },
  activeIconContainer: {
    backgroundColor: 'rgba(74, 226, 144, 0.1)',
  },
});
