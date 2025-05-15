import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, ActivityIndicator, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fetchCollection, fetchDocument } from '@/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Load user data from Firestore
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser?.uid) return;
      
      try {
        setLoading(true);
        // Fetch the current user data directly instead of fetching all users
        const userDoc = await fetchDocument('users', currentUser.uid);
        
        if (userDoc) {
          console.log('User data loaded:', userDoc);
          setUserData(userDoc);
          setError(null);
        } else {
          setError('User data not found');
        }
      } catch (err: any) {
        console.error('Error loading user data:', err);
        setError(err.message || 'Unknown error');
        
        // Handle permission errors gracefully
        if (err.code === 'permission-denied') {
          setError('Permission denied. Please check your Firestore security rules.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadUserData();
  }, [currentUser]);

  const handleCopyLink = () => {
    if (!userData?.username) return;
    
    // Show "copied" indicator even though we can't actually copy to clipboard
    setLinkCopied(true);
    
    // Reset copied state after 2 seconds
    setTimeout(() => {
      setLinkCopied(false);
    }, 2000);
    
    // In a real implementation, this would use Clipboard API
    console.log(`Copying link: trypaid.io/${userData.username}`);
  };

  const handleVisitLink = () => {
    // In a real app, this would open the browser to the payment link
    console.log(`Visiting payment link: trypaid.io/${userData?.username}`);
  };

  const handleSignOut = async () => {
    try {
      await logout();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['rgba(18,18,18,0.98)', 'rgba(28,28,28,0.95)']}
        style={styles.backgroundGradient}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
      </View>
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
            <Text style={styles.loadingText}>Loading profile data...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={50} color={Colors.light.tint} />
            <Text style={styles.errorText}>Error: {error}</Text>
          </View>
        ) : userData ? (
          <View style={styles.profileContainer}>
            {/* Payment Link Card */}
            <LinearGradient
              colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>
                Your Personal Payment Link
              </Text>
              
              <View style={styles.linkContainer}>
                <View style={styles.linkTextContainer}>
                  <Text style={styles.linkText}>
                    trypaid.io/{userData.username}
                  </Text>
                </View>
                
                <Pressable 
                  style={({pressed}) => [
                    styles.copyButton,
                    {opacity: pressed ? 0.8 : 1}
                  ]}
                  onPress={handleCopyLink}
                >
                  <Ionicons 
                    name={linkCopied ? "checkmark" : "copy-outline"} 
                    size={20} 
                    color={linkCopied ? "#4AE290" : "#fff"} 
                  />
                </Pressable>
              </View>
              
              <Pressable 
                style={({pressed}) => [
                  styles.visitButton,
                  {opacity: pressed ? 0.8 : 1}
                ]}
                onPress={handleVisitLink}
              >
                <Ionicons name="open-outline" size={18} color="#000" style={styles.buttonIcon} />
                <Text style={styles.visitButtonText}>Visit</Text>
              </Pressable>
              
              <Text style={styles.linkDescription}>
                Share this link with anyone to receive payments through any of your configured methods.
              </Text>
            </LinearGradient>
            
            {/* Account Information Card */}
            <LinearGradient
              colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.accountHeaderContainer}>
                <Ionicons name="person-circle-outline" size={20} color={Colors.light.tint} />
                <Text style={styles.accountHeader}>Account Information</Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoValue}>{userData.email}</Text>
              </View>
              
              <View style={[styles.infoRow, styles.lastInfoRow]}>
                <Text style={styles.infoLabel}>Username:</Text>
                <Text style={styles.infoValue}>{userData.username}</Text>
              </View>
            </LinearGradient>
            
            {/* Edit Profile Button */}
            <Pressable 
              style={({pressed}) => [
                styles.editProfileButton,
                {opacity: pressed ? 0.8 : 1}
              ]}
              onPress={() => console.log('Edit profile')}
            >
              <LinearGradient
                colors={[Colors.light.tint, '#3DCD84', '#2EBB77']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.editButtonGradient}
              >
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </LinearGradient>
            </Pressable>
            
            {/* Sign Out Button */}
            <Pressable 
              style={({pressed}) => [
                styles.signOutButton,
                {opacity: pressed ? 0.8 : 1}
              ]}
              onPress={handleSignOut}
            >
              <LinearGradient
                colors={['#FF5B5B', '#E04040']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.signOutButtonGradient}
              >
                <View style={styles.signOutButtonContent}>
                  <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.signOutButtonText}>Sign Out</Text>
                </View>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Ionicons 
                name="person-outline" 
                size={50} 
                color={Colors.light.tint}
                style={{opacity: 0.9}}
              />
            </View>
            <Text style={styles.emptyStateTitle}>
              No Profile Data Found
            </Text>
            <Text style={styles.emptyStateText}>
              Your profile information could not be loaded.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Aeonik-Black',
    color: Colors.light.tint,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(74, 226, 144, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(74, 226, 144, 0.2)',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyStateText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: '80%',
  },
  profileContainer: {
    width: '100%',
    paddingBottom: 20,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.tint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    color: '#fff',
    marginBottom: 16,
  },
  linkContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15,15,15,0.9)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
    overflow: 'hidden',
    height: 50,
  },
  linkTextContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  linkText: {
    color: Colors.light.tint,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyButton: {
    width: 44,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  linkDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  visitButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.tint,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  buttonIcon: {
    marginRight: 8,
  },
  visitButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  accountHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  accountHeader: {
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    color: Colors.light.tint,
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingBottom: 16,
  },
  lastInfoRow: {
    marginBottom: 0,
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  infoLabel: {
    width: 100,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  editProfileButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 10,
  },
  editButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  signOutButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(255, 91, 91, 0.5)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  signOutButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginLeft: 8,
  },
});
