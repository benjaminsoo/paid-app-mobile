import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  FlatList, 
  Pressable, 
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  ScrollView
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';

interface ContactsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectContact: (contact: Contacts.Contact) => void;
  multipleSelect?: boolean;
  onSelectMultipleContacts?: (contacts: Contacts.Contact[]) => void;
}

export default function ContactsModal({ 
  visible, 
  onClose, 
  onSelectContact, 
  multipleSelect = false,
  onSelectMultipleContacts
}: ContactsModalProps) {
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contacts.Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Contacts.Contact[]>([]);

  useEffect(() => {
    if (visible) {
      loadContacts();
      setSelectedContacts([]);
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = contacts.filter(contact => {
        const name = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
        return name.includes(query);
      });
      setFilteredContacts(filtered);
    }
  }, [searchQuery, contacts]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access contacts was denied');
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.PhoneNumbers,
        ],
        sort: Contacts.SortTypes.FirstName
      });

      if (data.length > 0) {
        const validContacts = data.filter(
          contact => contact.firstName || contact.lastName
        );
        setContacts(validContacts);
        setFilteredContacts(validContacts);
      }
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = (contact: Contacts.Contact) => {
    if (multipleSelect) {
      const isSelected = selectedContacts.some(
        selected => selected.id === contact.id
      );
      
      if (isSelected) {
        setSelectedContacts(
          selectedContacts.filter(selected => selected.id !== contact.id)
        );
      } else {
        setSelectedContacts([...selectedContacts, contact]);
      }
    } else {
      onSelectContact(contact);
      onClose();
    }
  };
  
  const handleAddSelectedContacts = () => {
    if (selectedContacts.length === 0) {
      Alert.alert('No Contacts Selected', 'Please select at least one contact.');
      return;
    }
    
    // Create a copy to avoid state mutation issues
    const contactsToAdd = [...selectedContacts];
    
    if (onSelectMultipleContacts) {
      // Clear selection state before executing callback to prevent UI freezing
      setSelectedContacts([]);
      
      // Use setTimeout to allow UI to update before heavy processing
      setTimeout(() => {
        onSelectMultipleContacts(contactsToAdd);
      }, 100);
    } else {
      onSelectContact(selectedContacts[0]);
    }
    
    onClose();
  };
  
  const isContactSelected = (contact: Contacts.Contact): boolean => {
    return selectedContacts.some(selected => selected.id === contact.id);
  };

  const getContactInitial = (contact: Contacts.Contact) => {
    if (contact.firstName && contact.firstName.length > 0) {
      return contact.firstName[0].toUpperCase();
    } else if (contact.lastName && contact.lastName.length > 0) {
      return contact.lastName[0].toUpperCase();
    }
    return '?';
  };

  const getFullName = (contact: Contacts.Contact) => {
    return `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
  };

  const renderContactItem = ({ item }: { item: Contacts.Contact }) => {
    const fullName = getFullName(item);
    const isSelected = isContactSelected(item);
    
    return (
      <Pressable
        style={({ pressed }) => [
          styles.contactItem,
          pressed && styles.contactItemPressed,
          isSelected && styles.contactItemSelected
        ]}
        onPress={() => handleSelectContact(item)}
      >
        {multipleSelect && (
          <View style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected
          ]}>
            {isSelected && <Ionicons name="checkmark" size={16} color="#000" />}
          </View>
        )}
        
        <View style={styles.contactInitialContainer}>
          <Text style={styles.contactInitial}>{getContactInitial(item)}</Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{fullName}</Text>
          {item.phoneNumbers && item.phoneNumbers.length > 0 && (
            <Text style={styles.contactPhone}>
              {item.phoneNumbers[0].number}
            </Text>
          )}
        </View>
        
        {!multipleSelect && (
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
        )}
      </Pressable>
    );
  };
  
  const renderSelectedContactsSection = () => {
    if (!multipleSelect || selectedContacts.length === 0) return null;
    
    return (
      <View style={styles.selectedContactsContainer}>
        <View style={styles.selectedCountRow}>
          <Text style={styles.selectedCountText}>
            {selectedContacts.length} {selectedContacts.length === 1 ? 'contact' : 'contacts'} selected
          </Text>
          {selectedContacts.length > 0 && (
            <Pressable onPress={() => setSelectedContacts([])}>
              <Text style={styles.clearSelectionText}>Clear</Text>
            </Pressable>
          )}
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectedContactsScroll}
        >
          {selectedContacts.map(contact => (
            <Pressable 
              key={contact.id} 
              style={styles.selectedContactChip}
              onPress={() => handleSelectContact(contact)}
            >
              <Text style={styles.selectedContactName}>{getFullName(contact)}</Text>
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.7)" />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <LinearGradient
          colors={['rgba(18,18,18,0.98)', 'rgba(28,28,28,0.95)']}
          style={styles.modalOverlay}
        />
        <View style={styles.modalView}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {multipleSelect ? 'Select Contacts' : 'Select Contact'}
            </Text>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.5)" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              selectionColor={Colors.light.tint}
            />
            {searchQuery.length > 0 && (
              <Pressable
                style={styles.clearSearch}
                onPress={() => setSearchQuery('')}
              >
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
              </Pressable>
            )}
          </View>
          
          {renderSelectedContactsSection()}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.tint} />
              <Text style={styles.loadingText}>Loading contacts...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={40} color={Colors.light.tint} />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                style={styles.retryButton}
                onPress={loadContacts}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </View>
          ) : filteredContacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people" size={40} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>
                {searchQuery.length > 0
                  ? "No contacts match your search"
                  : "No contacts found"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              renderItem={renderContactItem}
              keyExtractor={(item) => String(item.id || `contact-${Date.now()}-${Math.random()}`)}
              contentContainerStyle={styles.contactsList}
              showsVerticalScrollIndicator={true}
              initialNumToRender={20}
            />
          )}
          
          {multipleSelect && (
            <View style={styles.addButtonContainer}>
              <Pressable
                style={[
                  styles.addButton,
                  selectedContacts.length === 0 && styles.addButtonDisabled
                ]}
                onPress={handleAddSelectedContacts}
                disabled={selectedContacts.length === 0}
              >
                <Text style={styles.addButtonText}>
                  Add {selectedContacts.length > 0 ? `${selectedContacts.length} ` : ''}
                  {selectedContacts.length === 1 ? 'Contact' : 'Contacts'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalView: {
    width: '100%',
    height: '90%',
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
  },
  clearSearch: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 24,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'AeonikBlack-Regular',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: Colors.light.tint,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'AeonikBlack-Regular',
  },
  contactsList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  contactItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  contactItemSelected: {
    backgroundColor: 'rgba(74, 226, 144, 0.15)',
    borderColor: 'rgba(74, 226, 144, 0.3)',
  },
  contactInitialContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInitial: {
    color: '#000',
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginBottom: 4,
  },
  contactPhone: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  selectedContactsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  selectedCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  selectedCountText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
  },
  clearSelectionText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
  },
  selectedContactsScroll: {
    paddingVertical: 8,
    flexDirection: 'row',
  },
  selectedContactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 226, 144, 0.15)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 226, 144, 0.3)',
  },
  selectedContactName: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'AeonikBlack-Regular',
    marginRight: 4,
  },
  addButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  addButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: 'rgba(74, 226, 144, 0.3)',
  },
  addButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
}); 