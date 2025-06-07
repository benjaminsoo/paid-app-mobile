import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ContactsModal from '@/components/ContactsModal';
import DebtModeSelector, { DebtMode } from '@/components/DebtModeSelector';
import GroupDebtForm from '@/components/GroupDebtForm';
import { GroupMember } from '@/components/GroupMemberItem';
import RecurringOptionsComponent from '@/components/RecurringOptionsComponent';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { addDebtToGroup, createDebt, createDebtGroup, updateDebt } from '@/firebase/firestore';
import { RecurringFrequency, RecurringOptions as RecurringOptionsType } from '@/firebase/models';
import { useColorScheme } from '@/hooks/useColorScheme';
import eventEmitter from '@/utils/eventEmitter';

export default function AddDebtScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { currentUser } = useAuth();
  const params = useLocalSearchParams();
  
  // Check if we're in edit mode
  const isEditMode = params.editMode === 'true';
  const editDebt = isEditMode && params.debt ? JSON.parse(params.debt as string) : null;
  
  // Use params if available (from receipt splitter or edit mode)
  const [name, setName] = useState(
    editDebt?.debtorName || 
    params.debtorName as string || 
    ''
  );
  const [amount, setAmount] = useState(
    editDebt?.amount?.toString() || 
    params.amount as string || 
    ''
  );
  const [description, setDescription] = useState(
    editDebt?.description || 
    params.description as string || 
    ''
  );
  const [phoneNumber, setPhoneNumber] = useState(editDebt?.phoneNumber || '');
  const [loading, setLoading] = useState(false);
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  
  // New state for debt mode (single or group)
  const [debtMode, setDebtMode] = useState<DebtMode>('single');
  
  // State for recurring options
  const [recurringOptions, setRecurringOptions] = useState<RecurringOptionsType>({
    isRecurring: editDebt?.isRecurring || false,
    frequency: (editDebt?.recurringFrequency as RecurringFrequency) || 'monthly',
    startDate: editDebt?.recurringStartDate ? new Date(editDebt.recurringStartDate) : new Date(),
    endDate: editDebt?.recurringEndDate ? new Date(editDebt.recurringEndDate) : null,
  });
  
  // Handle contact selection
  const handleSelectContact = (contact: Contacts.Contact) => {
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    if (fullName) {
      setName(fullName);
    }
    
    // Extract and store phone number if available
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      setPhoneNumber(contact.phoneNumbers[0].number || '');
    } else {
      setPhoneNumber(''); // Reset if no phone number
    }
  };
  
  const validateInputs = () => {
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter who owes you money.');
      return false;
    }
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return false;
    }
    
    return true;
  };
  
  const handleAddDebt = async () => {
    if (!validateInputs()) return;
    if (!currentUser) {
      Alert.alert('Authentication Error', 'You must be logged in to add debts.');
      return;
    }
    
    try {
      setLoading(true);
      
      // Create the basic debt data
      const debtData = {
        debtorName: name.trim(),
        amount: parseFloat(amount),
        description: description.trim(),
        phoneNumber: phoneNumber.trim(),
        isRecurring: recurringOptions.isRecurring,
      };
      
      // Add recurring fields if it's a recurring debt
      if (recurringOptions.isRecurring) {
        Object.assign(debtData, {
          recurringFrequency: recurringOptions.frequency,
          recurringStartDate: recurringOptions.startDate.toISOString(),
          recurringEndDate: recurringOptions.endDate ? recurringOptions.endDate.toISOString() : null,
          recurringDay: recurringOptions.frequency === 'weekly' || recurringOptions.frequency === 'biweekly'
            ? recurringOptions.dayOfWeek
            : recurringOptions.dayOfMonth
        });
      }
      
      console.log(isEditMode ? 'Updating debt with data:' : 'Creating debt with data:', debtData);
      
      let result;
      if (isEditMode && editDebt?.id) {
        // Update existing debt
        result = await updateDebt(currentUser.uid, editDebt.id, debtData);
        console.log('Successfully updated debt:', result);
      } else {
        // Create new debt
        result = await createDebt(currentUser.uid, debtData);
        console.log('Successfully created debt:', result);
      }
      
      // Emit an event that a debt was added/updated - this will trigger a refresh on the home screen
      eventEmitter.emit('DEBT_ADDED', result);
      
      const phoneNumberInfo = phoneNumber ? ` (Phone: ${phoneNumber})` : '';
      const recurringInfo = recurringOptions.isRecurring ? ` (${recurringOptions.frequency})` : '';
      
      Alert.alert(
        isEditMode ? 'Debt Updated' : 'Debt Added', 
        `Successfully ${isEditMode ? 'updated' : 'added'}${recurringInfo} debt of $${amount} from ${name}${phoneNumberInfo}.`,
        [{ 
          text: 'OK', 
          onPress: () => {
            console.log('Navigating back to home after debt', isEditMode ? 'update' : 'creation');
            router.back();
          }
        }]
      );
    } catch (error) {
      console.error(isEditMode ? 'Update debt error:' : 'Add debt error:', error);
      Alert.alert(
        isEditMode ? 'Error Updating Debt' : 'Error Adding Debt', 
        'There was a problem saving your debt. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };
  
  // Handle creating a group debt
  const handleCreateGroupDebt = async (
    groupName: string, 
    groupDescription: string, 
    members: Omit<GroupMember, 'id'>[],
    recurringOptions: RecurringOptionsType
  ) => {
    if (!currentUser) {
      Alert.alert('Authentication Error', 'You must be logged in to create group debts.');
      return;
    }
    
    if (members.length === 0) {
      Alert.alert('No Members', 'Please add at least one person to the group.');
      return;
    }
    
    try {
      setLoading(true);
      
      // First create the group with recurring options if needed
      const groupData: any = {
        name: groupName,
        description: groupDescription
      };
      
      // Add recurring options if enabled
      if (recurringOptions.isRecurring) {
        Object.assign(groupData, {
          isRecurring: true,
          frequency: recurringOptions.frequency,
          startDate: recurringOptions.startDate,
          endDate: recurringOptions.endDate,
          dayOfMonth: recurringOptions.frequency === 'monthly' || 
                     recurringOptions.frequency === 'quarterly' || 
                     recurringOptions.frequency === 'yearly' 
                     ? recurringOptions.dayOfMonth : null,
          dayOfWeek: recurringOptions.frequency === 'weekly' || 
                    recurringOptions.frequency === 'biweekly' 
                    ? recurringOptions.dayOfWeek : null
        });
      }
      
      const newGroup = await createDebtGroup(currentUser.uid, groupData) as { id: string };
      
      console.log('Successfully created group:', newGroup);
      
      // Then add each member as a debt to the group
      const promises = members.map(member => {
        return addDebtToGroup(
          currentUser.uid,
          newGroup.id as string,
          {
            debtorName: member.name,
            amount: parseFloat(member.amount) || 0,
            description: member.description || '',
            phoneNumber: member.phoneNumber || '',
          }
        );
      });
      
      await Promise.all(promises);
      
      // Emit event to update the home screen
      eventEmitter.emit('DEBT_ADDED', newGroup);
      
      const recurringText = recurringOptions.isRecurring ? 
        ` (${recurringOptions.frequency})` : '';
      
      Alert.alert(
        'Group Created', 
        `Successfully created${recurringText} "${groupName}" with ${members.length} debts.`,
        [{ 
          text: 'OK', 
          onPress: () => {
            console.log('Navigating back to home after group creation');
            router.back();
          }
        }]
      );
    } catch (error) {
      console.error('Create group debt error:', error);
      Alert.alert(
        'Error Creating Group', 
        'There was a problem creating your group. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Contacts Modal */}
      <ContactsModal
        visible={contactsModalVisible}
        onClose={() => setContactsModalVisible(false)}
        onSelectContact={handleSelectContact}
      />
      
      <LinearGradient
        colors={['rgba(18,18,18,0.98)', 'rgba(28,28,28,0.95)']}
        style={styles.backgroundGradient}
      />
      
      <View style={styles.header}>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.light.tint} />
        </Pressable>
        <ThemedText type="subtitle" style={styles.headerTitle}>
          {isEditMode ? 'Edit Debt' : 'Add Debt'}
        </ThemedText>
        <View style={{width: 24}} />
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.scrollContainer} 
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Debt Mode Selector */}
          <DebtModeSelector 
            selectedMode={debtMode}
            onSelectMode={setDebtMode}
          />
          
          {debtMode === 'single' ? (
            // Single Debt Form
          <LinearGradient
            colors={['rgba(35,35,35,0.98)', 'rgba(25,25,25,0.95)']}
            style={styles.formCard}
          >
            <View style={styles.formSection}>
              <View style={styles.labelContainer}>
                <Ionicons name="person-outline" size={18} color={Colors.light.tint} style={styles.labelIcon} />
                <ThemedText style={styles.label}>Who owes you?</ThemedText>
              </View>
                
                <View style={styles.nameInputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                selectionColor={Colors.light.tint}
              />
                  
                  <Pressable
                    style={({pressed}) => [
                      styles.contactButton,
                      {opacity: pressed ? 0.8 : 1}
                    ]}
                    onPress={() => setContactsModalVisible(true)}
                  >
                    <LinearGradient
                      colors={['rgba(74, 226, 144, 0.2)', 'rgba(74, 226, 144, 0.1)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.contactButtonGradient}
                    >
                      <Ionicons name="people" size={18} color={Colors.light.tint} />
                    </LinearGradient>
                  </Pressable>
                </View>
                
                <Pressable
                  style={({pressed}) => [
                    styles.selectContactButton,
                    {opacity: pressed ? 0.8 : 1}
                  ]}
                  onPress={() => setContactsModalVisible(true)}
                >
                  <Ionicons name="person-add-outline" size={16} color={Colors.light.tint} style={styles.selectContactIcon} />
                  <ThemedText style={styles.selectContactText}>Select from Contacts</ThemedText>
                </Pressable>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.formSection}>
              <View style={styles.labelContainer}>
                <Ionicons name="cash-outline" size={18} color={Colors.light.tint} style={styles.labelIcon} />
                <ThemedText style={styles.label}>How much?</ThemedText>
              </View>
              <View style={styles.amountContainer}>
                <ThemedText style={styles.currencySymbol}>$</ThemedText>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                  selectionColor={Colors.light.tint}
                />
              </View>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.formSection}>
              <View style={styles.labelContainer}>
                <Ionicons name="document-text-outline" size={18} color={Colors.light.tint} style={styles.labelIcon} />
                <ThemedText style={styles.label}>What's it for? <ThemedText style={styles.optional}>(Optional)</ThemedText></ThemedText>
              </View>
              <TextInput
                style={styles.textArea}
                placeholder="e.g., Dinner, Movie tickets, etc."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
                selectionColor={Colors.light.tint}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.formSection}>
              <RecurringOptionsComponent 
                options={recurringOptions}
                onChange={setRecurringOptions}
              />
            </View>
          </LinearGradient>
          ) : (
            // Group Debt Form
            <GroupDebtForm 
              onCreateGroup={handleCreateGroupDebt}
              isLoading={loading}
            />
          )}
          
          {/* Only show the Save button for single debt mode */}
          {debtMode === 'single' && (
          <Pressable 
            style={({pressed}) => [
              styles.addButton,
              {opacity: (pressed || loading) ? 0.8 : 1}
            ]}
            onPress={handleAddDebt}
            disabled={loading}
          >
            <LinearGradient
              colors={[Colors.light.tint, '#3DCD84', '#2EBB77']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <View style={styles.buttonContent}>
                {loading ? (
                  <ActivityIndicator color="#000" size="small" style={styles.buttonIcon} />
                ) : (
                  <Ionicons name="checkmark-circle" size={18} color="#000" style={styles.buttonIcon} />
                )}
                <ThemedText style={styles.addButtonText}>
                  {loading ? 'Saving...' : (isEditMode ? 'Update Debt' : 'Save Debt')}
                </ThemedText>
              </View>
            </LinearGradient>
          </Pressable>
          )}
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
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 80,
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
  optional: {
    fontFamily: 'AeonikBlack-Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 'normal',
  },
  nameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontFamily: 'AeonikBlack-Regular',
  },
  contactButton: {
    width: 48,
    height: 48,
    marginLeft: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  contactButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 226, 144, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74, 226, 144, 0.15)',
  },
  selectContactIcon: {
    marginRight: 8,
  },
  selectContactText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
  },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontFamily: 'AeonikBlack-Regular',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  currencySymbol: {
    fontSize: 24,
    fontFamily: 'Aeonik-Black',
    marginRight: 8,
    color: '#fff',
  },
  amountInput: {
    flex: 1,
    padding: 16,
    fontSize: 24,
    color: '#fff',
    fontFamily: 'AeonikBlack-Regular',
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
  addButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
}); 