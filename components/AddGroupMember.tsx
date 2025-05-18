import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { Colors } from '@/constants/Colors';
import { GroupMember } from './GroupMemberItem';
import ContactsModal from './ContactsModal';

interface AddGroupMemberProps {
  onAdd: (member: Omit<GroupMember, 'id'>) => void;
  onCancel: () => void;
}

/**
 * Component for adding a new member to a group
 */
export default function AddGroupMember({ onAdd, onCancel }: AddGroupMemberProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [description, setDescription] = useState('');
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  
  const handleAdd = () => {
    if (!name.trim()) {
      return; // Name is required
    }
    
    onAdd({
      name: name.trim(),
      amount: amount || '0',
      phoneNumber: phoneNumber || undefined,
      description: description || undefined
    });
    
    // Reset form
    setName('');
    setAmount('');
    setPhoneNumber('');
    setDescription('');
  };
  
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
    
    setContactsModalVisible(false);
  };
  
  return (
    <View style={styles.container}>
      <ContactsModal
        visible={contactsModalVisible}
        onClose={() => setContactsModalVisible(false)}
        onSelectContact={handleSelectContact}
      />
      
      <View style={styles.header}>
        <Text style={styles.title}>Add Group Member</Text>
        <Pressable 
          style={({pressed}) => [styles.closeButton, pressed && {opacity: 0.7}]}
          onPress={onCancel}
        >
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>
      
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Name</Text>
            <View style={styles.nameInputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Enter name"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
              
              <Pressable
                style={({pressed}) => [styles.contactButton, pressed && {opacity: 0.7}]}
                onPress={() => setContactsModalVisible(true)}
              >
                <Ionicons name="people" size={18} color={Colors.light.tint} />
              </Pressable>
            </View>
            
            <Pressable
              style={({pressed}) => [styles.selectContactButton, pressed && {opacity: 0.7}]}
              onPress={() => setContactsModalVisible(true)}
            >
              <Ionicons name="person-add-outline" size={16} color={Colors.light.tint} style={styles.selectContactIcon} />
              <Text style={styles.selectContactText}>Select from Contacts</Text>
            </Pressable>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Amount</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                returnKeyType="next"
              />
            </View>
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Enter description"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
          
          <View style={styles.buttons}>
            <Pressable
              style={({pressed}) => [styles.cancelButton, pressed && {opacity: 0.7}]}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            
            <Pressable
              style={({pressed}) => [
                styles.addButton, 
                !name.trim() && styles.addButtonDisabled,
                pressed && {opacity: 0.7}
              ]}
              onPress={handleAdd}
              disabled={!name.trim()}
            >
              <Text style={styles.addButtonText}>Add Member</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#262626',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  form: {
    padding: 16,
    paddingBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  nameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#fff',
  },
  contactButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.1)',
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
    fontWeight: '500',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  currencySymbol: {
    fontSize: 16,
    color: '#fff',
    paddingLeft: 12,
  },
  amountInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#fff',
  },
  descriptionInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    minHeight: 80,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  addButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  addButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 