import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Text, ActivityIndicator, Pressable, Platform, Share, Image, Modal, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';

// Only log in development mode
const isDevelopment = Constants.expoConfig?.extra?.NODE_ENV === 'development';
const logDebug = (message: string, data?: any) => {
  if (isDevelopment) {
    console.log(message, data);
  }
};

// Memoized payment method components for better performance
const PaymentMethodItem = React.memo(({ method, getColor, getIcon, formatName, preferred }: any) => {
  return (
    <View 
      style={styles.paymentMethodContainer}
    >
      <View style={styles.paymentLeftSection}>
        <View style={[styles.paymentIconContainer, { backgroundColor: getColor(method.type) }]}>
          {getIcon(method.type)}
        </View>
        <Text style={styles.paymentMethodName}>
          {formatName(method.type)}
        </Text>
      </View>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.paymentValueScrollContainer}
      >
        <Text style={styles.paymentMethodValue}>
          {method.type === 'venmo' && '@'}
          {method.type === 'cashapp' && '$'}
          {method.value}
        </Text>
      </ScrollView>
    </View>
  );
});

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const { currentUser, userProfile, logout, refreshUserProfile, deleteAccount } = useAuth();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showLinkInfoModal, setShowLinkInfoModal] = useState(false);
  
  // Use ref to track initialization and prevent duplicate refreshes
  const profileInitialized = useRef(false);
  const refreshAttempted = useRef(false);
  
  // Load user profile data only when component mounts or currentUser changes
  useEffect(() => {
    let isMounted = true;
    
    const loadUserProfile = async () => {
      // Skip if no user or already refreshing
      if (!currentUser?.uid) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }
      
      // Skip if we've already refreshed and have a profile
      if (userProfile && profileInitialized.current) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }
      
      try {
        if (isMounted) {
        setLoading(true);
        }
        
        if (!userProfile && !refreshAttempted.current) {
          logDebug('Loading user profile for the first time');
          refreshAttempted.current = true;
          await refreshUserProfile();
        }
        
        if (isMounted) {
          setError(null);
          setLoading(false);
          profileInitialized.current = true;
        }
      } catch (err: any) {
        logDebug('Error loading user profile:', err);
        if (isMounted) {
        setError(err.message || 'Unknown error');
          setLoading(false);
        }
      }
    };
    
    loadUserProfile();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [currentUser, refreshUserProfile]); // Remove userProfile dependency to prevent refresh loops

  // Memoize hasProfileData calculation to prevent recalculations on render
  const hasProfileData = useMemo(() => {
    return userProfile?.profile && 
      (userProfile.profile.name || 
       userProfile.profile.location || 
       userProfile.profileImageUrl || 
       userProfile.profile.backgroundImageUrl ||
       (userProfile.profile && 
        userProfile.profile.paymentMethods && 
        userProfile.profile.paymentMethods.some((method: any) => method.value)));
  }, [userProfile]);

  const handleCopyLink = useCallback(async () => {
    if (!userProfile?.username) return;
    
    try {
      await Clipboard.setStringAsync(`trypaid.io/${userProfile.username}`);
    setLinkCopied(true);
    
    // Reset copied state after 2 seconds
    setTimeout(() => {
      setLinkCopied(false);
    }, 2000);
    } catch (error) {
      logDebug('Error copying to clipboard:', error);
    }
  }, [userProfile?.username]);

  const handleVisitLink = useCallback(async () => {
    if (!userProfile?.username || !hasProfileData) return;
    
    try {
      await Share.share({
        message: `Check out my payment link: trypaid.io/${userProfile.username}`,
        url: `https://trypaid.io/${userProfile.username}`
      });
    } catch (error) {
      logDebug('Error sharing link:', error);
    }
  }, [userProfile?.username, hasProfileData]);

  const handleSignOut = useCallback(async () => {
    try {
      await logout();
      router.replace('/auth/login');
    } catch (error) {
      logDebug('Sign out error:', error);
    }
  }, [logout, router]);

  const handleEditProfile = useCallback(() => {
    router.push('/profile-edit');
  }, [router]);

  const handlePreviewProfile = useCallback(() => {
    router.push('/profile-preview');
  }, [router]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? You will need to confirm with your password on the next screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue', 
          style: 'destructive', 
          onPress: () => router.push({
            pathname: '/profile-edit',
            params: { action: 'delete' }
          })
        }
      ]
    );
  }, [router]);

  // Memoize these functions since they don't depend on any state/props
  const getPaymentMethodColor = useCallback((type: string) => {
    switch (type.toLowerCase()) {
      case 'venmo':
        return '#3D95CE';
      case 'zelle':
        return '#6D1ED4';
      case 'cashapp':
        return '#00D632';
      case 'paypal':
        return '#0079C1';
      case 'applepay':
        return '#000000';
      default:
        return Colors.light.tint;
    }
  }, []);

  const getPaymentMethodIcon = useCallback((type: string) => {
    switch (type.toLowerCase()) {
      case 'venmo':
        return <Ionicons name="logo-venmo" size={16} color="#FFFFFF" />;
      case 'zelle':
        return <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Z</Text>;
      case 'cashapp':
        return <Ionicons name="cash-outline" size={16} color="#FFFFFF" />;
      case 'paypal':
        return <Ionicons name="logo-paypal" size={16} color="#FFFFFF" />;
      case 'applepay':
        return <Ionicons name="logo-apple" size={16} color="#FFFFFF" />;
      default:
        return <Ionicons name="wallet-outline" size={16} color="#FFFFFF" />;
    }
  }, []);

  const formatPaymentMethodName = useCallback((type: string) => {
    switch (type.toLowerCase()) {
      case 'venmo':
        return 'Venmo';
      case 'zelle':
        return 'Zelle';
      case 'cashapp':
        return 'Cash App';
      case 'paypal':
        return 'PayPal';
      case 'applepay':
        return 'Apple Pay';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }, []);

  // Memoize the payment methods list to prevent unnecessary re-renders
  const paymentMethods = useMemo(() => {
    if (!userProfile?.profile?.paymentMethods) return [];
    return userProfile.profile.paymentMethods.filter((method: any) => method.value);
  }, [userProfile?.profile?.paymentMethods]);

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
      
      {/* Link Info Modal */}
      <Modal
        visible={showLinkInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLinkInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.linkInfoModalContent}>
            <View style={styles.linkInfoModalHeader}>
              <Text style={styles.linkInfoModalTitle}>What's a Paid Link?</Text>
              <Pressable
                style={styles.closeModalButton}
                onPress={() => setShowLinkInfoModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            
            <ScrollView style={styles.linkInfoScrollView}>
              <Text style={styles.linkInfoText}>
                Your Paid Link displays all your payment methods in one place.
              </Text>
              <View style={styles.imageContainer}>
                <Image
                  source={require('../../assets/images/link-screenshot.png')}
                  style={styles.linkScreenshotImage}
                  resizeMode="contain"
                />
              </View>
              
              <Text style={styles.linkInfoText}>
              When your friend clicks on a payment method, the corresponding app opens directly to your payment page.
              </Text>
              
              <Text style={styles.linkInfoFooter}>
                Complete your profile to activate your link – it takes less than 1 minute.
              </Text>
            </ScrollView>
            
            <Pressable 
              style={styles.closeModalButtonFull}
              onPress={() => setShowLinkInfoModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
      >
        {loading && !userProfile ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
            <Text style={styles.loadingText}>Loading profile data...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={50} color={Colors.light.tint} />
            <Text style={styles.errorText}>Error: {error}</Text>
          </View>
        ) : userProfile ? (
          <View style={styles.profileContainer}>
            {/* Payment Link Card */}
            <LinearGradient
              colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.card,
                !hasProfileData && styles.incompleteCard
              ]}
            >
              <View style={styles.cardTitleContainer}>
                <Text style={styles.cardTitle}>
                  {hasProfileData 
                    ? "Your Personal Payment Link" 
                    : "Your Link has not been created yet"}
                </Text>
              </View>
              
              <View style={styles.linkContainer}>
                <View style={styles.linkTextContainer}>
                  <Text style={[
                    styles.linkText,
                    !hasProfileData && styles.incompleteText
                  ]}>
                    trypaid.io/{userProfile.username}
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
                  !hasProfileData && styles.disabledButton,
                  {opacity: pressed && hasProfileData ? 0.8 : 1}
                ]}
                onPress={handleVisitLink}
                disabled={!hasProfileData}
              >
                <Ionicons name="open-outline" size={18} color="#000" style={styles.buttonIcon} />
                <Text style={styles.visitButtonText}>Share</Text>
              </Pressable>
              
              {/* Add Preview Button in the Payment Link card */}
              {hasProfileData && (
                <Pressable 
                  style={({pressed}) => [
                    styles.previewButton,
                    {opacity: pressed ? 0.8 : 1}
                  ]}
                  onPress={handlePreviewProfile}
                >
                  <View style={styles.previewButtonContent}>
                    <Ionicons name="globe-outline" size={18} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.previewButtonText}>Preview Link</Text>
                  </View>
                </Pressable>
              )}
              
              {hasProfileData ? (
                <Text style={styles.linkDescription}>
                  Share this link with anyone to receive payments through any of your configured methods.
                </Text>
              ) : (
                <Pressable
                  onPress={() => setShowLinkInfoModal(true)}
                  style={styles.whatsAPaidLinkButton}
                >
                  <Ionicons name="information-circle-outline" size={20} color={Colors.light.tint} style={styles.whatsAPaidLinkIcon} />
                  <Text style={styles.whatsAPaidLinkText}>
                    What's a Paid Link?
                  </Text>
                </Pressable>
              )}
            </LinearGradient>
            
            {/* Add Create Link button outside the card when profile is not set up */}
            {!hasProfileData && (
              <Pressable 
                style={({pressed}) => [
                  styles.createLinkButton,
                  {opacity: pressed ? 0.8 : 1}
                ]}
                onPress={handleEditProfile}
              >
                <LinearGradient
                  colors={[Colors.light.tint, '#3DCD84', '#2EBB77']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.createLinkButtonGradient}
                >
                  <View style={styles.createLinkButtonContent}>
                    <Ionicons name="add-circle-outline" size={18} color="#000" style={styles.buttonIcon} />
                    <Text style={styles.createLinkButtonText}>Create Your Link</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            )}
            
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
                <Text style={styles.infoValue}>{userProfile.email}</Text>
              </View>
              
              <View style={[styles.infoRow, styles.lastInfoRow]}>
                <Text style={styles.infoLabel}>Username:</Text>
                <Text style={styles.infoValue}>{userProfile.username}</Text>
              </View>
            </LinearGradient>
            
            {/* Profile Information */}
            {userProfile.profile && (
              <LinearGradient
                colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
              >
                <View style={styles.accountHeaderContainer}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors.light.tint} />
                  <Text style={styles.accountHeader}>Profile Information</Text>
                </View>
                
                {userProfile.profile.name && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Name:</Text>
                    <Text style={styles.infoValue}>{userProfile.profile.name}</Text>
                  </View>
                )}
                
                {userProfile.profile.location && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Location:</Text>
                    <Text style={styles.infoValue}>{userProfile.profile.location}</Text>
                  </View>
                )}
                
                {userProfile.profile.preferredPaymentMethod && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Preferred Payment:</Text>
                    <Text style={styles.infoValue}>
                      {
                        userProfile.profile.preferredPaymentMethod === 'venmo' ? 'Venmo' :
                        userProfile.profile.preferredPaymentMethod === 'zelle' ? 'Zelle' :
                        userProfile.profile.preferredPaymentMethod === 'cashapp' ? 'Cash App' :
                        userProfile.profile.preferredPaymentMethod === 'paypal' ? 'PayPal' :
                        userProfile.profile.preferredPaymentMethod === 'applepay' ? 'Apple Pay' :
                        userProfile.profile.preferredPaymentMethod
                      }
                    </Text>
                  </View>
                )}
                
                {userProfile.profile.profileImageUrl && (
                  <View style={[styles.infoRow, styles.imageInfoRow]}>
                    <Text style={styles.infoLabel}>Profile Image:</Text>
                    <View style={styles.profileImageContainer}>
                      <Image 
                        source={{ uri: userProfile.profile.profileImageUrl }}
                        style={styles.profileImageThumbnail}
                        resizeMode="cover"
                      />
                    </View>
                  </View>
                )}
                
                {userProfile.profile.backgroundImageUrl && (
                  <View style={[styles.infoRow, styles.imageInfoRow, styles.lastInfoRow]}>
                    <Text style={styles.infoLabel}>Background:</Text>
                    <View style={styles.backgroundImageContainer}>
                      <Image 
                        source={{ uri: userProfile.profile.backgroundImageUrl }}
                        style={styles.backgroundImageThumbnail}
                        resizeMode="cover"
                      />
                    </View>
                  </View>
                )}
              </LinearGradient>
            )}
            
            {/* Payment Methods */}
            {userProfile.profile && paymentMethods.length > 0 && (
              <LinearGradient
                colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
              >
                <View style={styles.accountHeaderContainer}>
                  <Ionicons name="wallet-outline" size={20} color={Colors.light.tint} />
                  <Text style={styles.accountHeader}>Payment Methods</Text>
                </View>
                
                {paymentMethods.map((method: any) => (
                  <PaymentMethodItem 
                    key={method.type}
                    method={method}
                    getColor={getPaymentMethodColor}
                    getIcon={getPaymentMethodIcon}
                    formatName={formatPaymentMethodName}
                    preferred={userProfile.profile.preferredPaymentMethod === method.type}
                  />
                ))}
              </LinearGradient>
            )}
            
            {/* Edit Profile Button - only show if profile has data */}
            {hasProfileData && (
            <Pressable 
              style={({pressed}) => [
                styles.editProfileButton,
                {opacity: pressed ? 0.8 : 1}
              ]}
                onPress={handleEditProfile}
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
            )}
            
            {/* Add Delete Account button only when profile is not set up */}
            {!hasProfileData && (
              <Pressable 
                style={({pressed}) => [
                  styles.deleteAccountButton,
                  {opacity: pressed ? 0.8 : 1}
                ]}
                onPress={handleDeleteAccount}
              >
                <LinearGradient
                  colors={['#FF3B30', '#E03A30']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.deleteAccountButtonGradient}
                >
                  <View style={styles.deleteAccountButtonContent}>
                    <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            )}
            
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
            
            {/* Sign Out Button */}
            <Pressable 
              style={({pressed}) => [
                styles.emptyStateSignOutButton,
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
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

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
    fontFamily: 'AeonikBlack-Regular',
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
    fontFamily: 'AeonikBlack-Regular',
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
    fontFamily: 'AeonikBlack-Regular',
    marginBottom: 30,
  },
  emptyStateSignOutButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '60%',
    maxWidth: 200,
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
  incompleteCard: {
    borderColor: 'rgba(220,38,38,0.2)',
  },
  cardTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    color: '#fff',
  },
  infoButton: {
    padding: 4,
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
    fontFamily: 'AeonikBlack-Regular',
  },
  incompleteText: {
    color: 'rgba(220,38,38,1)',
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
    marginBottom: 0,
    fontFamily: 'AeonikBlack-Regular',
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
  previewButton: {
    backgroundColor: 'rgba(74, 111, 161, 0.9)',
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(59, 89, 152, 0.5)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  disabledButton: {
    backgroundColor: 'rgba(220,38,38,0.9)',
    opacity: 0.5,
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
    fontFamily: 'AeonikBlack-Regular',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontFamily: 'AeonikBlack-Regular',
  },
  imageInfoRow: {
    alignItems: 'center',
  },
  profileImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileImageThumbnail: {
    width: '100%',
    height: '100%',
  },
  backgroundImageContainer: {
    width: 100,
    height: 56, // 16:9 aspect ratio
    borderRadius: 8,
    overflow: 'hidden',
  },
  backgroundImageThumbnail: {
    width: '100%',
    height: '100%',
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
  previewButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonText: {
    color: '#FFFFFF',
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
  // Payment method styles
  paymentMethodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  paymentLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.5,
  },
  paymentIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentMethodName: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Aeonik-Black',
  },
  paymentValueScrollContainer: {
    flex: 1,
    maxWidth: '50%',
  },
  paymentMethodValue: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'AeonikBlack-Regular',
  },
  createLinkButton: {
    borderRadius: 30,
    overflow: 'hidden',
    marginBottom: 20,
    marginTop: 4,
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
  createLinkButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  createLinkButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLinkButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  debugTitle: {
    fontWeight: '400',
    fontSize: 16,
    marginBottom: 16,
    opacity: 0.7,
    fontFamily: 'AeonikBlack-Regular',
  },
  debugPeopleText: {
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
  },
  debtDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 8,
    fontFamily: 'AeonikBlack-Regular',
  },
  debtDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontFamily: 'AeonikBlack-Regular',
  },
  loadingSubText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
    opacity: 0.7,
    fontFamily: 'AeonikBlack-Regular',
  },
  preferredPaymentMethodContainer: {
    borderColor: Colors.light.tint,
    borderWidth: 1,
  },
  preferredBadge: {
    fontSize: 12,
    color: Colors.light.tint,
    fontFamily: 'Aeonik-Black',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  linkInfoModalContent: {
    backgroundColor: '#232323',
    borderRadius: 20,
    width: '100%',
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  linkInfoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  linkInfoModalTitle: {
    color: Colors.light.tint,
    fontSize: 20,
    fontFamily: 'Aeonik-Black',
  },
  closeModalButton: {
    padding: 4,
  },
  linkInfoScrollView: {
    padding: 20,
    maxHeight: 500,
  },
  linkInfoText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
    marginBottom: 20,
    lineHeight: 24,
  },
  imageContainer: {
    width: width - 60,
    height: (width - 60) * 1.8,
    alignSelf: 'center',
    marginVertical: 24,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  linkScreenshotImage: {
    width: '100%',
    height: '100%',
  },
  linkInfoFooter: {
    color: Colors.light.tint,
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
  },
  closeModalButtonFull: {
    backgroundColor: Colors.light.tint,
    padding: 16,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  whatsAPaidLinkButton: {
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    backgroundColor: 'rgba(74, 226, 144, 0.1)',
    borderWidth: 1, 
    borderColor: 'rgba(74, 226, 144, 0.3)',
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  whatsAPaidLinkIcon: {
    marginRight: 8,
  },
  whatsAPaidLinkText: {
    color: Colors.light.tint,
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    textAlign: 'center',
  },
  deleteAccountButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(255, 59, 48, 0.5)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  deleteAccountButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginLeft: 8,
  },
});
