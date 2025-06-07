import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ContactsModal from '@/components/ContactsModal';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { addDebtToGroup, createDebt, createDebtGroup } from '@/firebase/firestore';
import eventEmitter from '@/utils/eventEmitter';
import { ReceiptItem as GroqReceiptItem, processReceiptImage } from '../services/groqService';

interface Person {
  id: string;
  name: string;
  phoneNumber?: string; // Added phone number field
}

interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  split: boolean;
  quantity: number;
  assignedTo: string | null; // Main assignee (for backwards compatibility)
  splitBetween: string[]; // Array of person IDs for split items
}

export default function ReceiptSplitterScreen() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const imageUri = params.imageUri as string;
  
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  
  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState<number | null>(null);
  const [tip, setTip] = useState<number | null>(null);
  const [extraFees, setExtraFees] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  
  // Raw input values for better editing experience
  const [subtotalInput, setSubtotalInput] = useState('0');
  const [taxInput, setTaxInput] = useState('');
  const [tipInput, setTipInput] = useState('');
  const [extraFeesInput, setExtraFeesInput] = useState('');
  
  const [description, setDescription] = useState('Receipt Split');
  const [storeName, setStoreName] = useState('');
  
  // People state for assignments
  const [people, setPeople] = useState<Person[]>([
    { id: '1', name: 'You' } // Default person is the user
  ]);
  const [newPersonName, setNewPersonName] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  
  // Contacts modal state
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  
  // Calculate totals per person
  const [personTotals, setPersonTotals] = useState<{[key: string]: number}>({});
  
  // Calculate the totals based on the receipt items and assignments
  useEffect(() => {
    const selectedItems = receiptItems.filter(item => item.split);
    const calculatedSubtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setSubtotal(calculatedSubtotal);
    
    // Calculate total based on what's available
    let calculatedTotal = calculatedSubtotal;
    
    // Add tax if available
    if (tax !== null) {
      calculatedTotal += tax;
    }
    
    // Add tip if available
    if (tip !== null) {
      calculatedTotal += tip;
    }
    
    // Add extra fees if available
    if (extraFees !== null) {
      calculatedTotal += extraFees;
    }
    
    setTotal(calculatedTotal);
    
    // Calculate totals per person
    const personAmounts: {[key: string]: number} = {};
    
    // Initialize with 0 for all people
    people.forEach(person => {
      personAmounts[person.id] = 0;
    });
    
    // Sum up items assigned to each person, handling both single assignee and split items
    selectedItems.forEach(item => {
      if (item.splitBetween && item.splitBetween.length > 0) {
        // Item is split between multiple people
        const splitAmount = (item.price * item.quantity) / item.splitBetween.length;
        item.splitBetween.forEach(personId => {
          personAmounts[personId] = (personAmounts[personId] || 0) + splitAmount;
        });
      } else if (item.assignedTo) {
        // Item is assigned to a single person (old-style assignment)
        personAmounts[item.assignedTo] = (personAmounts[item.assignedTo] || 0) + 
          (item.price * item.quantity);
      }
    });
    
    // Count people with assigned items (including 'You')
    const peopleWithItems = people.filter(p => personAmounts[p.id] > 0).length;
    
    // Add portion of tax proportionally based on items
    if (calculatedSubtotal > 0) {
      // Calculate total percentage of subtotal for each person
      const personPercentages: {[key: string]: number} = {};
      
      people.forEach(person => {
        personPercentages[person.id] = personAmounts[person.id] / calculatedSubtotal;
      });
      
      // Add tax and extra fees proportionally based on items
      people.forEach(person => {
        const percentage = personPercentages[person.id];
        
        if (tax !== null) {
          personAmounts[person.id] += tax * percentage;
        }
        
        if (extraFees !== null) {
          personAmounts[person.id] += extraFees * percentage;
        }
      });
      
      // Add tip equally among ALL people who have items assigned (including 'You')
      if (tip !== null && tip > 0 && peopleWithItems > 0) {
        const equalTipShare = tip / peopleWithItems;
        
        people.forEach(person => {
          // Add equal tip to anyone who has items assigned
          if (personAmounts[person.id] > 0) {
            personAmounts[person.id] += equalTipShare;
          }
        });
      }
    }
    
    setPersonTotals(personAmounts);
  }, [receiptItems, tax, tip, extraFees, people]);
  
  // Process the receipt image using Groq API when image is available
  useEffect(() => {
    if (imageUri) {
      analyzeReceiptImage(imageUri);
    }
  }, [imageUri]);

  // Function to analyze receipt using Groq API
  const analyzeReceiptImage = async (uri: string) => {
    try {
      setAnalyzing(true);
      setError(null);
      
      const result = await processReceiptImage(uri);
      
      if (!result.success || !result.data) {
        setError('Failed to analyze receipt: ' + (result.error || 'Unknown error'));
        return;
      }
      
      const data = result.data;
      
      // Set store name and date if available
      setStoreName(data.store || 'Unknown Store');
      
      // Update description with store name
      setDescription(`${data.store || 'Unknown Store'}`);
      
      // Convert items to our format
      const formattedItems = data.items.map((item: GroqReceiptItem, index: number) => ({
        id: index.toString(),
        name: item.name,
        price: item.price,
        split: true,
        quantity: item.quantity || 1,
        assignedTo: null,
        splitBetween: [] // Initialize empty split array
      }));
      
      setReceiptItems(formattedItems);
      
      // Set totals from the OCR results
      if (data.subtotal) {
        setSubtotal(data.subtotal);
        setSubtotalInput(data.subtotal.toString());
      }
      
      if (data.tax !== undefined) {
        setTax(data.tax);
        setTaxInput(data.tax ? data.tax.toString() : '');
      }
      
      if (data.tip !== undefined) {
        setTip(data.tip);
        setTipInput(data.tip ? data.tip.toString() : '');
      }
      
      if (data.extraFees !== undefined) {
        setExtraFees(data.extraFees);
        setExtraFeesInput(data.extraFees ? data.extraFees.toString() : '');
      }
      
      if (data.total) setTotal(data.total);
      
    } catch (err: any) {
      console.error('Error analyzing receipt:', err);
      setError('Failed to analyze receipt: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };
  
  // Toggle item selection for splitting
  const toggleItemSplit = (id: string) => {
    setReceiptItems(receiptItems.map(item => 
      item.id === id ? { ...item, split: !item.split } : item
    ));
  };
  
  // Handle quantity change
  const updateItemQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return; // Don't allow quantities less than 1
    
    setReceiptItems(receiptItems.map(item => 
      item.id === id ? { ...item, quantity: newQuantity } : item
    ));
  };
  
  // Handle price change
  const updateItemPrice = (id: string, newPrice: string) => {
    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice)) return;
    
    setReceiptItems(receiptItems.map(item => 
      item.id === id ? { ...item, price: parsedPrice } : item
    ));
  };
  
  // Format a number safely, handling null values
  const safeFormat = (value: number | null): string => {
    if (value === null) return '0.00';
    return value.toFixed(2);
  };
  
  // Handle creating debts from the receipt for each person
  const handleCreateDebt = async () => {
    if (!currentUser) {
      setError('You must be logged in to create a debt');
      return;
    }
    
    // Get all people except "You" who have items assigned
    const peopleWithItems = people.filter(person => 
      person.id !== '1' && // Not "You"
      personTotals[person.id] > 0 // Has items assigned
    );
    
    if (peopleWithItems.length === 0) {
      setError('Please assign items to at least one person');
      return;
    }
    
    try {
      setLoading(true);
      
      // Create detailed descriptions for each person
      const debtData = peopleWithItems.map(person => {
        // Get items directly assigned to this person and items split with this person
        const personItems = receiptItems.filter(item => 
          item.split && 
          (
            (item.assignedTo === person.id) || 
            (item.splitBetween && item.splitBetween.includes(person.id))
          )
        );
        
        // Generate descriptions with indication of split items
        const itemsDescription = personItems.map(item => {
          let itemText = `${item.quantity}x ${item.name} ($${safeFormat(item.price)} each)`;
          
          // Add split indicator if this is a shared item
          if (item.splitBetween && item.splitBetween.length > 1) {
            const totalPeople = item.splitBetween.length;
            const splitAmount = (item.price * item.quantity) / totalPeople;
            itemText += ` [Split ${totalPeople} ways, your share: $${safeFormat(splitAmount)}]`;
          }
          
          return itemText;
        }).join(', ');
        
        let personDescription = `${description}\n\nItems: ${itemsDescription}`;
        
        // Calculate the proportion of total for this person
        const personAmount = personTotals[person.id];
        
        // Count ALL people with items (including "You")
        const peopleWithItemsCount = people.filter(p => 
          personTotals[p.id] > 0
        ).length;
        
        // Calculate subtotal for calculating proportional shares
        const subtotalForCalculation = Math.max(subtotal, 0.01); // Avoid division by zero
        
        // Add proportional tax
        if (tax !== null && tax > 0) {
          // Calculate this person's proportion of the subtotal
          const itemsTotal = personItems.reduce((sum, item) => {
            if (item.splitBetween && item.splitBetween.length > 1) {
              return sum + ((item.price * item.quantity) / item.splitBetween.length);
            } else {
              return sum + (item.price * item.quantity);
            }
          }, 0);
          
          const proportion = itemsTotal / subtotalForCalculation;
          const personTax = tax * proportion;
          personDescription += `\nTax: $${safeFormat(personTax)}`;
        }
        
        // Add equal tip (explain it's split equally)
        if (tip !== null && tip > 0 && peopleWithItemsCount > 0) {
          const equalTipShare = tip / peopleWithItemsCount;
          personDescription += `\nTip: $${safeFormat(equalTipShare)} (split equally)`;
        }
        
        // Add proportional extra fees
        if (extraFees !== null && extraFees > 0) {
          // Calculate this person's proportion of the subtotal
          const itemsTotal = personItems.reduce((sum, item) => {
            if (item.splitBetween && item.splitBetween.length > 1) {
              return sum + ((item.price * item.quantity) / item.splitBetween.length);
            } else {
              return sum + (item.price * item.quantity);
            }
          }, 0);
          
          const proportion = itemsTotal / subtotalForCalculation;
          const personExtraFees = extraFees * proportion;
          personDescription += `\nExtra Fees: $${safeFormat(personExtraFees)}`;
        }
        
        return {
          debtorName: person.name,
          amount: parseFloat(safeFormat(personAmount)),
          description: personDescription,
          phoneNumber: person.phoneNumber || ''
        };
      });
      
      // Create a group debt if there are 2 or more people
      if (peopleWithItems.length > 1) {
        try {
          // Create a new debt group
          const groupName = `${description} (${peopleWithItems.length} people)`;
          const groupDescription = `Receipt split from ${storeName || 'Unknown Store'} on ${new Date().toLocaleDateString()}`;
          
          const newGroup = await createDebtGroup(currentUser.uid, {
            name: groupName,
            description: groupDescription
          }) as { id: string };
          
          console.log('Successfully created group:', newGroup);
          
          // Add each person's debt to the group
          const promises = debtData.map(debt => {
            return addDebtToGroup(
              currentUser.uid,
              newGroup.id as string,
              {
                debtorName: debt.debtorName,
                amount: debt.amount,
                description: debt.description,
                phoneNumber: debt.phoneNumber
              }
            );
          });
          
          await Promise.all(promises);
          
          // Emit event to update the home screen
          eventEmitter.emit('DEBT_ADDED', newGroup);
          
          // Show success message
          Alert.alert(
            'Group Debt Created',
            `Successfully created a group debt with ${peopleWithItems.length} people for ${storeName || description}.`,
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } catch (error) {
          console.error('Error creating group debt:', error);
          setError('Failed to create group debt from receipt');
        }
      } else {
        // Create individual debt (original behavior for single person)
        const createdDebts = [];
        for (const debt of debtData) {
          try {
            // Call your createDebt function here to save to database
            const newDebt = await createDebt(currentUser.uid, {
              debtorName: debt.debtorName,
              amount: debt.amount,
              description: debt.description,
              phoneNumber: debt.phoneNumber
            });
            
            // Add to created debts
            createdDebts.push(newDebt);
          } catch (error) {
            console.error('Error creating debt:', error);
          }
        }
        
        // Emit event for each created debt
        createdDebts.forEach(debt => {
          eventEmitter.emit('DEBT_ADDED', debt);
        });
        
        // Show success message after all debts are created
        Alert.alert(
          'Debt Created',
          `Successfully created debt for ${peopleWithItems[0].name}.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (error) {
      console.error('Error creating debts:', error);
      setError('Failed to create debts from receipt');
    } finally {
      setLoading(false);
    }
  };

  // Handle retaking or choosing a new photo
  const handleNewPhoto = async () => {
    try {
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is required to take photos. Please enable it in your device settings.');
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
        // Process the new image
        analyzeReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Camera Error', `There was a problem accessing the camera: ${errorMessage}. Please try again.`);
      setError('Failed to take a new photo: ' + errorMessage);
    }
  };
  
  // Add a new person to split with
  const addPerson = () => {
    if (!newPersonName.trim()) {
      return;
    }
    
    const newPerson: Person = {
      id: Date.now().toString(),
      name: newPersonName.trim()
    };
    
    setPeople([...people, newPerson]);
    setNewPersonName('');
  };
  
  // Remove a person and unassign their items
  const removePerson = (personId: string) => {
    // Don't allow removing "You"
    if (personId === '1') {
      return;
    }
    
    // Unassign any items assigned to this person
    const updatedItems = receiptItems.map(item => 
      item.assignedTo === personId ? { ...item, assignedTo: null } : item
    );
    
    setReceiptItems(updatedItems);
    setPeople(people.filter(p => p.id !== personId));
  };
  
  // Handle showing the assign modal with selected item
  const handleShowAssignModal = (itemId: string) => {
    setSelectedItemId(itemId);
    // Find the current item
    const item = receiptItems.find(item => item.id === itemId);
    if (item) {
      // Set selected people based on current assignments
      if (item.splitBetween && item.splitBetween.length > 0) {
        setSelectedPeople([...item.splitBetween]);
        setSplitMode(true);
      } else if (item.assignedTo) {
        setSelectedPeople([item.assignedTo]);
        setSplitMode(false);
      } else {
        setSelectedPeople([]);
        setSplitMode(false);
      }
    }
    setShowAssignModal(true);
  };
  
  // Toggle selection of a person in split mode
  const togglePersonSelection = (personId: string) => {
    if (selectedPeople.includes(personId)) {
      // Remove person from selection
      setSelectedPeople(selectedPeople.filter(id => id !== personId));
    } else {
      // Add person to selection
      setSelectedPeople([...selectedPeople, personId]);
    }
  };
  
  // Apply the split or assignment
  const applyAssignment = () => {
    if (!selectedItemId) return;
    
    setReceiptItems(receiptItems.map(item => {
      if (item.id === selectedItemId) {
        if (splitMode && selectedPeople.length > 0) {
          // In split mode with selections, assign to multiple
          return { 
            ...item,
            splitBetween: [...selectedPeople],
            assignedTo: selectedPeople[0] // Set first person as main assignee for backward compatibility
          };
        } else if (selectedPeople.length === 1) {
          // Single selection
          return { 
            ...item,
            assignedTo: selectedPeople[0],
            splitBetween: [selectedPeople[0]]
          };
        } else {
          // No selection
          return { 
            ...item,
            assignedTo: null,
            splitBetween: []
          };
        }
      }
      return item;
    }));
    
    setShowAssignModal(false);
    setSelectedItemId(null);
    setSelectedPeople([]);
  };
  
  // Handle single person assignment (for non-split mode)
  const handleSingleAssignment = (personId: string) => {
    if (!selectedItemId) return;
    
    setReceiptItems(receiptItems.map(item => {
      if (item.id === selectedItemId) {
        return { 
          ...item,
          assignedTo: personId,
          splitBetween: personId ? [personId] : []
        };
      }
      return item;
    }));
    
    setShowAssignModal(false);
    setSelectedItemId(null);
    setSelectedPeople([]);
  };
  
  // Remove assignment from an item
  const removeAssignment = () => {
    if (!selectedItemId) return;
    
    setReceiptItems(receiptItems.map(item => {
      if (item.id === selectedItemId) {
        return { 
          ...item,
          assignedTo: null,
          splitBetween: []
        };
      }
      return item;
    }));
    
    setShowAssignModal(false);
    setSelectedItemId(null);
    setSelectedPeople([]);
  };
  
  // Get display text for assignment button
  const getAssignmentDisplayText = (item: ReceiptItem) => {
    if (item.splitBetween && item.splitBetween.length > 1) {
      return `Split (${item.splitBetween.length})`;
    } else if (item.assignedTo) {
      return people.find(p => p.id === item.assignedTo)?.name || "Assign";
    } else {
      return "Assign";
    }
  };
  
  // Add a new item manually (implement this if you have an "Add Item" feature)
  const addItem = (name: string, price: number) => {
    const newItem: ReceiptItem = {
      id: Date.now().toString(),
      name,
      price,
      quantity: 1,
      split: true,
      assignedTo: null,
      splitBetween: [] // Initialize with empty array
    };
    
    setReceiptItems([...receiptItems, newItem]);
  };
  
  // Handle selecting a contact to add to the people list
  const handleSelectContact = (contact: Contacts.Contact) => {
    // Extract full name from contact
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    
    if (!fullName) {
      Alert.alert('Invalid Contact', 'The selected contact does not have a name.');
      return;
    }
    
    // Get phone number if available
    let phoneNumber = '';
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      phoneNumber = contact.phoneNumbers[0].number || '';
    }
    
    const newPerson: Person = {
      id: Date.now().toString(),
      name: fullName,
      phoneNumber: phoneNumber
    };
    
    setPeople([...people, newPerson]);
    setContactsModalVisible(false);
  };
  
  // New function to handle multiple contacts being selected
  const handleSelectMultipleContacts = (contacts: Contacts.Contact[]) => {
    if (contacts.length === 0) return;
    
    const newPeople: Person[] = contacts.map(contact => {
      // Extract full name from contact
      const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      
      // Get phone number if available
      let phoneNumber = '';
      if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
        phoneNumber = contact.phoneNumbers[0].number || '';
      }
      
      return {
        id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: fullName,
        phoneNumber: phoneNumber
      };
    });
    
    // Filter out any invalid names
    const validPeople = newPeople.filter(person => person.name.trim() !== '');
    
    if (validPeople.length === 0) {
      Alert.alert('Invalid Contacts', 'None of the selected contacts have valid names.');
      return;
    }
    
    setPeople([...people, ...validPeople]);
  };
  
  // Create a new function to handle formatted input changes for all money fields
  const handleMaskedInputChange = (value: string, inputSetter: (value: string) => void, valueSetter: (value: number | null) => void) => {
    // Allow only numbers and at most one decimal point
    let formattedValue = value.replace(/[^\d.]/g, '');
    
    // Handle multiple decimal points
    const parts = formattedValue.split('.');
    if (parts.length > 2) {
      formattedValue = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Update the raw input value
    inputSetter(formattedValue);
    
    // Convert to number for calculations
    if (formattedValue === '' || formattedValue === '.') {
      valueSetter(null);
    } else {
      const numericValue = parseFloat(formattedValue);
      if (!isNaN(numericValue)) {
        valueSetter(numericValue);
      }
    }
  };

  // Special handler for subtotal that doesn't allow null
  const handleSubtotalInputChange = (value: string) => {
    // Allow only numbers and at most one decimal point
    let formattedValue = value.replace(/[^\d.]/g, '');
    
    // Handle multiple decimal points
    const parts = formattedValue.split('.');
    if (parts.length > 2) {
      formattedValue = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Update the raw input value
    setSubtotalInput(formattedValue);
    
    // Convert to number for calculations
    if (formattedValue === '' || formattedValue === '.') {
      setSubtotal(0);
    } else {
      const numericValue = parseFloat(formattedValue);
      if (!isNaN(numericValue)) {
        setSubtotal(numericValue);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      <Stack.Screen
        options={{
          headerShown: false
        }}
      />
      
      {/* Contacts Modal */}
      <ContactsModal
        visible={contactsModalVisible}
        onClose={() => setContactsModalVisible(false)}
        onSelectContact={handleSelectContact}
        multipleSelect={true}
        onSelectMultipleContacts={handleSelectMultipleContacts}
      />
      
      <LinearGradient
        colors={['rgba(18,18,18,0.98)', 'rgba(28,28,28,0.95)']}
        style={styles.backgroundGradient}
      />
      
      {/* Header with Back Button */}
      <View style={styles.header}>
        <Pressable 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.light.tint} />
        </Pressable>
        <Text style={styles.headerTitle}>Receipt Splitter</Text>
        <View style={{width: 24}} />
      </View>
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {/* Receipt Image */}
        <View style={styles.imageContainer}>
          {analyzing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.tint} />
              <Text style={styles.loadingText}>Analyzing receipt...</Text>
              <Text style={styles.loadingSubText}>
                This may take a moment as we extract the items and prices.
              </Text>
            </View>
          ) : imageUri ? (
            <>
              <Image
                source={{ uri: imageUri }}
                style={styles.receiptImage}
                resizeMode="contain"
              />
              <Pressable 
                style={styles.newPhotoButton}
                onPress={handleNewPhoto}
              >
                <Ionicons name="camera" size={16} color="#FFF" />
                <Text style={styles.newPhotoText}>Take New Photo</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.noImageContainer}>
              <Ionicons name="receipt-outline" size={50} color={Colors.light.tint} />
              <Text style={styles.noImageText}>No receipt image available</Text>
              <Pressable 
                style={styles.takePhotoButton}
                onPress={handleNewPhoto}
              >
                <Ionicons name="camera" size={16} color="#000" />
                <Text style={styles.takePhotoText}>Take Photo</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Receipt Info */}
        {storeName && (
          <View style={styles.storeInfoContainer}>
            <Text style={styles.storeName}>{storeName}</Text>
          </View>
        )}
        
        {/* People Splitting the Bill */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>People Splitting the Bill</Text>
          
          <View style={styles.peopleList}>
            {people.map(person => (
              <View key={person.id} style={styles.personItem}>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{person.name}</Text>
                  <Text style={styles.personTotal}>${safeFormat(personTotals[person.id] || 0)}</Text>
                </View>
                
                {person.id !== '1' && ( // Don't allow removing "You"
                  <Pressable 
                    style={styles.removePersonButton}
                    onPress={() => removePerson(person.id)}
                  >
                    <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
          
          <View style={styles.addPeopleDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.subsectionTitle}>Add People</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <View style={styles.addPersonRow}>
            <View style={styles.addPersonContainer}>
              <TextInput
                style={styles.addPersonInput}
                placeholder="Enter person name..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newPersonName}
                onChangeText={setNewPersonName}
              />
              <Pressable 
                style={styles.addPersonButton}
                onPress={addPerson}
                disabled={!newPersonName.trim()}
              >
                <Ionicons name="add" size={24} color="#000" />
              </Pressable>
            </View>
            
            <Text style={styles.orText}>OR</Text>
            
            <Pressable
              style={styles.selectContactButton}
              onPress={() => setContactsModalVisible(true)}
            >
              <Ionicons name="people" size={18} color={Colors.light.tint} style={styles.selectContactIcon} />
              <Text style={styles.selectContactText}>Select from Contacts</Text>
            </Pressable>
          </View>
        </View>
        
        {/* Receipt Items with assignment */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Receipt Items</Text>
          
          {analyzing ? (
            <ActivityIndicator size="small" color={Colors.light.tint} />
          ) : receiptItems.length === 0 ? (
            <Text style={styles.emptyText}>No items found. Take a photo of a receipt to get started.</Text>
          ) : (
            receiptItems.map(item => (
              <View key={item.id} style={styles.itemContainer}>
                <Pressable
                  style={[
                    styles.itemCheckbox,
                    item.split && styles.itemCheckboxActive
                  ]}
                  onPress={() => toggleItemSplit(item.id)}
                >
                  {item.split && <Ionicons name="checkmark" size={16} color="#fff" />}
                </Pressable>
                
                <View style={styles.itemDetails}>
                  <View style={styles.itemNameRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemTotal}>${safeFormat(item.price * item.quantity)}</Text>
                  </View>
                  <View style={styles.itemControls}>
                    <View style={styles.priceContainer}>
                      <View style={styles.priceEditContainer}>
                        <Text style={styles.currencySymbol}>$</Text>
                        <TextInput
                          style={styles.itemPriceInput}
                          value={item.price.toString()}
                          onChangeText={(value) => updateItemPrice(item.id, value)}
                          keyboardType="decimal-pad"
                          selectionColor={Colors.light.tint}
                        />
                      </View>
                      <View style={styles.quantityContainer}>
                        <Pressable
                          style={styles.quantityButton}
                          onPress={() => updateItemQuantity(item.id, item.quantity - 1)}
                        >
                          <Ionicons name="remove" size={16} color="#fff" />
                        </Pressable>
                        
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        
                        <Pressable
                          style={styles.quantityButton}
                          onPress={() => updateItemQuantity(item.id, item.quantity + 1)}
                        >
                          <Ionicons name="add" size={16} color="#fff" />
                        </Pressable>
                      </View>
                    </View>
                    
                    <Pressable
                      style={styles.assignButton}
                      onPress={() => handleShowAssignModal(item.id)}
                    >
                      <Ionicons 
                        name={item.splitBetween && item.splitBetween.length > 1 ? "people-outline" : "person-outline"}
                        size={14} 
                        color="rgba(255,255,255,0.7)" 
                        style={styles.assignIcon} 
                      />
                      <Text style={styles.assignButtonText}>
                        {getAssignmentDisplayText(item)}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
        
        {/* Totals */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Totals</Text>
          
          <View style={styles.totalRow}>
            <View style={styles.totalLabelContainer}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
            </View>
            <TextInput
              style={styles.totalInput}
              value={subtotalInput}
              onChangeText={handleSubtotalInputChange}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.4)"
              selectTextOnFocus={true}
            />
          </View>
          
          <View style={styles.totalRow}>
            <View style={styles.totalLabelContainer}>
              <Text style={styles.totalLabel}>Tax:</Text>
            </View>
            <TextInput
              style={styles.totalInput}
              value={taxInput}
              onChangeText={(value) => handleMaskedInputChange(value, setTaxInput, setTax)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.4)"
              selectTextOnFocus={true}
            />
          </View>
          
          <View style={styles.totalRow}>
            <View style={styles.totalLabelContainer}>
              <Text style={styles.totalLabel}>Tip:</Text>
              <Pressable 
                style={styles.helpButton} 
                onPress={() => Alert.alert('Equal Tip Split', 'The tip amount is split equally among all people (except You) regardless of how much they spent.')}
              >
                <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
            <TextInput
              style={styles.totalInput}
              value={tipInput}
              onChangeText={(value) => handleMaskedInputChange(value, setTipInput, setTip)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.4)"
              selectTextOnFocus={true}
            />
          </View>
          <Text style={[styles.tipExplainerText, {marginBottom: 8}]}>Tip is split equally between everyone with items</Text>
          
          <View style={styles.totalRow}>
            <View style={styles.totalLabelContainer}>
              <Text style={styles.totalLabel}>Extra Fees:</Text>
              <Pressable 
                style={styles.helpButton} 
                onPress={() => Alert.alert('Extra Fees', 'Include service charges, delivery fees, included gratuity, or other miscellaneous charges not covered by tax or tip.')}
              >
                <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
            <TextInput
              style={styles.totalInput}
              value={extraFeesInput}
              onChangeText={(value) => handleMaskedInputChange(value, setExtraFeesInput, setExtraFees)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.4)"
              selectTextOnFocus={true}
            />
          </View>
          
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <View style={styles.totalLabelContainer}>
              <Text style={styles.totalLabelFinal}>Total:</Text>
            </View>
            <Text style={styles.totalValueFinal}>${safeFormat(total)}</Text>
          </View>
        </View>
        
        <Text style={styles.tipText}>
          Tip: Tap any value to edit it directly. All values will be split proportionally.
        </Text>
        
        <View style={{ height: 10 }} />
        
        {/* Debt Information */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Receipt Information</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter description (e.g., Dinner at Luigi's)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={description}
              onChangeText={setDescription}
            />
          </View>
        </View>
        
        {/* Create Debt Button */}
        <Pressable 
          style={({pressed}) => [
            styles.createDebtButton,
            {opacity: (pressed || loading || analyzing) ? 0.8 : 1}
          ]}
          onPress={handleCreateDebt}
          disabled={loading || analyzing || receiptItems.length === 0}
        >
          <LinearGradient
            colors={[Colors.light.tint, '#3DCD84', '#2EBB77']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            {loading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="cash-outline" size={18} color="#000" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Create Debts</Text>
              </View>
            )}
          </LinearGradient>
        </Pressable>

        {/* Assignment Modal */}
        <Modal
          visible={showAssignModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowAssignModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTitle}>
                  {splitMode ? "Split between" : "Assign to"}
                </Text>
                
                <Pressable 
                  style={styles.splitModeToggle}
                  onPress={() => setSplitMode(!splitMode)}
                >
                  <Text style={styles.splitModeToggleText}>
                    {splitMode ? "Single" : "Split"}
                  </Text>
                </Pressable>
              </View>
              
              <ScrollView style={styles.modalScroll}>
                {people.map(person => (
                  <Pressable
                    key={person.id}
                    style={[
                      styles.modalOption,
                      splitMode && selectedPeople.includes(person.id) && styles.modalOptionSelected
                    ]}
                    onPress={() => {
                      if (splitMode) {
                        togglePersonSelection(person.id);
                      } else {
                        handleSingleAssignment(person.id);
                      }
                    }}
                  >
                    <View style={styles.modalOptionContent}>
                      {splitMode && (
                        <View style={[
                          styles.optionCheckbox,
                          selectedPeople.includes(person.id) && styles.optionCheckboxSelected
                        ]}>
                          {selectedPeople.includes(person.id) && (
                            <Ionicons name="checkmark" size={12} color="#FFF" />
                          )}
                        </View>
                      )}
                      <Text style={styles.modalOptionText}>{person.name}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
              
              {splitMode ? (
                <Pressable 
                  style={[
                    styles.modalActionButton,
                    selectedPeople.length === 0 && styles.modalButtonDisabled
                  ]}
                  onPress={applyAssignment}
                  disabled={selectedPeople.length === 0}
                >
                  <Text style={styles.modalActionButtonText}>Apply Split</Text>
                </Pressable>
              ) : (
                <Pressable 
                  style={styles.modalRemoveButton}
                  onPress={removeAssignment}
                >
                  <Text style={styles.modalRemoveButtonText}>Remove Assignment</Text>
                </Pressable>
              )}
              
              <Pressable 
                style={styles.modalCloseButton}
                onPress={() => setShowAssignModal(false)}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
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
    padding: 20,
    paddingBottom: 40,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
  },
  imageContainer: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    position: 'relative',
  },
  receiptImage: {
    width: '100%',
    height: '100%',
  },
  newPhotoButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  newPhotoText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    fontFamily: 'AeonikBlack-Regular',
  },
  noImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noImageText: {
    color: 'rgba(255,255,255,0.7)',
    marginVertical: 12,
    textAlign: 'center',
    fontFamily: 'AeonikBlack-Regular',
  },
  takePhotoButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  takePhotoText: {
    color: '#000',
    fontSize: 14,
    marginLeft: 6,
    fontFamily: 'Aeonik-Black',
  },
  storeInfoContainer: {
    backgroundColor: 'rgba(35,35,35,0.98)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  storeName: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontFamily: 'AeonikBlack-Regular',
  },
  loadingSubText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'AeonikBlack-Regular',
  },
  sectionContainer: {
    marginBottom: 24,
    backgroundColor: 'rgba(35,35,35,0.98)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    color: '#fff',
    marginBottom: 16,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    padding: 20,
    fontFamily: 'AeonikBlack-Regular',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  itemCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  itemCheckboxActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  itemDetails: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
    fontFamily: 'AeonikBlack-Regular',
  },
  itemTotal: {
    color: Colors.light.tint,
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginLeft: 8,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 80,
    marginRight: 12,
  },
  currencySymbol: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginRight: 2,
    fontFamily: 'AeonikBlack-Regular',
  },
  itemPriceInput: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    width: 60,
    textAlign: 'right',
    fontFamily: 'AeonikBlack-Regular',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    color: '#fff',
    fontSize: 16,
    marginHorizontal: 8,
    fontFamily: 'Aeonik-Black',
    minWidth: 20,
    textAlign: 'center',
  },
  assignButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignIcon: {
    marginRight: 4,
  },
  assignButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontFamily: 'AeonikBlack-Regular',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  totalRowFinal: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
  },
  totalValue: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  totalInput: {
    color: '#fff',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    textAlign: 'right',
  },
  totalLabelFinal: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
  },
  totalValueFinal: {
    color: Colors.light.tint,
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
    fontFamily: 'AeonikBlack-Regular',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontFamily: 'AeonikBlack-Regular',
  },
  createDebtButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 16,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  peopleList: {
    marginBottom: 16,
  },
  personItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  personInfo: {
    flex: 1,
    paddingRight: 8,
  },
  personName: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
    marginBottom: 4,
  },
  personTotal: {
    color: Colors.light.tint,
    fontSize: 15,
    fontFamily: 'Aeonik-Black',
    marginTop: 4,
  },
  removePersonButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  addPeopleDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  subsectionTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
    marginHorizontal: 12,
  },
  addPersonRow: {
    flexDirection: 'column',
    width: '100%',
    gap: 12,
  },
  addPersonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    height: 48,
  },
  addPersonInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
    height: '100%',
  },
  addPersonButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  orText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontFamily: 'AeonikBlack-Regular',
    textAlign: 'center',
  },
  selectContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectContactIcon: {
    marginRight: 8,
  },
  selectContactText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#232323',
    borderRadius: 12,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
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
  modalHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Aeonik-Black',
    textAlign: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  splitModeToggle: {
    backgroundColor: 'rgba(74, 226, 144, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  splitModeToggleText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontFamily: 'Aeonik-Black',
  },
  modalScroll: {
    maxHeight: 300,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(74, 226, 144, 0.1)',
  },
  modalOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOptionText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'AeonikBlack-Regular',
  },
  optionCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionCheckboxSelected: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  modalActionButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    backgroundColor: 'rgba(74, 226, 144, 0.3)',
  },
  modalActionButtonText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  modalCloseButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  modalRemoveButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalRemoveButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontFamily: 'Aeonik-Black',
  },
  totalLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helpButton: {
    marginLeft: 8,
    padding: 2,
  },
  tipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontFamily: 'AeonikBlack-Regular',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  tipExplainerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontFamily: 'AeonikBlack-Regular',
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: -4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 226, 144, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    color: '#fff',
    fontFamily: 'Aeonik-Black',
  },
}); 