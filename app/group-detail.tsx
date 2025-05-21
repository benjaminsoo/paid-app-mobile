import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { getDebtGroupWithDebts, markDebtAsPaid, deleteDebtGroup } from '@/firebase/firestore';
import { DebtGroup, Debt } from '@/firebase/models';
import eventEmitter from '@/utils/eventEmitter';

// Add a formatter function near the top of the component
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

// Add a formatter function to get the day of week name
const getDayOfWeekName = (dayNumber: number) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber] || '';
};

// Add a formatter function to get the ordinal suffix for day of month
const getOrdinalSuffix = (day: number) => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

export default function GroupDetailScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams();
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<(DebtGroup & { debts: Debt[] }) | null>(null);
  const [error, setError] = useState('');
  
  useEffect(() => {
    if (!currentUser || !groupId) return;
    
    const fetchGroupDetail = async () => {
      try {
        setLoading(true);
        const groupDetail = await getDebtGroupWithDebts(currentUser.uid, groupId as string);
        setGroup(groupDetail as (DebtGroup & { debts: Debt[] }));
      } catch (err) {
        console.error('Error fetching group details:', err);
        setError('Failed to load group details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchGroupDetail();
  }, [currentUser, groupId]);
  
  const handleTogglePaid = async (debtId: string, isPaid: boolean) => {
    if (!currentUser || !groupId) return;
    
    try {
      await markDebtAsPaid(currentUser.uid, debtId, !isPaid);
      
      // Update the local state
      setGroup(prev => {
        if (!prev) return null;
        
        const updatedDebts = prev.debts.map(debt => 
          debt.id === debtId ? { ...debt, isPaid: !isPaid } : debt
        );
        
        // Recalculate paid amount
        const paidAmount = updatedDebts.reduce((sum, debt) => 
          debt.isPaid ? sum + debt.amount : sum, 0
        );
        
        // Check if all debts are paid
        const isCompleted = updatedDebts.every(debt => debt.isPaid);
        
        return {
          ...prev,
          debts: updatedDebts,
          paidAmount,
          isCompleted
        };
      });
      
      // Emit event to update home screen
      eventEmitter.emit('DEBT_UPDATED', {});
    } catch (err) {
      console.error('Error updating debt payment status:', err);
      Alert.alert('Error', 'Failed to update payment status');
    }
  };
  
  // Handle sending a reminder message for a debt
  const handleRemind = (debt: Debt) => {
    if (!group) return;
    
    // Create base SMS message text
    let message = `Hey, just a reminder that you owe me $${debt.amount.toFixed(2)}${debt.description ? ` for ${debt.description}` : ''}.`;
    
    // Add group context
    message += `\n(Part of ${group.name} group)`;
    
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
  
  const handleDeleteGroup = async () => {
    if (!currentUser || !groupId) return;
    
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? You can choose to keep or delete the individual debts.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Keep Debts', 
          onPress: async () => {
            try {
              await deleteDebtGroup(currentUser.uid, groupId as string, true);
              eventEmitter.emit('DEBT_UPDATED', {});
              router.back();
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
              await deleteDebtGroup(currentUser.uid, groupId as string, false);
              eventEmitter.emit('DEBT_UPDATED', {});
              router.back();
            } catch (err) {
              console.error('Error deleting group and debts:', err);
              Alert.alert('Error', 'Failed to delete group and debts');
            }
          }
        }
      ]
    );
  };
  
  // Calculate completion percentage
  const completionPercentage = group && group.totalAmount > 0 
    ? Math.min(100, Math.round((group.paidAmount / group.totalAmount) * 100))
    : 0;
  
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
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.light.tint} />
        </Pressable>
        <ThemedText type="subtitle" style={styles.headerTitle}>Group Detail</ThemedText>
        <Pressable 
          style={styles.deleteButton}
          onPress={handleDeleteGroup}
        >
          <Ionicons name="trash-outline" size={20} color="#FF5A5A" />
        </Pressable>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <ThemedText style={styles.loadingText}>Loading group details...</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#FF5A5A" />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <ThemedText style={styles.retryButtonText}>Go Back</ThemedText>
          </Pressable>
        </View>
      ) : group ? (
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Group Header Card */}
          <LinearGradient
            colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
            style={styles.groupCard}
          >
            <View style={styles.groupHeader}>
              <View style={styles.titleContainer}>
                <Ionicons name="layers-outline" size={24} color={Colors.light.tint} style={styles.titleIcon} />
                <Text style={styles.groupName}>{group.name}</Text>
              </View>
              
              {group.isCompleted && (
                <View style={styles.completedBadge}>
                  <Text style={styles.completedText}>PAID</Text>
                </View>
              )}
            </View>
            
            {group.description && (
              <Text style={styles.description}>{group.description}</Text>
            )}
            
            <View style={styles.amountContainer}>
              <View>
                <Text style={styles.amountLabel}>Total</Text>
                <Text style={styles.amount}>${group.totalAmount.toFixed(2)}</Text>
              </View>
              
              <View>
                <Text style={styles.amountLabel}>Paid</Text>
                <Text style={styles.paidAmount}>${group.paidAmount.toFixed(2)}</Text>
              </View>
            </View>
            
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${completionPercentage}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{completionPercentage}% paid</Text>
            </View>
          </LinearGradient>
          
          {/* Recurring Information Section */}
          {group.isRecurring && (
            <LinearGradient
              colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
              style={styles.recurringCard}
            >
              <View style={styles.recurringHeader}>
                <Ionicons name="repeat" size={20} color={Colors.light.tint} style={styles.recurringIcon} />
                <Text style={styles.recurringTitle}>Recurring Group</Text>
              </View>
              
              <View style={styles.recurringInfoContainer}>
                <View style={styles.recurringInfoRow}>
                  <Text style={styles.recurringInfoLabel}>Frequency:</Text>
                  <Text style={styles.recurringInfoValue}>
                    {group.frequency === 'daily' ? 'Daily' :
                     group.frequency === 'weekly' ? 'Weekly' :
                     group.frequency === 'biweekly' ? 'Every 2 Weeks' :
                     group.frequency === 'monthly' ? 'Monthly' :
                     group.frequency === 'quarterly' ? 'Quarterly' :
                     group.frequency === 'yearly' ? 'Yearly' : 'Unknown'}
                  </Text>
                </View>
                
                {group.startDate && (
                  <View style={styles.recurringInfoRow}>
                    <Text style={styles.recurringInfoLabel}>Started:</Text>
                    <Text style={styles.recurringInfoValue}>{formatDate(group.startDate)}</Text>
                  </View>
                )}
                
                {group.endDate && (
                  <View style={styles.recurringInfoRow}>
                    <Text style={styles.recurringInfoLabel}>Ends:</Text>
                    <Text style={styles.recurringInfoValue}>{formatDate(group.endDate)}</Text>
                  </View>
                )}
                
                {group.nextGenerationDate && (
                  <View style={[styles.recurringInfoRow, styles.lastInfoRow]}>
                    <Text style={styles.recurringInfoLabel}>Next Due:</Text>
                    <Text style={styles.recurringInfoValue}>{formatDate(group.nextGenerationDate)}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
          )}
          
          {/* Debts List */}
          <View style={styles.debtsContainer}>
            <View style={styles.debtsSectionHeader}>
              <Text style={styles.debtsTitle}>Debts in This Group</Text>
              <Text style={styles.debtsCount}>({group.debts.length})</Text>
            </View>
            
            {group.debts.length > 0 ? (
              group.debts.map(debt => (
                <View key={debt.id} style={styles.debtItem}>
                  <View style={styles.debtInfo}>
                    <View style={styles.debtorInfo}>
                      <Text style={styles.debtorName}>{debt.debtorName}</Text>
                      {debt.description ? (
                        <Text style={styles.debtDescription}>{debt.description}</Text>
                      ) : null}
                      <Text style={styles.debtDate}>
                        {debt.isPaid 
                          ? `Paid on ${new Date(debt.paidAt!).toLocaleDateString()}` 
                          : `Added on ${new Date(debt.createdAt).toLocaleDateString()}`}
                      </Text>
                    </View>
                    <Text style={[
                      styles.debtAmount,
                      debt.isPaid && styles.paidDebtAmount
                    ]}>
                      ${debt.amount.toFixed(2)}
                    </Text>
                  </View>
                  
                  {!debt.isPaid && (
                    <View style={styles.buttonsContainer}>
                      <Pressable 
                        style={({pressed}) => [
                          styles.actionButton,
                          styles.remindButton,
                          {opacity: pressed ? 0.8 : 1}
                        ]}
                        onPress={() => handleRemind(debt)}
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
                        onPress={() => handleTogglePaid(debt.id!, debt.isPaid)}
                      >
                        <Ionicons name="checkmark-circle" size={16} color={Colors.light.tint} />
                        <Text style={styles.actionButtonText}>Mark Paid</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            ) : (
              <Text style={styles.noDebtsText}>No debts in this group</Text>
            )}
          </View>
        </ScrollView>
      ) : null}
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
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 90, 90, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    color: Colors.light.tint,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 80,
  },
  groupCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleIcon: {
    marginRight: 12,
  },
  groupName: {
    fontSize: 22,
    color: '#fff',
    fontFamily: 'Aeonik-Black',
    flex: 1,
  },
  completedBadge: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  completedText: {
    fontSize: 12,
    color: '#000',
    fontFamily: 'Aeonik-Black',
  },
  description: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'AeonikBlack-Regular',
    marginBottom: 16,
  },
  amountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  amountLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'AeonikBlack-Regular',
    marginBottom: 4,
  },
  amount: {
    fontSize: 24,
    color: '#fff',
    fontFamily: 'Aeonik-Black',
  },
  paidAmount: {
    fontSize: 24,
    color: Colors.light.tint,
    fontFamily: 'Aeonik-Black',
  },
  progressContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  progressBackground: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.light.tint,
    borderRadius: 4,
  },
  progressText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'AeonikBlack-Regular',
    marginTop: 4,
    textAlign: 'right',
  },
  debtsContainer: {
    backgroundColor: 'rgba(35,35,35,0.95)',
    borderRadius: 20,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  debtsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  debtsTitle: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'Aeonik-Black',
  },
  debtsCount: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'AeonikBlack-Regular',
    marginLeft: 8,
  },
  debtItem: {
    backgroundColor: 'rgba(50,50,50,0.5)',
    borderRadius: 12,
    margin: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  debtInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  debtorInfo: {
    flex: 1,
    marginRight: 12,
  },
  debtorName: {
    fontSize: 16,
    color: '#fff',
    fontFamily: 'Aeonik-Black',
    marginBottom: 4,
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
  debtAmount: {
    color: Colors.light.tint,
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
  },
  paidDebtAmount: {
    color: Colors.light.tint,
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
    opacity: 0.8,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
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
    marginLeft: 6,
  },
  noDebtsText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'AeonikBlack-Regular',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  recurringCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(74, 226, 144, 0.2)',
    padding: 20,
    marginBottom: 24,
    backgroundColor: 'rgba(74, 226, 144, 0.05)',
  },
  recurringHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recurringIcon: {
    marginRight: 8,
  },
  recurringTitle: {
    fontSize: 18,
    color: Colors.light.tint,
    fontFamily: 'Aeonik-Black',
  },
  recurringInfoContainer: {
    backgroundColor: 'rgba(30,30,30,0.6)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(74, 226, 144, 0.1)',
  },
  recurringInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  recurringInfoLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'AeonikBlack-Regular',
  },
  recurringInfoValue: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'Aeonik-Black',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  lastInfoRow: {
    borderBottomWidth: 0,
  },
}); 