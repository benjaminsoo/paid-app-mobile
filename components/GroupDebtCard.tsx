import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Debt, DebtGroup } from '@/firebase/models';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    LayoutAnimation,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    UIManager,
    View
} from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface GroupDebtCardProps {
  group: DebtGroup & { debts?: Debt[] };
  onMarkPaid: (debtId: string, isPaid: boolean) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
}

/**
 * Card component for displaying a debt group on the home screen
 */
export default function GroupDebtCard({ group, onMarkPaid, onDelete }: GroupDebtCardProps) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const { userProfile } = useAuth();
  
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
  
  // Calculate completion percentage
  const completionPercentage = group.totalAmount > 0 
    ? Math.min(100, Math.round((group.paidAmount / group.totalAmount) * 100))
    : 0;
  
  // Format currency amounts
  const formatCurrency = (amount: number) => {
    return amount.toFixed(2);
  };
  
  // Handle toggling expanded state
  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };
  
  // Navigate to group detail screen
  const navigateToDetail = () => {
    router.push({
      pathname: '/group-detail',
      params: { groupId: group.id }
    });
  };
  
  // Handle marking a debt as paid/unpaid
  const handleTogglePaid = async (debtId: string, currentIsPaid: boolean) => {
    await onMarkPaid(debtId, currentIsPaid);
  };
  
  // Handle sending a reminder message
  const handleRemind = (debt: Debt) => {
    // Create base SMS message text
    let message = `Hey, just a reminder that you owe me $${debt.amount.toFixed(2)}${debt.description ? ` for ${debt.description}` : ''}.`;
    
    // Add group context
    message += `\n(Part of ${group.name} group)`;
    
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
  
  // Handle deleting the group
  const handleDelete = async () => {
    await onDelete(group.id!);
  };
  
  return (
    <View style={styles.container}>
      {/* Group Header - Always visible */}
      <Pressable
        style={({ pressed }) => [
          styles.header,
          pressed && styles.headerPressed
        ]}
        onPress={toggleExpanded}
      >
        <View style={styles.titleSection}>
          <Ionicons name="layers-outline" size={20} color={Colors.light.tint} />
          <Text style={styles.title} numberOfLines={1}>
            {group.name}
          </Text>
          {group.isCompleted && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>PAID</Text>
            </View>
          )}
          {group.isRecurring && (
            <View style={styles.recurringBadge}>
              <Ionicons name="refresh" size={10} color={Colors.light.tint} />
              <Text style={styles.recurringText}>Recurring</Text>
            </View>
          )}
        </View>
        
        <View style={styles.amountSection}>
          <Text style={styles.amount}>${formatCurrency(group.totalAmount)}</Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="rgba(255,255,255,0.7)"
          />
        </View>
      </Pressable>
      
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
      
      {/* Expanded Content - Visible when expanded */}
      {expanded && (
        <View style={styles.expandedContent}>
          {/* Group Description */}
          {group.description && (
            <Text style={styles.description}>{group.description}</Text>
          )}
          
          {/* Debts List */}
          {group.debts && group.debts.length > 0 ? (
            <View style={styles.debtsList}>
              <Text style={styles.debtsListTitle}>Debts in this group:</Text>
              
              {group.debts.map(debt => (
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
                    <View style={styles.debtButtons}>
                      <Pressable 
                        style={({pressed}) => [
                          styles.debtButton,
                          styles.remindButton,
                          {opacity: pressed ? 0.8 : 1}
                        ]}
                        onPress={() => handleRemind(debt)}
                      >
                        <Ionicons name="chatbubble-outline" size={16} color={Colors.light.tint} />
                        <Text style={styles.debtButtonText}>Remind</Text>
                      </Pressable>
                      
                      <Pressable 
                        style={({pressed}) => [
                          styles.debtButton,
                          styles.markPaidButton,
                          {opacity: pressed ? 0.8 : 1}
                        ]}
                        onPress={() => handleTogglePaid(debt.id!, debt.isPaid)}
                      >
                        <Ionicons name="checkmark-circle" size={16} color={Colors.light.tint} />
                        <Text style={styles.debtButtonText}>Mark Paid</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noDebtsText}>No debts in this group</Text>
          )}
          
          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && { opacity: 0.8 }
              ]}
              onPress={navigateToDetail}
            >
              <Ionicons name="open-outline" size={16} color="#fff" />
              <Text style={styles.actionButtonText}>View Details</Text>
            </Pressable>
            
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.deleteButton,
                pressed && { opacity: 0.8 }
              ]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={16} color="#FF5A5A" />
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(50,50,50,0.5)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginLeft: 12,
    flex: 1,
    marginRight: 8,
  },
  completedBadge: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    marginRight: 12,
  },
  completedText: {
    color: '#000',
    fontSize: 10,
    fontFamily: 'Aeonik-Black',
  },
  amountSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  amount: {
    color: Colors.light.tint,
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginRight: 8,
  },
  progressContainer: {
    padding: 16,
    paddingTop: 0,
  },
  progressBackground: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.light.tint,
    borderRadius: 3,
  },
  progressText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'AeonikBlack-Regular',
    marginTop: 4,
    textAlign: 'right',
  },
  expandedContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
    marginBottom: 16,
  },
  debtsList: {
    marginBottom: 16,
  },
  debtsListTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
    marginBottom: 8,
  },
  debtItem: {
    backgroundColor: 'rgba(40,40,40,0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    paddingRight: 12,
  },
  debtorName: {
    color: '#fff',
    fontSize: 16,
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
    alignSelf: 'flex-start',
  },
  paidDebtAmount: {
    color: Colors.light.tint,
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
    opacity: 0.7,
  },
  debtButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  debtButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  remindButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  markPaidButton: {
    backgroundColor: 'rgba(74, 226, 144, 0.15)',
  },
  debtButtonText: {
    color: Colors.light.tint,
    fontSize: 12,
    fontFamily: 'Aeonik-Black',
    marginLeft: 6,
  },
  noDebtsText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 90, 90, 0.1)',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
    marginLeft: 6,
  },
  deleteButtonText: {
    color: '#FF5A5A',
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
  }
}); 