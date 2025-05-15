import React, { useState } from 'react';
import { 
  StyleSheet, 
  TextInput, 
  Pressable, 
  View, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Alert,
  Text
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/firebase/firestore';

export default function SignupScreen() {
  const router = useRouter();
  const { signup } = useAuth();
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  async function handleSignup() {
    if (!email || !username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    
    // Username validation - only allow alphanumeric and underscore
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      Alert.alert('Error', 'Username can only contain letters, numbers, and underscores');
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if username is already taken
      const usernameDocRef = doc(db, 'usernames', username.toLowerCase());
      const usernameDoc = await getDoc(usernameDocRef);
      
      if (usernameDoc.exists()) {
        Alert.alert('Username Taken', 'This username is already in use. Please choose another one.');
        setLoading(false);
        return;
      }
      
      // Create Firebase auth user
      const userCredential = await signup(email, password);
      const userId = userCredential.user.uid;
      
      // Create initial user profile in Firestore
      await updateUserProfile(userId, {
        name: '',
        location: '',
        paymentMethods: [
          { type: 'venmo', value: '' },
          { type: 'zelle', value: '', valueType: 'email' },
          { type: 'cashapp', value: '' },
          { type: 'paypal', value: '', valueType: 'email' },
          { type: 'applepay', value: '' }
        ]
      });
      
      // Set username at the root level
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        username: username,
        email: email
      });
      
      // Create a document in the usernames collection
      // This is used to ensure username uniqueness and for lookups
      await setDoc(usernameDocRef, {
        uid: userId,
        createdAt: new Date().toISOString()
      });
      
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert(
        'Signup Failed', 
        'Could not create account. Email may already be in use or username may be taken.'
      );
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['rgba(18,18,18,0.98)', 'rgba(28,28,28,0.95)']}
        style={styles.backgroundGradient}
      />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.scrollContainer} 
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Paid.</Text>
            <Text style={styles.subtitle}>Create Your Account</Text>
          </View>
          
          <LinearGradient
            colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
            style={styles.formCard}
          >
            <View style={styles.formSection}>
              <View style={styles.labelContainer}>
                <Ionicons name="mail-outline" size={18} color={Colors.light.tint} style={styles.labelIcon} />
                <Text style={styles.label}>Email</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                selectionColor={Colors.light.tint}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.formSection}>
              <View style={styles.labelContainer}>
                <Ionicons name="person-outline" size={18} color={Colors.light.tint} style={styles.labelIcon} />
                <Text style={styles.label}>Username</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Choose a username"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                selectionColor={Colors.light.tint}
              />
              <Text style={styles.helpText}>
                This will be your payment link: trypaid.io/{username}
              </Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.formSection}>
              <View style={styles.labelContainer}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.light.tint} style={styles.labelIcon} />
                <Text style={styles.label}>Password</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Create a password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                selectionColor={Colors.light.tint}
              />
            </View>
          </LinearGradient>
          
          <Pressable 
            style={({pressed}) => [
              styles.signupButton,
              {opacity: pressed || loading ? 0.8 : 1}
            ]}
            onPress={handleSignup}
            disabled={loading}
          >
            <LinearGradient
              colors={[Colors.light.tint, '#3DCD84', '#2EBB77']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="person-add-outline" size={18} color="#000" style={styles.buttonIcon} />
                <Text style={styles.signupButtonText}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </View>
            </LinearGradient>
          </Pressable>
          
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>
              Already have an account?
            </Text>
            <Pressable 
              onPress={() => router.push('/auth/login')}
              style={({pressed}) => ({opacity: pressed ? 0.8 : 1})}
            >
              <Text style={styles.loginLink}>Login</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    minHeight: '100%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
    paddingTop: 20,
  },
  logoText: {
    fontSize: 48,
    fontFamily: 'Aeonik-Black',
    color: Colors.light.tint,
    marginBottom: 8,
    includeFontPadding: false,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.tint,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  formSection: {
    padding: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelIcon: {
    marginRight: 10,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    color: '#fff',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  helpText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
    marginLeft: 2,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
  },
  signupButton: {
    borderRadius: 30,
    overflow: 'hidden',
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
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  signupButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginRight: 5,
  },
  loginLink: {
    color: Colors.light.tint,
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
  },
}); 