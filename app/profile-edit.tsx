import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, View, Text, Pressable, TextInput, ActivityIndicator, Platform, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/firebase/firestore';
import { uploadProfileImage, uploadBackgroundImage } from '@/firebase/storage';
import { PaymentMethod } from '@/firebase/models';

// Only log in development mode
const isDevelopment = Constants.expoConfig?.extra?.NODE_ENV === 'development';
const logDebug = (message: string, data?: any) => {
  if (isDevelopment) {
    console.log(message, data);
  }
};

export default function ProfileEditScreen() {
  const colorScheme = useColorScheme();
  const { currentUser, userProfile, refreshUserProfile } = useAuth();
  const router = useRouter();
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Profile image handling
  const [profileImage, setProfileImage] = useState<any>(null);
  const [profileImageURL, setProfileImageURL] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<any>(null);
  const [backgroundImageURL, setBackgroundImageURL] = useState<string | null>(null);
  
  // Form data
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    { type: 'venmo', value: '' },
    { type: 'zelle', value: '', valueType: 'email' },
    { type: 'cashapp', value: '' },
    { type: 'paypal', value: '', valueType: 'email' },
    { type: 'applepay', value: '' }
  ]);
  
  // Use refs to track initialization state
  const initialized = useRef(false);

  // Initialize form data only once when component mounts and userProfile is available
  useEffect(() => {
    // Only run this once and only if we have userProfile data
    if (!userProfile || initialized.current) return;
    
    logDebug('Initializing form data with userProfile:', userProfile);
    
    // Basic info
    if (userProfile.profile) {
      setName(userProfile.profile.name || '');
      setLocation(userProfile.profile.location || '');
      setPreferredPaymentMethod(userProfile.profile.preferredPaymentMethod || '');
      
      // Check for profile image in both locations (profile sub-document and root)
      const profileImgUrl = userProfile.profile.profileImageUrl || userProfile.profileImageUrl;
      if (profileImgUrl) {
        logDebug('Setting profile image URL from:', profileImgUrl);
        setProfileImageURL(profileImgUrl);
      }
      
      // Check for background image
      const backgroundImgUrl = userProfile.profile.backgroundImageUrl;
      if (backgroundImgUrl) {
        logDebug('Setting background image URL from:', backgroundImgUrl);
        setBackgroundImageURL(backgroundImgUrl);
      }
      
      // Check for payment methods in both places (nested or root level)
      const methods = userProfile.profile.paymentMethods || userProfile.paymentMethods;
      if (methods && methods.length > 0) {
        logDebug('Found payment methods:', methods);
        
        // Create a fresh default methods array
        const defaultMethods = [
          { type: 'venmo', value: '' },
          { type: 'zelle', value: '', valueType: 'email' },
          { type: 'cashapp', value: '' },
          { type: 'paypal', value: '', valueType: 'email' },
          { type: 'applepay', value: '' }
        ];
        
        // Map existing methods to default structure
        const mergedMethods = defaultMethods.map(defaultMethod => {
          const existingMethod = methods.find(
            (m: PaymentMethod) => m.type === defaultMethod.type
          );
          return existingMethod ? { ...defaultMethod, ...existingMethod } : defaultMethod;
        });
        
        logDebug('Merged payment methods:', mergedMethods);
        setPaymentMethods(mergedMethods);
      }
    }
    
    // Mark as initialized so we don't run this again
    initialized.current = true;
  }, [userProfile]);

  // Pick an image from the gallery
  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        setError('Permission to access camera roll is required!');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        logDebug('Image selected:', result.assets[0].uri.substring(0, 50) + '...');
        setProfileImage(result.assets[0]);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      setError('Failed to pick image. Please try again.');
    }
  };

  // Pick a background image from the gallery
  const pickBackgroundImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        setError('Permission to access camera roll is required!');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        logDebug('Background image selected:', result.assets[0].uri.substring(0, 50) + '...');
        setBackgroundImage(result.assets[0]);
      }
    } catch (err) {
      console.error('Error picking background image:', err);
      setError('Failed to pick background image. Please try again.');
    }
  };

  // Handle payment method changes
  const updatePaymentMethod = useCallback((index: number, value: string) => {
    setPaymentMethods(prev => {
      const updated = [...prev];
      updated[index].value = value;
      return updated;
    });
  }, []);

  // Handle payment method type changes
  const updatePaymentMethodType = useCallback((index: number, valueType: string) => {
    setPaymentMethods(prev => {
      const updated = [...prev];
      updated[index].valueType = valueType;
      return updated;
    });
  }, []);

  // Handle form submission
  const handleSubmit = async () => {
    if (!currentUser) {
      setError('You must be logged in to update your profile');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      logDebug('Submitting profile data:', {
        name,
        location,
        profileImage: profileImage ? 'New image selected' : 'Using existing URL',
        backgroundImage: backgroundImage ? 'New background image selected' : 'Using existing URL',
        paymentMethods
      });
      
      // Upload profile image if a new one was selected
      let profileImageURL_updated = profileImageURL;
      if (profileImage) {
        logDebug('Uploading profile image...');
        try {
          profileImageURL_updated = await uploadProfileImage(
            currentUser.uid, 
            profileImage.uri
          );
          logDebug('Profile image uploaded:', profileImageURL_updated);
        } catch (error) {
          logDebug('Profile image upload failed:', error);
          // Continue with the existing local URL if upload fails
          profileImageURL_updated = profileImage.uri;
        }
      }
      
      // Upload background image if a new one was selected
      let backgroundImageURL_updated = backgroundImageURL;
      if (backgroundImage) {
        logDebug('Uploading background image...');
        try {
          backgroundImageURL_updated = await uploadBackgroundImage(
            currentUser.uid,
            backgroundImage.uri
          );
          logDebug('Background image uploaded:', backgroundImageURL_updated);
        } catch (error) {
          logDebug('Background image upload failed:', error);
          // Continue with the existing local URL if upload fails
          backgroundImageURL_updated = backgroundImage.uri;
        }
      }
      
      // Create profile data object for the profile sub-document
      const profileData = {
        name,
        location,
        preferredPaymentMethod,
        // Include payment methods inside the profile object
        paymentMethods: paymentMethods,
        // Include profile image URL inside profile if present
        ...(profileImage || profileImageURL ? {
          profileImageUrl: profileImage ? profileImageURL_updated : profileImageURL
        } : {}),
        // Include background image URL inside profile if present
        ...(backgroundImage || backgroundImageURL ? {
          backgroundImageUrl: backgroundImage ? backgroundImageURL_updated : backgroundImageURL
        } : {})
      };
      
      // Update profile data
      await updateUserProfile(currentUser.uid, profileData);
      
      // Refresh user profile
      await refreshUserProfile();
      
      // Show success message briefly
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        router.back();
      }, 1500);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
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
        <Pressable 
          style={({pressed}) => [
            styles.backButton,
            {opacity: pressed ? 0.7 : 1}
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={styles.placeholderView} />
      </View>
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {success && (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={24} color={Colors.light.tint} />
            <Text style={styles.successText}>Profile updated successfully!</Text>
          </View>
        )}
        
        {/* Basic Information */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              placeholderTextColor="rgba(255,255,255,0.4)"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="City, State"
              placeholderTextColor="rgba(255,255,255,0.4)"
            />
          </View>
        </View>
        
        {/* Profile Image */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Profile Image</Text>
          
          <View style={styles.profileImageContainer}>
            <View style={styles.profileImageWrapper}>
              {profileImage ? (
                <Image 
                  source={{ uri: profileImage.uri }}
                  style={styles.profileImage}
                />
              ) : profileImageURL ? (
                <Image 
                  source={{ uri: profileImageURL }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Ionicons name="person" size={50} color="rgba(255,255,255,0.3)" />
                </View>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.selectImageButton}
              onPress={pickImage}
            >
              <Text style={styles.selectImageText}>
                {profileImage || profileImageURL ? 'Change Image' : 'Select Image'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Background Image */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Background Image</Text>
          
          <View style={styles.backgroundImageContainer}>
            <View style={styles.backgroundImageWrapper}>
              {backgroundImage ? (
                <Image 
                  source={{ uri: backgroundImage.uri }}
                  style={styles.backgroundImage}
                />
              ) : backgroundImageURL ? (
                <Image 
                  source={{ uri: backgroundImageURL }}
                  style={styles.backgroundImage}
                />
              ) : (
                <View style={styles.backgroundImagePlaceholder}>
                  <Ionicons name="image-outline" size={50} color="rgba(255,255,255,0.3)" />
                </View>
              )}
            </View>
            
            <TouchableOpacity 
              style={styles.selectImageButton}
              onPress={pickBackgroundImage}
            >
              <Text style={styles.selectImageText}>
                {backgroundImage || backgroundImageURL ? 'Change Background' : 'Select Background'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Preferred Payment Method */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Preferred Payment Method</Text>
          <Text style={styles.sectionDescription}>
            Select your preferred payment method that will be highlighted in your profile and suggested first to people who owe you money.
          </Text>
          
          <View style={styles.preferredMethodContainer}>
            {paymentMethods.map((method, index) => (
              <Pressable 
                key={method.type}
                style={[
                  styles.preferredMethodButton,
                  preferredPaymentMethod === method.type && styles.preferredMethodButtonActive
                ]}
                onPress={() => setPreferredPaymentMethod(method.type)}
              >
                <View style={[
                  styles.paymentIcon, 
                  { 
                    backgroundColor: 
                      method.type === 'venmo' ? '#3D95CE' : 
                      method.type === 'zelle' ? '#6D1ED4' : 
                      method.type === 'cashapp' ? '#00D632' : 
                      method.type === 'paypal' ? '#0079C1' : 
                      method.type === 'applepay' ? '#000' : '#555'
                  }
                ]}>
                  {method.type === 'venmo' && <Ionicons name="logo-venmo" size={18} color="#fff" />}
                  {method.type === 'zelle' && <Text style={styles.paymentIconText}>Z</Text>}
                  {method.type === 'cashapp' && <Ionicons name="cash-outline" size={18} color="#fff" />}
                  {method.type === 'paypal' && <Ionicons name="logo-paypal" size={18} color="#fff" />}
                  {method.type === 'applepay' && <Ionicons name="logo-apple" size={18} color="#fff" />}
                </View>
                <Text style={[
                  styles.preferredMethodText,
                  preferredPaymentMethod === method.type && styles.preferredMethodTextActive
                ]}>
                  {method.type === 'venmo' ? 'Venmo' : 
                   method.type === 'zelle' ? 'Zelle' : 
                   method.type === 'cashapp' ? 'Cash App' : 
                   method.type === 'paypal' ? 'PayPal' : 
                   method.type === 'applepay' ? 'Apple Pay' : method.type}
                </Text>
                {preferredPaymentMethod === method.type && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.light.tint} style={styles.preferredIcon} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
        
        {/* Payment Methods */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          
          {/* Venmo */}
          <View style={styles.paymentMethodContainer}>
            <View style={styles.paymentMethodHeader}>
              <View style={[styles.paymentIcon, { backgroundColor: '#3D95CE' }]}>
                <Ionicons name="logo-venmo" size={18} color="#fff" />
              </View>
              <Text style={styles.paymentMethodName}>Venmo</Text>
            </View>
            
            <View style={styles.paymentInputContainer}>
              <Text style={styles.paymentPrefix}>@</Text>
              <TextInput
                style={styles.paymentInput}
                value={paymentMethods[0].value}
                onChangeText={(text) => updatePaymentMethod(0, text)}
                placeholder="username"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
            </View>
          </View>
          
          {/* Zelle */}
          <View style={styles.paymentMethodContainer}>
            <View style={styles.paymentMethodHeader}>
              <View style={[styles.paymentIcon, { backgroundColor: '#6D1ED4' }]}>
                <Text style={styles.paymentIconText}>Z</Text>
              </View>
              <Text style={styles.paymentMethodName}>Zelle</Text>
            </View>
            
            <View style={styles.paymentTypeSelector}>
              <Pressable
                style={[
                  styles.paymentTypeButton,
                  paymentMethods[1].valueType === 'email' && styles.paymentTypeButtonActive
                ]}
                onPress={() => updatePaymentMethodType(1, 'email')}
              >
                <Text style={[
                  styles.paymentTypeText,
                  paymentMethods[1].valueType === 'email' && styles.paymentTypeTextActive
                ]}>
                  Email
                </Text>
              </Pressable>
              
              <Pressable
                style={[
                  styles.paymentTypeButton,
                  paymentMethods[1].valueType === 'phone' && styles.paymentTypeButtonActive
                ]}
                onPress={() => updatePaymentMethodType(1, 'phone')}
              >
                <Text style={[
                  styles.paymentTypeText,
                  paymentMethods[1].valueType === 'phone' && styles.paymentTypeTextActive
                ]}>
                  Phone
                </Text>
              </Pressable>
            </View>
            
            <TextInput
              style={styles.paymentInput}
              value={paymentMethods[1].value}
              onChangeText={(text) => updatePaymentMethod(1, text)}
              placeholder={paymentMethods[1].valueType === 'phone' ? "(123) 456-7890" : "email@example.com"}
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType={paymentMethods[1].valueType === 'phone' ? 'phone-pad' : 'email-address'}
            />
          </View>
          
          {/* CashApp */}
          <View style={styles.paymentMethodContainer}>
            <View style={styles.paymentMethodHeader}>
              <View style={[styles.paymentIcon, { backgroundColor: '#00D632' }]}>
                <Ionicons name="cash-outline" size={18} color="#fff" />
              </View>
              <Text style={styles.paymentMethodName}>Cash App</Text>
            </View>
            
            <View style={styles.paymentInputContainer}>
              <Text style={styles.paymentPrefix}>$</Text>
              <TextInput
                style={styles.paymentInput}
                value={paymentMethods[2].value}
                onChangeText={(text) => updatePaymentMethod(2, text)}
                placeholder="username"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
            </View>
          </View>
          
          {/* PayPal */}
          <View style={styles.paymentMethodContainer}>
            <View style={styles.paymentMethodHeader}>
              <View style={[styles.paymentIcon, { backgroundColor: '#0079C1' }]}>
                <Ionicons name="logo-paypal" size={18} color="#fff" />
              </View>
              <Text style={styles.paymentMethodName}>PayPal</Text>
            </View>
            
            <View style={styles.paymentTypeSelector}>
              <Pressable
                style={[
                  styles.paymentTypeButton,
                  paymentMethods[3].valueType === 'email' && styles.paymentTypeButtonActive
                ]}
                onPress={() => updatePaymentMethodType(3, 'email')}
              >
                <Text style={[
                  styles.paymentTypeText,
                  paymentMethods[3].valueType === 'email' && styles.paymentTypeTextActive
                ]}>
                  Email
                </Text>
              </Pressable>
              
              <Pressable
                style={[
                  styles.paymentTypeButton,
                  paymentMethods[3].valueType === 'phone' && styles.paymentTypeButtonActive
                ]}
                onPress={() => updatePaymentMethodType(3, 'phone')}
              >
                <Text style={[
                  styles.paymentTypeText,
                  paymentMethods[3].valueType === 'phone' && styles.paymentTypeTextActive
                ]}>
                  Phone
                </Text>
              </Pressable>
            </View>
            
            <TextInput
              style={styles.paymentInput}
              value={paymentMethods[3].value}
              onChangeText={(text) => updatePaymentMethod(3, text)}
              placeholder={paymentMethods[3].valueType === 'phone' ? "(123) 456-7890" : "email@example.com"}
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType={paymentMethods[3].valueType === 'phone' ? 'phone-pad' : 'email-address'}
            />
          </View>
          
          {/* Apple Pay */}
          <View style={styles.paymentMethodContainer}>
            <View style={styles.paymentMethodHeader}>
              <View style={[styles.paymentIcon, { backgroundColor: '#000' }]}>
                <Ionicons name="logo-apple" size={18} color="#fff" />
              </View>
              <Text style={styles.paymentMethodName}>Apple Pay</Text>
            </View>
            
            <TextInput
              style={styles.paymentInput}
              value={paymentMethods[4].value}
              onChangeText={(text) => updatePaymentMethod(4, text)}
              placeholder="Phone number or Apple ID email"
              placeholderTextColor="rgba(255,255,255,0.4)"
            />
          </View>
        </View>
        
        {/* Save Button */}
        <Pressable 
          style={({pressed}) => [
            styles.saveButton,
            {opacity: (pressed || saving) ? 0.8 : 1}
          ]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <LinearGradient
            colors={[Colors.light.tint, '#3DCD84', '#2EBB77']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.saveButtonGradient}
          >
            {saving ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save Profile</Text>
            )}
          </LinearGradient>
        </Pressable>
        
        {/* Extra space at bottom */}
        <View style={{ height: 60 }} />
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
  successContainer: {
    backgroundColor: 'rgba(74, 226, 144, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  successText: {
    color: Colors.light.tint,
    fontSize: 14,
    marginLeft: 8,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    color: '#fff',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  backgroundImageWrapper: {
    width: 220,
    height: 124,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  backgroundImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectImageButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(74, 226, 144, 0.2)',
    borderRadius: 30,
  },
  selectImageText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
  },
  paymentMethodContainer: {
    backgroundColor: 'rgba(35,35,35,0.98)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentIconText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentMethodName: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Aeonik-Black',
  },
  paymentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentPrefix: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginRight: 8,
  },
  paymentInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  paymentTypeSelector: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  paymentTypeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  paymentTypeButtonActive: {
    backgroundColor: 'rgba(74, 226, 144, 0.2)',
  },
  paymentTypeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  paymentTypeTextActive: {
    color: Colors.light.tint,
    fontFamily: 'Aeonik-Black',
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  preferredMethodContainer: {
    marginTop: 8,
  },
  preferredMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(35,35,35,0.98)',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  preferredMethodButtonActive: {
    borderColor: Colors.light.tint,
    backgroundColor: 'rgba(74, 226, 144, 0.1)',
  },
  preferredMethodText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  preferredMethodTextActive: {
    fontFamily: 'Aeonik-Black',
    color: Colors.light.tint,
  },
  preferredIcon: {
    marginLeft: 8,
  },
  sectionDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
}); 