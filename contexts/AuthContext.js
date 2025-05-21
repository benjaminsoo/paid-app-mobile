import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider 
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { doc, getDoc, deleteDoc, query, where, getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { deleteUserStorageFiles } from '../firebase/storage';

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

  // Function to delete user account entirely
  const deleteAccount = useCallback(async (password) => {
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }

    try {
      // Get user data to find username
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      let username = null;
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        username = userData.username;
      }

      // Re-authenticate user before deletion
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
      
      // Delete all user storage files (profile images, background images, etc.)
      await deleteUserStorageFiles(currentUser.uid);
      
      // Delete Firestore user data first
      // 1. Delete all debts in the user's subcollections
      const debtsCollectionRef = collection(db, 'users', currentUser.uid, 'debts');
      const debtsSnapshot = await getDocs(debtsCollectionRef);
      
      for (const debtDoc of debtsSnapshot.docs) {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'debts', debtDoc.id));
      }
      
      // 2. Delete all debt groups
      const groupsCollectionRef = collection(db, 'users', currentUser.uid, 'debtGroups');
      const groupsSnapshot = await getDocs(groupsCollectionRef);
      
      for (const groupDoc of groupsSnapshot.docs) {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'debtGroups', groupDoc.id));
      }
      
      // 3. Delete all recurring debts
      const recurringCollectionRef = collection(db, 'users', currentUser.uid, 'recurringDebts');
      const recurringSnapshot = await getDocs(recurringCollectionRef);
      
      for (const recurringDoc of recurringSnapshot.docs) {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'recurringDebts', recurringDoc.id));
      }
      
      // 4. Delete the main user document
      await deleteDoc(userDocRef);
      
      // 5. Delete username entry if exists
      if (username) {
        const usernameDocRef = doc(db, 'usernames', username.toLowerCase());
        const usernameSnap = await getDoc(usernameDocRef);
        
        if (usernameSnap.exists() && usernameSnap.data().uid === currentUser.uid) {
          await deleteDoc(usernameDocRef);
        }
      }
      
      // Delete the authenticated user
      await deleteUser(currentUser);
      
      // Reset local state
      setCurrentUser(null);
      setUserProfile(null);
      
      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }, [currentUser]);

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
    deleteAccount,
    refreshUserProfile
  }), [currentUser, userProfile, login, signup, logout, deleteAccount, refreshUserProfile]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 