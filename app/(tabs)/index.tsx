import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Text, Platform, ActivityIndicator, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserDebts, markDebtAsPaid } from '@/firebase/firestore';
import { Debt } from '@/firebase/models';
import eventEmitter from '@/utils/eventEmitter';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const { currentUser } = useAuth();
  
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Used to force refresh
  
  // Calculate total amount owed
  const totalOwed = debts
    .filter(debt => !debt.isPaid)
    .reduce((sum, debt) => sum + debt.amount, 0);
  
  // Count of people who owe money
  const uniqueDebtors = new Set(
    debts
      .filter(debt => !debt.isPaid)
      .map(debt => debt.debtorName.toLowerCase())
  );
  
  // Function to load debts
  const loadDebts = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const userDebts = await fetchUserDebts(currentUser.uid);
      console.log('Fetched debts:', JSON.stringify(userDebts, null, 2));
      setDebts(userDebts);
      setError(null);
    } catch (err: any) {
      console.error('Error loading debts:', err);
      // Show a user-friendly error message based on the error type
      if (err.code === 'permission-denied') {
        setError('Permission denied. Please check your Firestore security rules.');
      } else {
        setError('Failed to load debts. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser]);
  
  // Load debts when component mounts or refreshKey changes
  useEffect(() => {
    console.log('Loading debts, refreshKey:', refreshKey);
    loadDebts();
  }, [loadDebts, refreshKey]);
  
  // Additional useEffect to force a refresh when the component mounts
  useEffect(() => {
    // Set a timeout to check for debts after a short delay
    // This helps with the initial render where data might not be loaded yet
    const timer = setTimeout(() => {
      if (debts.length === 0 && !loading && !error) {
        console.log('No debts found after delay, forcing refresh');
        setRefreshKey(prev => prev + 1);
      }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [debts.length, loading, error]);
  
  // Button to manually refresh the list
  const handleRefresh = () => {
    console.log('Manual refresh triggered');
    setRefreshKey(prev => prev + 1);
  };
  
  // Handle marking a debt as paid
  const handleMarkPaid = async (debtId: string) => {
    if (!currentUser) return;
    
    try {
      await markDebtAsPaid(currentUser.uid, debtId);
      // Update local state to reflect the change
      setDebts(prevDebts => 
        prevDebts.map(debt => 
          debt.id === debtId 
            ? { ...debt, isPaid: true, paidAt: new Date().toISOString() } 
            : debt
        )
      );
    } catch (err) {
      console.error('Error marking debt as paid:', err);
    }
  };
  
  // Render a debt item
  const renderDebtItem = ({ item }: { item: Debt }) => {
    console.log('Rendering debt item:', item);
    return (
      <View style={[styles.debtItem, item.isPaid && styles.paidDebtItem]}>
        <View style={styles.debtInfo}>
          <Text style={styles.debtorName}>{item.debtorName}</Text>
          <Text style={styles.debtAmount}>${item.amount.toFixed(2)}</Text>
          {item.description ? (
            <Text style={styles.debtDescription}>{item.description}</Text>
          ) : null}
          <Text style={styles.debtDate}>
            {item.isPaid 
              ? `Paid on ${new Date(item.paidAt!).toLocaleDateString()}` 
              : `Added on ${new Date(item.createdAt).toLocaleDateString()}`}
          </Text>
        </View>
        
        {!item.isPaid && (
          <Pressable 
            style={({pressed}) => [
              styles.markPaidButton,
              {opacity: pressed ? 0.8 : 1}
            ]}
            onPress={() => handleMarkPaid(item.id!)}
          >
            <Ionicons name="checkmark-circle" size={20} color={Colors.light.tint} />
            <Text style={styles.markPaidText}>Mark Paid</Text>
          </Pressable>
        )}
      </View>
    );
  };
  
  // Listen for debt added events
  useEffect(() => {
    // This function will be called whenever a debt is added
    const handleDebtAdded = (newDebt: Debt) => {
      console.log('EVENT: Debt added, triggering refresh', newDebt);
      // Force a refresh of the debts list
      setRefreshKey(prev => prev + 1);
      
      // Optionally, you could also update the state directly for instant feedback
      // This would avoid the loading indicator
      /*
      setDebts(prevDebts => {
        // Add the new debt to the beginning of the list (since we sort by createdAt desc)
        return [newDebt, ...prevDebts];
      });
      */
    };
    
    // Subscribe to the DEBT_ADDED event
    const unsubscribe = eventEmitter.on('DEBT_ADDED', handleDebtAdded);
    
    // Clean up the subscription when the component unmounts
    return () => {
      unsubscribe();
    };
  }, []);  // Empty dependency array means this only runs once when component mounts
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['rgba(18,18,18,0.98)', 'rgba(28,28,28,0.95)']}
        style={styles.backgroundGradient}
      />
      
      {/* Header with Add Button */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.logo}>
          Paid.
        </ThemedText>
        
        <Pressable 
          style={({pressed}) => [
            styles.addButton,
            {opacity: pressed ? 0.8 : 1}
          ]}
          onPress={() => {
            router.push('/add-debt');
          }}
        >
          <LinearGradient
            colors={[Colors.light.tint, '#3DCD84', '#2EBB77']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="add-circle" size={16} color="#000" style={styles.buttonIcon} />
              <ThemedText style={styles.addButtonText}>Add Debt</ThemedText>
            </View>
          </LinearGradient>
        </Pressable>
      </View>
      
      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Total Owed Card */}
        <LinearGradient
          colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.totalCard}
        >
          <Text style={[styles.debugTitle, {color: '#fff'}]}>
            Total Amount Owed
          </Text>
          <Text style={[styles.debugAmount, {color: '#fff'}]}>
            ${totalOwed.toFixed(2)}
          </Text>
          <View style={styles.debugPeopleRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="people-outline" size={16} color="#fff" />
            </View>
            <Text style={[styles.debugPeopleText, {color: 'rgba(255,255,255,0.8)'}]}>
              {uniqueDebtors.size} {uniqueDebtors.size === 1 ? 'person owes' : 'people owe'} you
            </Text>
          </View>
        </LinearGradient>
        
        {/* Debt List */}
        <LinearGradient
          colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.debtListContainer}
        >
          <View style={styles.debtListHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Recent Debts</ThemedText>
            <View style={styles.headerButtons}>
              <Pressable 
                style={styles.refreshButton}
                onPress={handleRefresh}
              >
                <Ionicons name="refresh" size={16} color={Colors.light.tint} />
              </Pressable>
              <Pressable style={styles.filterButton}>
                <Ionicons name="filter" size={16} color={Colors.light.tint} />
              </Pressable>
            </View>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.tint} />
              <Text style={styles.loadingText}>Loading debts...</Text>
              <Text style={styles.loadingSubText}>
                If this takes a while, check your Firestore rules or try the refresh button.
              </Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={40} color={Colors.light.tint} />
              <Text style={styles.errorText}>Error: {error}</Text>
            </View>
          ) : debts.length === 0 && !loading && !error ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <Ionicons 
                  name="receipt-outline" 
                  size={50} 
                  color={Colors.light.tint}
                  style={{opacity: 0.9}}
                />
              </View>
              <Text style={styles.emptyStateText}>
                No debts yet. Add your first debt to start tracking.
              </Text>
            </View>
          ) : (
            <FlatList
              data={debts}
              keyExtractor={(item) => item.id || Math.random().toString()}
              renderItem={renderDebtItem}
              scrollEnabled={false}
              contentContainerStyle={styles.debtList}
              ListEmptyComponent={!loading && (
                <Text style={styles.emptyStateText}>
                  No debts found. Add your first debt to start tracking.
                </Text>
              )}
            />
          )}
        </LinearGradient>
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  logo: {
    fontSize: 28,
    fontFamily: 'Aeonik-Black',
    color: Colors.light.tint,
  },
  totalCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
  debugTitle: {
    fontWeight: '400',
    fontSize: 16,
    marginBottom: 16,
    opacity: 0.7,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-light',
  },
  debugAmount: {
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 20,
    fontFamily: 'Aeonik-Black',
  },
  debugPeopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(74, 226, 144, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  debugPeopleText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  debtListContainer: {
    flex: 1,
    minHeight: 350,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
  debtListHeader: {
    padding: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 226, 144, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  filterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 226, 144, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    color: '#fff',
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
  loadingSubText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(74, 226, 144, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 226, 144, 0.2)',
  },
  emptyStateText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
    maxWidth: '80%',
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  debtList: {
    padding: 16,
  },
  debtItem: {
    backgroundColor: 'rgba(50,50,50,0.5)',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paidDebtItem: {
    opacity: 0.6,
    backgroundColor: 'rgba(40,40,40,0.5)',
  },
  debtInfo: {
    flex: 1,
  },
  debtorName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginBottom: 4,
  },
  debtAmount: {
    color: Colors.light.tint,
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    marginBottom: 8,
  },
  debtDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 8,
  },
  debtDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  markPaidButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 226, 144, 0.15)',
    padding: 8,
    borderRadius: 8,
  },
  markPaidText: {
    color: Colors.light.tint,
    fontSize: 12,
    fontFamily: 'Aeonik-Black',
    marginLeft: 4,
  },
  addButton: {
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
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 6,
  },
  addButtonText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
  },
});
