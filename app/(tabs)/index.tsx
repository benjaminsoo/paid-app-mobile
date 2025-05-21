import React, { useState, useEffect, useCallback, memo } from 'react';
import { StyleSheet, View, ScrollView, Text, Platform, ActivityIndicator, FlatList, Pressable, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserDebts, markDebtAsPaid, getDebtGroups, getDebtGroupWithDebts, deleteDebtGroup, getRecurringDebtById } from '@/firebase/firestore';
import { Debt, DebtGroup, RecurringFrequency, RecurringDebt } from '@/firebase/models';
import eventEmitter from '@/utils/eventEmitter';
import GroupDebtCard from '@/components/GroupDebtCard';

// Helper function to format recurring frequency in a user-friendly way
const formatRecurringFrequency = (frequency: RecurringFrequency): string => {
  switch (frequency) {
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'biweekly': return 'Every 2 weeks';
    case 'monthly': return 'Monthly';
    case 'quarterly': return 'Every 3 months';
    case 'yearly': return 'Yearly';
    default: return 'Recurring';
  }
};

// Create a memoized Debt Item component to prevent unnecessary re-renders
const DebtItem = memo(({ 
  item, 
  onMarkPaid,
  userProfile
}: { 
  item: Debt, 
  onMarkPaid: (id: string) => void,
  userProfile: any
}) => {
  const [recurringInfo, setRecurringInfo] = useState<RecurringDebt | null>(null);
  const { currentUser } = useAuth();
  const router = useRouter();
  
  // Fetch recurring information if this is a recurring debt
  useEffect(() => {
    const fetchRecurringInfo = async () => {
      if (item.isRecurring && item.recurringId && currentUser) {
        try {
          const data = await getRecurringDebtById(currentUser.uid, item.recurringId);
          if (data) {
            setRecurringInfo(data as RecurringDebt);
          }
        } catch (err) {
          console.error('Error fetching recurring info:', err);
        }
      }
    };
    
    fetchRecurringInfo();
  }, [item.isRecurring, item.recurringId, currentUser]);

  // Navigate to debt detail screen
  const navigateToDetail = useCallback(() => {
    router.push({
      pathname: '/debt-detail',
      params: { debt: JSON.stringify(item) }
    });
  }, [router, item]);

  // Check if user has a valid payment link
  const hasValidPaymentLink = useCallback(() => {
    if (!userProfile) return false;
    
    // Check if username exists
    if (!userProfile.username) return false;
    
    // Check if user has a profile setup with at least one of these fields
    const hasProfileData = userProfile.profile && 
      (userProfile.profile.name || 
       userProfile.profile.location || 
       userProfile.profileImageUrl || 
       userProfile.profile.backgroundImageUrl ||
       (userProfile.profile.paymentMethods && 
        userProfile.profile.paymentMethods.some((method: any) => method.value)));
        
    return hasProfileData;
  }, [userProfile]);

  // Function to handle the remind button press
  const handleRemind = useCallback(() => {
    // Create base SMS message text
    let message = `Hey, just a reminder that you owe me $${item.amount.toFixed(2)}${item.description ? ` for ${item.description}` : ''}.`;
    
    // Add payment link if available
    if (userProfile?.username && hasValidPaymentLink()) {
      message += `\n\nPay here: trypaid.io/${userProfile.username}`;
    }
    
    // Encode the message for use in the URL
    const encodedMessage = encodeURIComponent(message);
    
    // If we have a phone number, use it to fill the recipient and the message
    if (item.phoneNumber) {
      const phoneNumber = item.phoneNumber.replace(/\D/g, ''); // Remove non-numeric characters
      
      // Create the SMS URL for opening the messages app with number and message
      const url = Platform.OS === 'ios' 
        ? `sms:${phoneNumber}&body=${encodedMessage}`
        : `sms:${phoneNumber}?body=${encodedMessage}`;
      
      Linking.openURL(url).catch(err => {
        console.error('Error opening messages app:', err);
      });
    } else {
      // If no phone number, just open the messages app with the message body
      const url = Platform.OS === 'ios' 
        ? `sms:&body=${encodedMessage}`
        : `sms:?body=${encodedMessage}`;
        
      Linking.openURL(url).catch(err => {
        console.error('Error opening messages app:', err);
        
        // Fallback to clipboard if linking fails
        Clipboard.setString(message);
        Alert.alert(
          'Message Copied',
          'The reminder message has been copied to your clipboard.'
        );
      });
    }
  }, [item, userProfile, hasValidPaymentLink]);

  return (
    <Pressable 
      style={({pressed}) => [
        styles.debtItem, 
        item.isPaid && styles.paidDebtItem,
        pressed && styles.pressedDebtItem
      ]}
      onPress={navigateToDetail}
    >
      <View style={styles.debtInfo}>
        <View style={styles.debtorNameContainer}>
        <Text style={styles.debtorName}>{item.debtorName}</Text>
          {item.isRecurring && (
            <View style={styles.recurringBadge}>
              <Ionicons name="refresh" size={10} color={Colors.light.tint} />
              <Text style={styles.recurringText}>
                {recurringInfo?.frequency ? formatRecurringFrequency(recurringInfo.frequency) : 'Recurring'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.debtAmount}>${item.amount.toFixed(2)}</Text>
        {item.description ? (
          <Text style={styles.debtDescription}>{item.description}</Text>
        ) : null}
        <View style={styles.debtFooter}>
          <Text style={styles.debtDate}>
            {item.isPaid 
              ? `Paid on ${new Date(item.paidAt!).toLocaleDateString()}` 
              : `Added on ${new Date(item.createdAt).toLocaleDateString()}`}
          </Text>
          {item.phoneNumber && (
            <View style={styles.phoneContainer}>
              <Ionicons name="call-outline" size={12} color={Colors.light.tint} />
            </View>
          )}
        </View>
        
        {/* Recurring details */}
        {item.isRecurring && recurringInfo && (
          <View style={styles.recurringDetailsContainer}>
            <View style={styles.recurringDetailRow}>
              <Ionicons name="calendar-outline" size={12} color={Colors.light.tint} />
              <Text style={styles.recurringDetailText}>
                {`Started: ${new Date(recurringInfo.startDate).toLocaleDateString()}`}
              </Text>
            </View>
            
            {recurringInfo.endDate && (
              <View style={styles.recurringDetailRow}>
                <Ionicons name="flag-outline" size={12} color={Colors.light.tint} />
                <Text style={styles.recurringDetailText}>
                  {`Ends: ${new Date(recurringInfo.endDate).toLocaleDateString()}`}
                </Text>
              </View>
            )}
            
            <View style={styles.recurringDetailRow}>
              <Ionicons name="time-outline" size={12} color={Colors.light.tint} />
              <Text style={styles.recurringDetailText}>
                {`Next charge: ${new Date(recurringInfo.nextGenerationDate).toLocaleDateString()}`}
              </Text>
            </View>
          </View>
        )}
      </View>
      
      {!item.isPaid && (
        <View style={styles.buttonsContainer}>
          <Pressable 
            style={({pressed}) => [
              styles.actionButton,
              styles.remindButton,
              {opacity: pressed ? 0.8 : 1}
            ]}
            onPress={(e) => {
              e.stopPropagation();
              handleRemind();
            }}
          >
            <Ionicons name="chatbubble-outline" size={16} color={Colors.light.tint} />
            <Text style={styles.actionButtonText}>Remind</Text>
          </Pressable>
          
          <Pressable 
            style={({pressed}) => [
              styles.actionButton,
              styles.markPaidButton,
              {opacity: pressed ? 0.8 : 1}
            ]}
            onPress={(e) => {
              e.stopPropagation();
              onMarkPaid(item.id!);
            }}
          >
            <Ionicons name="checkmark-circle" size={16} color={Colors.light.tint} />
            <Text style={styles.actionButtonText}>Mark Paid</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
});

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const { currentUser, userProfile } = useAuth();
  
  const [debts, setDebts] = useState<Debt[]>([]);
  const [groups, setGroups] = useState<(DebtGroup & { debts?: Debt[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Used to force refresh
  
  // Calculate total amount owed (individual debts only, not in groups)
  const totalOwed = debts
    .filter(debt => !debt.isPaid && !debt.groupId) // Only count non-group debts
    .reduce((sum, debt) => sum + debt.amount, 0);
  
  // Add group debt totals
  const totalGroupOwed = groups
    .reduce((sum, group) => sum + (group.totalAmount - group.paidAmount), 0);
  
  // Total combined owed
  const combinedTotalOwed = totalOwed + totalGroupOwed;
  
  // Count of people who owe money (individual debts only)
  const uniqueDebtors = new Set(
    debts
      .filter(debt => !debt.isPaid && !debt.groupId)
      .map(debt => debt.debtorName.toLowerCase())
  );
  
  // Add group debtors
  groups.forEach(group => {
    if (group.debts) {
      group.debts
        .filter(debt => !debt.isPaid)
        .forEach(debt => uniqueDebtors.add(debt.debtorName.toLowerCase()));
    }
  });
  
  // Function to load debts and groups
  const loadData = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      
      // Load individual debts
      const userDebts = await fetchUserDebts(currentUser.uid);
      setDebts(userDebts);
      
      // Load debt groups
      const userGroups = await getDebtGroups(currentUser.uid);
      
      // For each group, load its debts
      const groupsWithDebts = await Promise.all(
        userGroups.map(async (group) => {
          try {
            const groupWithDebts = await getDebtGroupWithDebts(currentUser.uid, group.id!);
            return groupWithDebts;
          } catch (err) {
            console.error(`Error loading debts for group ${group.id}:`, err);
            // Return the group without debts if there was an error
            return { ...group, debts: [] };
          }
        })
      );
      
      setGroups(groupsWithDebts);
      setError(null);
    } catch (err: any) {
      console.error('Error loading data:', err);
      // Show a user-friendly error message based on the error type
      if (err.code === 'permission-denied') {
        setError('Permission denied. Please check your Firestore security rules.');
      } else {
        setError('Failed to load data. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser]);
  
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
  
  // Handle marking a group debt as paid
  const handleMarkGroupDebtPaid = async (debtId: string, isPaid: boolean) => {
    if (!currentUser) return;
    
    try {
      await markDebtAsPaid(currentUser.uid, debtId, !isPaid);
      
      // Force a refresh of the data to reflect the changes
      loadData();
    } catch (err) {
      console.error('Error marking group debt as paid:', err);
      Alert.alert('Error', 'Failed to update payment status');
    }
  };
  
  // Handle deleting a group
  const handleDeleteGroup = async (groupId: string) => {
    if (!currentUser) return;
    
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? You can choose to keep or delete the individual debts.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Keep Debts', 
          onPress: async () => {
            try {
              await deleteDebtGroup(currentUser.uid, groupId, true);
              // Remove the group from state
              setGroups(prev => prev.filter(g => g.id !== groupId));
              // Reload debts to reflect changes
              loadData();
            } catch (err) {
              console.error('Error deleting group:', err);
              Alert.alert('Error', 'Failed to delete group');
            }
          }
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDebtGroup(currentUser.uid, groupId, false);
              // Remove the group from state
              setGroups(prev => prev.filter(g => g.id !== groupId));
              // Reload debts to reflect changes
              loadData();
            } catch (err) {
              console.error('Error deleting group and debts:', err);
              Alert.alert('Error', 'Failed to delete group and debts');
            }
          }
        }
      ]
    );
  };
  
  // Render a debt item - use the memoized component with userProfile
  const renderDebtItem = useCallback(({ item }: { item: Debt }) => {
    // Only render non-group debts here
    if (item.groupId) return null;
    
    return <DebtItem item={item} onMarkPaid={handleMarkPaid} userProfile={userProfile} />;
  }, [handleMarkPaid, userProfile]);
  
  // Render group debt items
  const renderGroupItems = useCallback(() => {
    return groups.map(group => (
      <GroupDebtCard
        key={group.id}
        group={group}
        onMarkPaid={handleMarkGroupDebtPaid}
        onDelete={handleDeleteGroup}
      />
    ));
  }, [groups, handleMarkGroupDebtPaid, handleDeleteGroup]);
  
  // Optimize the effect to avoid unnecessary refreshes
  useEffect(() => {
    // Load debts only when component mounts or when refreshKey changes
    console.log('Loading data, refreshKey:', refreshKey);
    loadData();
  }, [loadData, refreshKey]); // Keep this dependency array
  
  // Optimize the auto-refresh effect to prevent unnecessary refreshes
  useEffect(() => {
    // Only run this effect once to check for initial data
    let timer: ReturnType<typeof setTimeout> | null = null;
    
    // Only trigger a refresh if:
    // 1. There's no data (debts and groups are empty arrays)
    // 2. We're not currently loading
    // 3. There's no error
    // 4. We haven't initialized data yet (this is the key to prevent constant refreshes)
    if (debts.length === 0 && groups.length === 0 && !loading && !error && refreshKey === 0) {
      // Set a timeout to wait for data to load before forcing a refresh
      timer = setTimeout(() => {
        console.log('No data found after delay, forcing refresh');
        setRefreshKey(prev => prev + 1);
      }, 2000); // Increase timeout to 2 seconds to avoid too many refreshes
    }
    
    // Clean up timeout on unmount
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [debts.length, groups.length, loading, error, refreshKey]); // Add refreshKey to dependencies
  
  // Listen for debt added/updated events
  useEffect(() => {
    // This function will be called whenever a debt is added
    const handleDebtAdded = () => {
      console.log('EVENT: Debt added or updated, triggering refresh');
      // Force a refresh of the debts list
      setRefreshKey(prev => prev + 1);
    };
    
    // Subscribe to the events
    const debtAddedUnsubscribe = eventEmitter.on('DEBT_ADDED', handleDebtAdded);
    const debtUpdatedUnsubscribe = eventEmitter.on('DEBT_UPDATED', handleDebtAdded);
    
    // Clean up the subscription when the component unmounts
    return () => {
      debtAddedUnsubscribe();
      debtUpdatedUnsubscribe();
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
        
        <View style={styles.headerButtonsContainer}>
          {/* Receipt Splitter Button */}
          <Pressable 
            style={({pressed}) => [
              styles.receiptButton,
              {opacity: pressed ? 0.8 : 1}
            ]}
            onPress={async () => {
              try {
                // Request camera permission
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                
                if (status !== 'granted') {
                  console.error('Camera permission not granted');
                  Alert.alert('Permission Required', 
                    'Camera permission is required to scan receipts. Please enable it in your device settings.');
                  return;
                }
                
                // Launch camera
                const result = await ImagePicker.launchCameraAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.8,
                  allowsEditing: true,
                  aspect: [4, 3]
                });
                
                if (!result.canceled && result.assets.length > 0) {
                  // Navigate to receipt splitter screen with the image
                  router.push({
                    pathname: '/receipt-splitter',
                    params: { imageUri: result.assets[0].uri }
                  });
                }
              } catch (error) {
                console.error('Camera or navigation error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                Alert.alert('Camera Error', 
                  `There was a problem with the camera: ${errorMessage}. Please try again.`);
              }
            }}
          >
            <LinearGradient
              colors={[Colors.light.tint, '#3DCD84', '#2EBB77']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.receiptButtonGradient}
            >
              <View style={styles.receiptButtonContent}>
                <Ionicons name="receipt-outline" size={18} color="#000" />
                <ThemedText style={styles.receiptButtonText}>Scan</ThemedText>
              </View>
            </LinearGradient>
          </Pressable>
          
          {/* Add Debt Button */}
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
            ${combinedTotalOwed.toFixed(2)}
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
        
        {/* Loading & Error States */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
            <ThemedText style={styles.loadingText}>Loading your debts...</ThemedText>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={40} color={Colors.light.tint} />
            <Text style={styles.errorText}>Error: {error}</Text>
          </View>
        ) : null}
        
        {/* When no debts are present, show educational content about receipt scanner */}
        {!loading && !error && groups.length === 0 && debts.length === 0 && (
          <View style={styles.fullEmptyState}>
            {/* Icon and title only - removed description */}
            <Ionicons name="cash-outline" size={50} color="rgba(255,255,255,0.3)" />
            <ThemedText type="subtitle" style={styles.fullEmptyStateTitle}>No debts yet</ThemedText>
            
            {/* Spacing */}
            <View style={{ height: 20 }} />
            
            {/* Add Debt Feature highlight */}
            <View style={styles.featureHighlight}>
              <View style={styles.featureHighlightHeader}>
                <Ionicons name="add-circle" size={24} color={Colors.light.tint} />
                <ThemedText style={styles.featureHighlightTitle}>Add Your First Debt</ThemedText>
              </View>
              <ThemedText style={styles.featureHighlightEntice}>Track What You're Owed</ThemedText>
              <ThemedText style={styles.featureHighlightText}>
                Easily keep track of money friends owe you with detailed records of who, when, and why.
              </ThemedText>
              <Pressable 
                style={({pressed}) => [
                  styles.featureHighlightButton,
                  {opacity: pressed ? 0.8 : 1}
                ]}
                onPress={() => router.push('/add-debt')}
              >
                <LinearGradient
                  colors={[Colors.light.tint, '#3DCD84', '#2EBB77']}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={styles.featureHighlightButtonGradient}
                >
                  <View style={styles.receiptButtonContent}>
                    <View style={styles.cameraIconContainer}>
                      <Ionicons name="add-circle" size={20} color="#000" />
                    </View>
                    <ThemedText style={styles.featureHighlightButtonText}>Add a Debt</ThemedText>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
            
            {/* Spacing between feature sections */}
            <View style={{ height: 16 }} />
            
            {/* Receipt Scanner Feature Highlight */}
            <View style={styles.featureHighlight}>
              <View style={styles.featureHighlightHeader}>
                <Ionicons name="receipt-outline" size={24} color={Colors.light.tint} />
                <ThemedText style={styles.featureHighlightTitle}>Receipt Scanner</ThemedText>
              </View>
              {/* Added enticing text */}
              <ThemedText style={styles.featureHighlightEntice}>Just Had Dinner?</ThemedText>
              <ThemedText style={styles.featureHighlightText}>
                Snap a photo of a receipt and automatically create debts with detailed item tracking.
              </ThemedText>
              <Pressable 
                style={({pressed}) => [
                  styles.featureHighlightButton,
                  {opacity: pressed ? 0.8 : 1}
                ]}
                onPress={async () => {
                  try {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status === 'granted') {
                      const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        quality: 0.8,
                        allowsEditing: true,
                        aspect: [4, 3]
                      });
                      
                      if (!result.canceled && result.assets.length > 0) {
                        router.push({
                          pathname: '/receipt-splitter',
                          params: { imageUri: result.assets[0].uri }
                        });
                      }
                    }
                  } catch (error) {
                    console.error('Camera error:', error);
                  }
                }}
              >
                <LinearGradient
                  colors={[Colors.light.tint, '#3DCD84', '#2EBB77']}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={styles.featureHighlightButtonGradient}
                >
                  {/* Fixed button layout with text to the right of the camera icon */}
                  <View style={styles.receiptButtonContent}>
                    <View style={styles.cameraIconContainer}>
                      <Ionicons name="camera" size={20} color="#000" />
                    </View>
                    <ThemedText style={styles.featureHighlightButtonText}>Scan a Receipt</ThemedText>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}
        
        {/* If not loading and has data to show */}
        {!loading && !error && (groups.length > 0 || debts.length > 0) && (
          <>
            {/* Group Debts Section */}
            {groups.length > 0 && (
              <View style={styles.debtsSection}>
                <View style={styles.debtListHeader}>
                  <ThemedText type="subtitle" style={styles.sectionTitle}>Debt Groups</ThemedText>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{groups.length}</Text>
                  </View>
                </View>
                <View style={styles.debtListContent}>
                  {renderGroupItems()}
                </View>
              </View>
            )}
            
            {/* Individual Debts Section */}
            <View style={styles.debtsSection}>
              <View style={styles.debtListHeader}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>Individual Debts</ThemedText>
                <View style={styles.headerButtons}>
                  <Pressable 
                    style={styles.refreshButton}
                    onPress={handleRefresh}
                  >
                    <Ionicons name="refresh" size={16} color={Colors.light.tint} />
                  </Pressable>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{debts.filter(debt => !debt.groupId).length}</Text>
                  </View>
                </View>
              </View>
              
              {debts.filter(debt => !debt.groupId).length === 0 ? (
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
                    No individual debts yet. Add your first debt to start tracking.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={debts.filter(debt => !debt.groupId)}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={renderDebtItem}
                  scrollEnabled={false}
                  contentContainerStyle={styles.debtList}
                  initialNumToRender={5}
                  maxToRenderPerBatch={10}
                  removeClippedSubviews={Platform.OS !== 'web'}
                  windowSize={5}
                />
              )}
            </View>
          </>
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
    marginBottom: 16,
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
    fontFamily: 'AeonikBlack-Regular',
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
    fontFamily: 'AeonikBlack-Regular',
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
    marginBottom: 12,
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
    fontFamily: 'AeonikBlack-Regular',
  },
  loadingSubText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
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
    fontFamily: 'AeonikBlack-Regular',
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
    paddingRight: 12,
  },
  debtorNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontFamily: 'AeonikBlack-Regular',
    paddingRight: 4,
  },
  debtFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debtDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontFamily: 'AeonikBlack-Regular',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: 'rgba(74, 226, 144, 0.1)',
    borderRadius: 4,
  },
  buttonsContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  markPaidButton: {
    backgroundColor: 'rgba(74, 226, 144, 0.15)',
  },
  remindButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  actionButtonText: {
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
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptButton: {
    width: 80,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
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
  receiptButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  receiptButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  receiptButtonText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
    marginLeft: 4,
  },
  debtsSection: {
    marginBottom: 24,
  },
  sectionCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
  },
  fullEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  fullEmptyStateTitle: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Aeonik-Black',
    marginBottom: 10,
  },
  fullEmptyStateText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
    textAlign: 'center',
    marginBottom: 0,
  },
  emptyStateButton: {
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
  emptyStateButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 30,
  },
  debtListContent: {
    paddingTop: 8,
  },
  countBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 226, 144, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
  },
  featureHighlight: {
    marginTop: 0,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(35,35,35,0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    width: '100%',
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
  featureHighlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureHighlightTitle: {
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    color: '#fff',
    marginLeft: 8,
  },
  featureHighlightText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 8,
    fontFamily: 'AeonikBlack-Regular',
  },
  featureHighlightButton: {
    borderRadius: 30,
    overflow: 'hidden',
    alignSelf: 'stretch',
    marginTop: 14,
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.tint,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  featureHighlightButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 30,
  },
  featureHighlightButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginLeft: 8,
  },
  featureHighlightEntice: {
    color: Colors.light.tint,
    fontSize: 18,
    marginBottom: 6,
    fontFamily: 'Aeonik-Black',
    marginTop: 0,
  },
  cameraIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  recurringBadge: {
    backgroundColor: 'rgba(74, 226, 144, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recurringText: {
    color: Colors.light.tint,
    fontSize: 10,
    fontFamily: 'Aeonik-Black',
    marginLeft: 4,
  },
  recurringDetailsContainer: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 226, 144, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74, 226, 144, 0.2)',
  },
  recurringDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recurringDetailText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'AeonikBlack-Regular',
    marginLeft: 4,
  },
  pressedDebtItem: {
    backgroundColor: 'rgba(74, 226, 144, 0.1)',
  },
});
