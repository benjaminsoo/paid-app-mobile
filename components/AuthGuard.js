import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';

// This component serves as a guard for protected routes
export default function AuthGuard({ children }) {
  const { currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If no user is logged in, redirect to login
    if (currentUser === null) {
      router.replace('/auth/login');
    }
  }, [currentUser, router]);

  if (currentUser === null) {
    // Show a loading state while redirecting
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  // If user is authenticated, render the children (protected content)
  return <>{children}</>;
} 