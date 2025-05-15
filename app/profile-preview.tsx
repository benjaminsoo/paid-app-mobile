import React, { useEffect, useState, ReactElement } from 'react';
import { StyleSheet, View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { useRouter, Stack } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfilePreviewScreen() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Construct the profile URL
  const profileUrl = userProfile?.username 
    ? `https://trypaid.io/${userProfile.username}`
    : null;
    
  const handleWebViewLoad = () => {
    setLoading(false);
  };
  
  const handleWebViewError = () => {
    setLoading(false);
    setError('Failed to load the preview. Please try again later.');
  };
  
  return (
    <>
      {/* Hide the default header */}
      <Stack.Screen options={{ headerShown: false }} />
      
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        
        <LinearGradient
          colors={['rgba(18,18,18,0.98)', 'rgba(28,28,28,0.95)']}
          style={styles.backgroundGradient}
        />
        
        {/* Custom Header */}
        <View style={styles.header}>
          <Pressable 
            style={({pressed}) => [
              styles.backButton,
              {opacity: pressed ? 0.7 : 1}
            ]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Link Preview</Text>
          <View style={styles.placeholderView} />
        </View>
        
        <View style={styles.webViewContainer}>
          {!profileUrl ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={48} color="#FFA500" />
              <Text style={styles.errorText}>
                You need to set up your username first.
              </Text>
            </View>
          ) : (
            <>
              <WebView
                source={{ uri: profileUrl }}
                style={styles.webView}
                onLoad={handleWebViewLoad}
                onError={handleWebViewError}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => <View />}
              />
              
              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={Colors.light.tint} />
                  <Text style={styles.loadingText}>Loading your public profile...</Text>
                </View>
              )}
              
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={48} color="#FF6347" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 20,
    fontFamily: 'Aeonik-Black',
    color: '#fff',
  },
  placeholderView: {
    width: 40,
  },
  webViewContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    margin: 16,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  webView: {
    flex: 1,
    borderRadius: 12,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
  },
}); 