import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Create the authentication context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Track profile refreshing

  // Sign up function
  const signup = useCallback((email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  }, []);

  // Login function
  const login = useCallback((email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  }, []);

  // Logout function
  const logout = useCallback(() => {
    return signOut(auth);
  }, []);

  // Function to fetch user profile data
  const fetchUserProfile = useCallback(async (userId) => {
    if (refreshing) return null; // Prevent multiple simultaneous fetches
    
    try {
      setRefreshing(true);
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = {
          id: userDocSnap.id,
          ...userDocSnap.data()
        };
        setUserProfile(userData);
        return userData;
      } else {
        setUserProfile(null);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  // Function to refresh user profile data
  const refreshUserProfile = useCallback(async () => {
    if (currentUser) {
      return await fetchUserProfile(currentUser.uid);
    }
    return null;
  }, [currentUser, fetchUserProfile]);

  // Set up a listener for auth state changes
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (isMounted) {
      setCurrentUser(user);
      }
      
      if (user && isMounted) {
        await fetchUserProfile(user.uid);
      } else if (isMounted) {
        setUserProfile(null);
      }
      
      if (isMounted) {
      setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [fetchUserProfile]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    currentUser,
    userProfile,
    login,
    signup,
    logout,
    refreshUserProfile
  }), [currentUser, userProfile, login, signup, logout, refreshUserProfile]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 