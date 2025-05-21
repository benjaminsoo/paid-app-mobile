import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Alert, Linking, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { getRecurringDebtById, markDebtAsPaid } from '@/firebase/firestore';
import { Debt, RecurringDebt, RecurringFrequency } from '@/firebase/models';
import eventEmitter from '@/utils/eventEmitter';

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

export default function DebtDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { currentUser, userProfile } = useAuth();
  
  const [debt, setDebt] = useState<Debt | null>(null);
  const [recurringInfo, setRecurringInfo] = useState<RecurringDebt | null>(null);
  
  // Parse debt from params on mount - use empty dependency array to only run once
  useEffect(() => {
    try {
      if (params.debt) {
        // Parse the debt object from JSON
        const debtObject = JSON.parse(params.debt as string) as Debt;
        setDebt(debtObject);
      }
    } catch (err) {
      console.error('Error parsing debt from params:', err);
      Alert.alert('Error', 'Unable to load debt details');
    }
  }, []); // Empty dependency array ensures this only runs once
  
  // Fetch recurring info if needed
  useEffect(() => {
    const fetchRecurringInfo = async () => {
      if (debt?.isRecurring && debt?.recurringId && currentUser) {
        try {
          const data = await getRecurringDebtById(currentUser.uid, debt.recurringId);
          if (data) {
            setRecurringInfo(data as RecurringDebt);
          }
        } catch (err) {
          console.error('Error fetching recurring info:', err);
        }
      }
    };
    
    fetchRecurringInfo();
  }, [debt, currentUser]);
  
  // Check if user has a valid payment link
  const hasValidPaymentLink = () => {
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
  };
  
  // Handle the remind button press
  const handleRemind = () => {
    if (!debt) return;
    
    // Create base SMS message text
    let message = `Hey, just a reminder that you owe me $${debt.amount.toFixed(2)}${debt.description ? ` for ${debt.description}` : ''}.`;
    
    // Add payment link if available
    if (userProfile?.username && hasValidPaymentLink()) {
      message += `\n\nPay here: trypaid.io/${userProfile.username}`;
    }
    
    // Encode the message for use in the URL
    const encodedMessage = encodeURIComponent(message);
    
    // If we have a phone number, use it to fill the recipient and the message
    if (debt.phoneNumber) {
      const phoneNumber = debt.phoneNumber.replace(/\D/g, ''); // Remove non-numeric characters
      
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
  };
  
  // Handle marking the debt as paid
  const handleMarkPaid = async () => {
    if (!debt || !currentUser || debt.isPaid) return;
    
    try {
      await markDebtAsPaid(currentUser.uid, debt.id!);
      
      // Update local state
      setDebt({
        ...debt,
        isPaid: true,
        paidAt: new Date().toISOString()
      });
      
      // Emit event to update home screen
      eventEmitter.emit('DEBT_UPDATED', {});
      
      Alert.alert('Success', 'Debt marked as paid');
    } catch (err) {
      console.error('Error marking debt as paid:', err);
      Alert.alert('Error', 'Failed to mark debt as paid');
    }
  };
  
  if (!debt) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={Colors.light.tint} />
          </Pressable>
          <ThemedText type="subtitle" style={styles.headerTitle}>Debt Detail</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ThemedText>Loading debt details...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <LinearGradient
        colors={['rgba(18,18,18,0.98)', 'rgba(28,28,28,0.95)']}
        style={styles.backgroundGradient}
      />
      
      <Stack.Screen
        options={{
          headerShown: false
        }}
      />
      
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={Colors.light.tint} />
        </Pressable>
        <ThemedText type="subtitle" style={styles.headerTitle}>Debt Detail</ThemedText>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <LinearGradient
          colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
          style={styles.mainCard}
        >
          {/* Debtor Name and Recurring Badge */}
          <View style={styles.debtorSection}>
            <Text style={styles.debtorName}>{debt.debtorName}</Text>
            {debt.isRecurring && (
              <View style={styles.recurringBadge}>
                <Ionicons name="refresh" size={14} color={Colors.light.tint} />
                <Text style={styles.recurringText}>
                  {recurringInfo?.frequency ? formatRecurringFrequency(recurringInfo.frequency) : 'Recurring'}
                </Text>
              </View>
            )}
          </View>
          
          {/* Amount */}
          <Text style={[styles.amount, debt.isPaid && styles.paidAmount]}>
            ${debt.amount.toFixed(2)}
          </Text>
          
          {/* Paid Status */}
          {debt.isPaid && (
            <View style={styles.paidStatusContainer}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.light.tint} />
              <Text style={styles.paidStatusText}>Paid on {new Date(debt.paidAt!).toLocaleDateString()}</Text>
            </View>
          )}
          
          {/* Description */}
          {debt.description && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Description</Text>
              <Text style={styles.infoValue}>{debt.description}</Text>
            </View>
          )}
          
          {/* Dates */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Created</Text>
            <Text style={styles.infoValue}>{new Date(debt.createdAt).toLocaleDateString()}</Text>
          </View>
          
          {/* Phone */}
          {debt.phoneNumber && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{debt.phoneNumber}</Text>
            </View>
          )}
          
          {/* Recurring Details */}
          {debt.isRecurring && recurringInfo && (
            <View style={styles.recurringDetailsContainer}>
              <Text style={styles.recurringDetailTitle}>Recurring Details</Text>
              
              <View style={styles.recurringDetailRow}>
                <Ionicons name="calendar-outline" size={18} color={Colors.light.tint} />
                <Text style={styles.recurringDetailText}>
                  Started: {new Date(recurringInfo.startDate).toLocaleDateString()}
                </Text>
              </View>
              
              {recurringInfo.endDate && (
                <View style={styles.recurringDetailRow}>
                  <Ionicons name="flag-outline" size={18} color={Colors.light.tint} />
                  <Text style={styles.recurringDetailText}>
                    Ends: {new Date(recurringInfo.endDate).toLocaleDateString()}
                  </Text>
                </View>
              )}
              
              <View style={styles.recurringDetailRow}>
                <Ionicons name="time-outline" size={18} color={Colors.light.tint} />
                <Text style={styles.recurringDetailText}>
                  Next charge: {new Date(recurringInfo.nextGenerationDate).toLocaleDateString()}
                </Text>
              </View>
              
              <View style={styles.recurringDetailRow}>
                <Ionicons name="repeat" size={18} color={Colors.light.tint} />
                <Text style={styles.recurringDetailText}>
                  Frequency: {formatRecurringFrequency(recurringInfo.frequency)}
                </Text>
              </View>
              
              {recurringInfo.generatedDebtIds && (
                <View style={styles.recurringDetailRow}>
                  <Ionicons name="layers-outline" size={18} color={Colors.light.tint} />
                  <Text style={styles.recurringDetailText}>
                    Generated instances: {recurringInfo.generatedDebtIds.length}
                  </Text>
                </View>
              )}
            </View>
          )}
        </LinearGradient>
        
        {/* Action Buttons */}
        {!debt.isPaid && (
          <View style={styles.buttonsContainer}>
            <Pressable 
              style={({pressed}) => [
                styles.actionButton,
                styles.remindButton,
                {opacity: pressed ? 0.8 : 1}
              ]}
              onPress={handleRemind}
            >
              <Ionicons name="chatbubble-outline" size={24} color={Colors.light.tint} />
              <Text style={styles.actionButtonText}>Remind</Text>
            </Pressable>
            
            <Pressable 
              style={({pressed}) => [
                styles.actionButton,
                styles.markPaidButton,
                {opacity: pressed ? 0.8 : 1}
              ]}
              onPress={handleMarkPaid}
            >
              <Ionicons name="checkmark-circle" size={24} color={Colors.light.tint} />
              <Text style={styles.actionButtonText}>Mark Paid</Text>
            </Pressable>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'Aeonik-Black',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 226, 144, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  mainCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 24,
    marginBottom: 24,
  },
  debtorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  debtorName: {
    fontSize: 24,
    color: '#fff',
    fontFamily: 'Aeonik-Black',
    marginRight: 12,
  },
  recurringBadge: {
    backgroundColor: 'rgba(74, 226, 144, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recurringText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
    marginLeft: 6,
  },
  amount: {
    fontSize: 42,
    color: Colors.light.tint,
    fontFamily: 'Aeonik-Black',
    marginBottom: 20,
  },
  paidAmount: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  paidStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(74, 226, 144, 0.1)',
    borderRadius: 12,
    marginBottom: 20,
  },
  paidStatusText: {
    color: Colors.light.tint,
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginLeft: 8,
  },
  infoSection: {
    marginBottom: 16,
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
    marginBottom: 4,
  },
  infoValue: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'AeonikBlack-Regular',
  },
  recurringDetailsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(74, 226, 144, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(74, 226, 144, 0.2)',
  },
  recurringDetailTitle: {
    color: Colors.light.tint,
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    marginBottom: 12,
  },
  recurringDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recurringDetailText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
    marginLeft: 10,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    minHeight: 60,
  },
  remindButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  markPaidButton: {
    backgroundColor: 'rgba(74, 226, 144, 0.15)',
  },
  actionButtonText: {
    color: Colors.light.tint,
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    marginLeft: 8,
  }
}); 