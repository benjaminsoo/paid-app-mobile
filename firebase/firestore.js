import { collection, getDocs, doc, getDoc, query, where, orderBy, limit, addDoc, updateDoc, deleteDoc, Timestamp, setDoc, writeBatch, increment, runTransaction, arrayUnion } from 'firebase/firestore';
import { db } from './config';

/**
 * Fetch all documents from a collection
 * @param {string} collectionName - Name of the collection to fetch
 * @returns {Promise<Array>} - Array of documents
 */
export const fetchCollection = async (collectionName) => {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const documents = [];
    
    querySnapshot.forEach((doc) => {
      documents.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    
    return documents;
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Fetch a single document by ID
 * @param {string} collectionName - Name of the collection
 * @param {string} documentId - ID of the document to fetch
 * @returns {Promise<Object|null>} - Document data or null if not found
 */
export const fetchDocument = async (collectionName, documentId) => {
  try {
    const docRef = doc(db, collectionName, documentId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error fetching document ${documentId}:`, error);
    throw error;
  }
};

/**
 * Create a new debt for a user
 * @param {string} userId - ID of the user who is owed money
 * @param {Object} debtData - Debt information
 * @param {string} debtData.debtorName - Name of person who owes money
 * @param {number} debtData.amount - Amount owed
 * @param {string} [debtData.description] - Optional description
 * @param {string} [debtData.phoneNumber] - Optional phone number for reminders
 * @param {string} [debtData.groupId] - Optional group ID
 * @param {boolean} [debtData.isRecurring] - Whether this is a recurring debt
 * @param {string} [debtData.recurringFrequency] - Frequency of the recurring debt
 * @param {string} [debtData.recurringStartDate] - ISO date when the recurring debt starts
 * @param {string} [debtData.recurringEndDate] - ISO date when the recurring debt ends (optional)
 * @param {number} [debtData.recurringDay] - Day of month/week for the recurring debt
 * @returns {Promise<Object>} - Created debt with ID
 */
export const createDebt = async (userId, { 
  debtorName, 
  amount, 
  description = '', 
  phoneNumber = '', 
  groupId = null,
  isRecurring = false,
  recurringFrequency = 'monthly',
  recurringStartDate = new Date().toISOString(),
  recurringEndDate = null,
  recurringDay = null
}) => {
  try {
    if (!userId) {
      throw new Error('userId is required');
    }
    
    console.log(`Creating debt for user ${userId}`);
    const userDebtsRef = collection(db, 'users', userId, 'debts');
    const now = new Date().toISOString();
    
    // Ensure proper data types
    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      throw new Error('Invalid amount: must be a number');
    }
    
    const debtData = {
      debtorName: String(debtorName),
      amount: numericAmount,
      description: String(description || ''),
      phoneNumber: String(phoneNumber || ''),
      createdAt: now,
      updatedAt: now,
      isPaid: false,
      userId: String(userId),
      isRecurring: Boolean(isRecurring)
    };
    
    // Add groupId if present
    if (groupId) {
      debtData.groupId = String(groupId);
    }
    
    // If this is a recurring debt, create a recurring template first
    if (isRecurring) {
      try {
        const recurringDebt = await createRecurringDebt(userId, {
          debtorName,
          amount,
          description,
          phoneNumber,
          groupId,
          frequency: recurringFrequency,
          startDate: recurringStartDate,
          endDate: recurringEndDate,
          dayOfMonth: recurringFrequency === 'monthly' || recurringFrequency === 'quarterly' || recurringFrequency === 'yearly' 
            ? recurringDay : null,
          dayOfWeek: recurringFrequency === 'weekly' || recurringFrequency === 'biweekly' 
            ? recurringDay : null
        });
        
        // Link this debt to the recurring template
        debtData.recurringId = recurringDebt.id;
        debtData.recurringInstanceIndex = 0; // First instance
      } catch (recurringError) {
        console.error('Error creating recurring debt template:', recurringError);
        // Continue with creating regular debt even if recurring template fails
      }
    }
    
    console.log('Debt data being saved:', debtData);
    const docRef = await addDoc(userDebtsRef, debtData);
    console.log(`Debt created with ID: ${docRef.id}`);
    
    // If this is a recurring debt, update the recurring template with this debt ID
    if (isRecurring && debtData.recurringId) {
      try {
        const recurringRef = doc(db, 'users', userId, 'recurringDebts', debtData.recurringId);
        await updateDoc(recurringRef, {
          generatedDebtIds: arrayUnion(docRef.id),
          lastGeneratedDate: now,
        });
      } catch (err) {
        console.error('Error updating recurring debt with generated debt ID:', err);
      }
    }
    
    // If part of a group, update the group's totals
    if (groupId) {
      try {
        // Update the group document to add this debt ID and update totals
        const groupRef = doc(db, 'users', userId, 'debtGroups', groupId);
        await updateDoc(groupRef, {
          updatedAt: now,
          totalAmount: increment(numericAmount),
          debtIds: increment(1) // Simplified approach
        });
        
        // Get all debt IDs for the group and set them correctly
        await updateGroupTotals(userId, groupId);
      } catch (groupError) {
        console.error('Error updating debt group after creating debt:', groupError);
        // Continue with debt creation even if group update fails
      }
    }
    
    return {
      id: docRef.id,
      ...debtData,
    };
  } catch (error) {
    console.error('Error creating debt:', error);
    throw error;
  }
};

/**
 * Create a recurring debt template
 * @param {string} userId - ID of the user who is owed money
 * @param {Object} recurringData - Recurring debt information
 * @returns {Promise<Object>} - Created recurring debt with ID
 */
export const createRecurringDebt = async (userId, {
  debtorName,
  amount,
  description = '',
  phoneNumber = '',
  groupId = null,
  frequency = 'monthly',
  startDate = new Date().toISOString(),
  endDate = null,
  dayOfMonth = null,
  dayOfWeek = null
}) => {
  try {
    if (!userId) {
      throw new Error('userId is required');
    }
    
    console.log(`Creating recurring debt template for user ${userId}`);
    const recurringDebtsRef = collection(db, 'users', userId, 'recurringDebts');
    const now = new Date().toISOString();
    
    // Ensure proper data types
    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      throw new Error('Invalid amount: must be a number');
    }
    
    // Parse the start date
    const startDateObj = new Date(startDate);
    
    // Calculate next generation date based on start date and frequency
    // Use the start date as the reference point instead of today's date
    const nextGeneration = new Date(startDateObj);
    
    // Calculate next generation based on frequency
    switch (frequency) {
      case 'daily':
        nextGeneration.setDate(nextGeneration.getDate() + 1);
        break;
      case 'weekly':
        nextGeneration.setDate(nextGeneration.getDate() + 7);
        break;
      case 'biweekly':
        nextGeneration.setDate(nextGeneration.getDate() + 14);
        break;
      case 'monthly':
        nextGeneration.setMonth(nextGeneration.getMonth() + 1);
        break;
      case 'quarterly':
        nextGeneration.setMonth(nextGeneration.getMonth() + 3);
        break;
      case 'yearly':
        nextGeneration.setFullYear(nextGeneration.getFullYear() + 1);
        break;
    }
    
    const recurringData = {
      userId: String(userId),
      debtorName: String(debtorName),
      amount: numericAmount,
      description: String(description || ''),
      phoneNumber: String(phoneNumber || ''),
      frequency,
      startDate,
      endDate,
      dayOfMonth: dayOfMonth ? Number(dayOfMonth) : null,
      dayOfWeek: dayOfWeek ? Number(dayOfWeek) : null,
      createdAt: now,
      updatedAt: now,
      lastGeneratedDate: now,
      nextGenerationDate: nextGeneration.toISOString(),
      isActive: true,
      generatedDebtIds: []
    };
    
    // Add groupId if present
    if (groupId) {
      recurringData.groupId = String(groupId);
    }
    
    console.log('Recurring debt template being saved:', recurringData);
    const docRef = await addDoc(recurringDebtsRef, recurringData);
    console.log(`Recurring debt template created with ID: ${docRef.id}`);
    
    return {
      id: docRef.id,
      ...recurringData,
    };
  } catch (error) {
    console.error('Error creating recurring debt template:', error);
    throw error;
  }
};

/**
 * Fetch all debts for a user
 * @param {string} userId - ID of the user whose debts to fetch
 * @returns {Promise<Array>} - Array of debt documents
 */
export const fetchUserDebts = async (userId) => {
  try {
    if (!userId) {
      console.warn('fetchUserDebts called without a userId');
      return [];
    }
    
    console.log(`Fetching debts for user: ${userId}`);
    
    // Ensure we're accessing the right path
    const userDebtsRef = collection(db, 'users', userId, 'debts');
    console.log(`Collection path: users/${userId}/debts`);
    
    const q = query(userDebtsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    console.log(`Query returned ${querySnapshot.size} documents`);
    
    const debts = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`Debt document ${doc.id}:`, data);
      debts.push({
        id: doc.id,
        ...data,
      });
    });
    
    console.log(`Processed ${debts.length} debt documents`);
    return debts;
  } catch (error) {
    console.error('Error fetching user debts:', error);
    // If permissions error, return empty array instead of throwing
    if (error.code === 'permission-denied') {
      console.warn('Permission denied when fetching debts. Check Firestore rules.');
      return [];
    }
    throw error;
  }
};

/**
 * Mark a debt as paid
 * @param {string} userId - ID of the user who is owed money
 * @param {string} debtId - ID of the debt to mark as paid
 * @param {boolean} isPaid - Whether the debt is paid
 * @returns {Promise<void>}
 */
export const markDebtAsPaid = async (userId, debtId, isPaid = true) => {
  try {
    const debtRef = doc(db, 'users', userId, 'debts', debtId);
    const now = new Date().toISOString();
    
    // Get the debt data to check for groupId
    const debtSnap = await getDoc(debtRef);
    if (!debtSnap.exists()) {
      throw new Error(`Debt ${debtId} not found`);
    }
    
    const debtData = debtSnap.data();
    const { groupId } = debtData;
    
    // Update the debt
    await updateDoc(debtRef, {
      isPaid: isPaid,
      paidAt: isPaid ? now : null,
      updatedAt: now,
    });
    
    // If the debt is part of a group, update the group totals
    if (groupId) {
      try {
        await updateGroupTotals(userId, groupId);
      } catch (groupError) {
        console.error('Error updating debt group after marking debt as paid:', groupError);
        // Continue with debt update even if group update fails
      }
    }
  } catch (error) {
    console.error('Error marking debt as paid:', error);
    throw error;
  }
};

/**
 * Update a debt's information
 * @param {string} userId - ID of the user who is owed money
 * @param {string} debtId - ID of the debt to update
 * @param {Object} updateData - Data to update
 * @returns {Promise<void>}
 */
export const updateDebt = async (userId, debtId, updateData) => {
  try {
    const debtRef = doc(db, 'users', userId, 'debts', debtId);
    const now = new Date().toISOString();
    
    await updateDoc(debtRef, {
      ...updateData,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Error updating debt:', error);
    throw error;
  }
};

/**
 * Delete a debt
 * @param {string} userId - ID of the user who is owed money
 * @param {string} debtId - ID of the debt to delete
 * @returns {Promise<void>}
 */
export const deleteDebt = async (userId, debtId) => {
  try {
    const debtRef = doc(db, 'users', userId, 'debts', debtId);
    
    // Get the debt data to check for groupId
    const debtSnap = await getDoc(debtRef);
    if (!debtSnap.exists()) {
      throw new Error(`Debt ${debtId} not found`);
    }
    
    const debtData = debtSnap.data();
    const { groupId } = debtData;
    
    // Delete the debt
    await deleteDoc(debtRef);
    
    // If the debt is part of a group, update the group totals
    if (groupId) {
      try {
        await updateGroupTotals(userId, groupId);
      } catch (groupError) {
        console.error('Error updating debt group after deleting debt:', groupError);
        // Continue with debt deletion even if group update fails
      }
    }
  } catch (error) {
    console.error('Error deleting debt:', error);
    throw error;
  }
};

/**
 * Update user profile data
 * @param {string} userId - ID of the user
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<Object>} - Updated user data
 */
export const updateUserProfile = async (userId, profileData) => {
  try {
    // Condensed logging to avoid spam
    console.log(`Updating profile for user: ${userId}`);
    
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const now = new Date().toISOString();
    
    let userData = {};
    
    if (userSnap.exists()) {
      userData = userSnap.data();
      
      // Get existing profile or initialize empty object
      const existingProfile = userData.profile || {};
      
      // Update the document with the profile as a nested object
      const updateData = {
        profile: {
          ...existingProfile,
          ...profileData,
          updatedAt: now
        },
        updatedAt: now
      };
      
      await updateDoc(userRef, updateData);
      console.log('Profile updated successfully');
    } else {
      // Create new user document if it doesn't exist
      userData = {
        email: '',
        username: '',
        createdAt: now,
        updatedAt: now,
        profile: {
          ...profileData,
          updatedAt: now
        }
      };
      
      await setDoc(userRef, userData);
      console.log('New user document created');
    }
    
    // Get updated document to return
    const updatedDoc = await getDoc(userRef);
    return updatedDoc.exists() ? { id: userId, ...updatedDoc.data() } : null;
    
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Update user payment methods
 * @param {string} userId - ID of the user
 * @param {Array} paymentMethods - Array of payment method objects
 * @returns {Promise<Object>} - Updated user data
 */
export const updatePaymentMethods = async (userId, paymentMethods) => {
  try {
    console.log('Updating payment methods for user:', userId);
    console.log('Payment methods to save:', paymentMethods);
    
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const now = new Date().toISOString();
    
    let userData = {};
    
    if (userSnap.exists()) {
      userData = userSnap.data();
      
      // Update the payment methods
      await updateDoc(userRef, {
        paymentMethods: paymentMethods,
        updatedAt: now
      });
      
      console.log('Payment methods updated successfully');
    } else {
      // Create new user document if it doesn't exist
      userData = {
        email: '',
        username: '',
        createdAt: now,
        updatedAt: now,
        paymentMethods: paymentMethods
      };
      
      await setDoc(userRef, userData);
      console.log('New user document created with payment methods');
    }
    
    return {
      id: userId,
      ...userData,
      paymentMethods: paymentMethods,
      updatedAt: now
    };
  } catch (error) {
    console.error('Error updating payment methods:', error);
    throw error;
  }
};

/**
 * Create a new debt group for a user
 * @param {string} userId - ID of the user who is owed money
 * @param {Object} groupData - Group information
 * @param {string} groupData.name - Name of the debt group
 * @param {string} [groupData.description] - Optional description
 * @param {boolean} [groupData.isRecurring] - Whether the group is recurring
 * @param {string} [groupData.frequency] - Frequency of recurring (daily, weekly, etc.)
 * @param {Date|string} [groupData.startDate] - Start date of recurring
 * @param {Date|string|null} [groupData.endDate] - End date of recurring (optional)
 * @param {number} [groupData.dayOfMonth] - Day of month for monthly/quarterly/yearly frequencies
 * @param {number} [groupData.dayOfWeek] - Day of week for weekly/biweekly frequencies
 * @returns {Promise<Object>} - Created debt group with ID
 */
export const createDebtGroup = async (userId, { 
  name, 
  description = '',
  isRecurring = false,
  frequency = 'monthly',
  startDate = new Date().toISOString(),
  endDate = null,
  dayOfMonth = null,
  dayOfWeek = null
}) => {
  try {
    if (!userId) {
      throw new Error('userId is required');
    }
    
    console.log(`Creating debt group for user ${userId}`);
    const userGroupsRef = collection(db, 'users', userId, 'debtGroups');
    const now = new Date().toISOString();
    
    const groupData = {
      name: String(name),
      description: String(description || ''),
      createdAt: now,
      updatedAt: now,
      isCompleted: false,
      totalAmount: 0,
      paidAmount: 0,
      debtIds: [],
      userId: String(userId)
    };
    
    // Add recurring fields if applicable
    if (isRecurring) {
      // Make sure dates are ISO strings
      const startDateIso = typeof startDate === 'string' ? startDate : startDate.toISOString();
      const endDateIso = endDate ? (typeof endDate === 'string' ? endDate : endDate.toISOString()) : null;
      
      Object.assign(groupData, {
        isRecurring: true,
        frequency,
        startDate: startDateIso,
        endDate: endDateIso,
        dayOfMonth: frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly' ? (dayOfMonth || 1) : null,
        dayOfWeek: frequency === 'weekly' || frequency === 'biweekly' ? (dayOfWeek || 1) : null,
        lastGeneratedDate: now,
        nextGenerationDate: calculateNextGenerationDate(startDateIso, frequency),
        isActive: true,
        generatedGroupIds: []
      });
    }
    
    console.log('Group data being saved:', groupData);
    const docRef = await addDoc(userGroupsRef, groupData);
    console.log(`Debt group created with ID: ${docRef.id}`);
    
    return {
      id: docRef.id,
      ...groupData,
    };
  } catch (error) {
    console.error('Error creating debt group:', error);
    throw error;
  }
};

/**
 * Calculate the next generation date for recurring items
 * @param {string} currentDate - Current date in ISO format
 * @param {string} frequency - Frequency (daily, weekly, etc.)
 * @returns {string} - Next generation date in ISO format
 */
function calculateNextGenerationDate(currentDate, frequency) {
  // Use the provided date as the reference point
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1); // Default to monthly
  }
  
  return date.toISOString();
}

/**
 * Add a debt to a debt group
 * @param {string} userId - ID of the user who is owed money
 * @param {string} groupId - ID of the debt group
 * @param {Object} debtData - Debt information
 * @returns {Promise<Object>} - Created debt with ID
 */
export const addDebtToGroup = async (userId, groupId, debtData) => {
  try {
    if (!userId || !groupId) {
      throw new Error('userId and groupId are required');
    }
    
    // Start a batch operation to ensure atomicity
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    
    // Create the debt with groupId
    const userDebtsRef = collection(db, 'users', userId, 'debts');
    const debtWithGroup = {
      ...debtData,
      createdAt: now,
      updatedAt: now,
      isPaid: false,
      userId: String(userId),
      groupId: String(groupId)
    };
    
    // Ensure proper data types
    const numericAmount = Number(debtWithGroup.amount);
    if (isNaN(numericAmount)) {
      throw new Error('Invalid amount: must be a number');
    }
    debtWithGroup.amount = numericAmount;
    
    // Add debt to Firestore
    const debtRef = doc(collection(db, 'users', userId, 'debts'));
    batch.set(debtRef, debtWithGroup);
    
    // Update the debt group
    const groupRef = doc(db, 'users', userId, 'debtGroups', groupId);
    batch.update(groupRef, {
      updatedAt: now,
      totalAmount: increment(numericAmount),
      debtIds: increment(1) // Firestore array union would be better but using increment for simplicity
    });
    
    // Commit the batch
    await batch.commit();
    
    // Get the updated group data
    const groupSnap = await getDoc(groupRef);
    const groupData = groupSnap.data();
    
    // Ensure we have the correct debtIds array by getting it directly
    const debtsQuery = query(userDebtsRef, where('groupId', '==', groupId));
    const debtsSnap = await getDocs(debtsQuery);
    const debtIds = debtsSnap.docs.map(doc => doc.id);
    
    // Update the group with the correct debtIds
    await updateDoc(groupRef, {
      debtIds: debtIds
    });
    
    return {
      id: debtRef.id,
      ...debtWithGroup,
    };
  } catch (error) {
    console.error('Error adding debt to group:', error);
    throw error;
  }
};

/**
 * Update a debt group's totals based on its debts
 * @param {string} userId - ID of the user who is owed money
 * @param {string} groupId - ID of the debt group to update
 * @returns {Promise<void>}
 */
export const updateGroupTotals = async (userId, groupId) => {
  try {
    if (!userId || !groupId) {
      throw new Error('userId and groupId are required');
    }
    
    // Get all debts in the group
    const userDebtsRef = collection(db, 'users', userId, 'debts');
    const debtsQuery = query(userDebtsRef, where('groupId', '==', groupId));
    const debtsSnap = await getDocs(debtsQuery);
    
    let totalAmount = 0;
    let paidAmount = 0;
    let allPaid = true;
    const debtIds = [];
    
    debtsSnap.forEach(doc => {
      const debt = doc.data();
      debtIds.push(doc.id);
      totalAmount += debt.amount;
      
      if (debt.isPaid) {
        paidAmount += debt.amount;
      } else {
        allPaid = false;
      }
    });
    
    // Update the group document
    const groupRef = doc(db, 'users', userId, 'debtGroups', groupId);
    const now = new Date().toISOString();
    
    await updateDoc(groupRef, {
      updatedAt: now,
      totalAmount: totalAmount,
      paidAmount: paidAmount,
      isCompleted: allPaid,
      debtIds: debtIds
    });
    
    console.log(`Debt group ${groupId} totals updated`);
  } catch (error) {
    console.error('Error updating debt group totals:', error);
    throw error;
  }
};

/**
 * Remove a debt from a debt group
 * @param {string} userId - ID of the user who is owed money
 * @param {string} groupId - ID of the debt group
 * @param {string} debtId - ID of the debt to remove
 * @returns {Promise<void>}
 */
export const removeDebtFromGroup = async (userId, groupId, debtId) => {
  try {
    if (!userId || !groupId || !debtId) {
      throw new Error('userId, groupId, and debtId are required');
    }
    
    // Get the debt to determine its amount
    const debtRef = doc(db, 'users', userId, 'debts', debtId);
    const debtSnap = await getDoc(debtRef);
    
    if (!debtSnap.exists()) {
      throw new Error(`Debt ${debtId} not found`);
    }
    
    const debt = debtSnap.data();
    const amount = debt.amount;
    const isPaid = debt.isPaid;
    
    // Use a transaction to ensure consistency
    await runTransaction(db, async (transaction) => {
      // Remove the groupId from the debt
      transaction.update(debtRef, { 
        groupId: null,
        updatedAt: new Date().toISOString()
      });
      
      // Update the group
      const groupRef = doc(db, 'users', userId, 'debtGroups', groupId);
      const groupSnap = await transaction.get(groupRef);
      
      if (!groupSnap.exists()) {
        throw new Error(`Debt group ${groupId} not found`);
      }
      
      const groupData = groupSnap.data();
      let newTotalAmount = groupData.totalAmount - amount;
      let newPaidAmount = isPaid ? groupData.paidAmount - amount : groupData.paidAmount;
      const newDebtIds = groupData.debtIds.filter(id => id !== debtId);
      
      // Ensure we don't have negative amounts
      newTotalAmount = Math.max(0, newTotalAmount);
      newPaidAmount = Math.max(0, newPaidAmount);
      
      // Update the group totals
      transaction.update(groupRef, {
        totalAmount: newTotalAmount,
        paidAmount: newPaidAmount,
        debtIds: newDebtIds,
        isCompleted: newDebtIds.length > 0 ? newPaidAmount >= newTotalAmount : true,
        updatedAt: new Date().toISOString()
      });
    });
    
    console.log(`Debt ${debtId} removed from group ${groupId}`);
  } catch (error) {
    console.error('Error removing debt from group:', error);
    throw error;
  }
};

/**
 * Delete a debt group (with option to keep or delete its debts)
 * @param {string} userId - ID of the user who is owed money
 * @param {string} groupId - ID of the debt group to delete
 * @param {boolean} [keepDebts=true] - Whether to keep the debts (just remove groupId) or delete them
 * @returns {Promise<void>}
 */
export const deleteDebtGroup = async (userId, groupId, keepDebts = true) => {
  try {
    if (!userId || !groupId) {
      throw new Error('userId and groupId are required');
    }
    
    // Get all debts in the group
    const userDebtsRef = collection(db, 'users', userId, 'debts');
    const debtsQuery = query(userDebtsRef, where('groupId', '==', groupId));
    const debtsSnap = await getDocs(debtsQuery);
    
    // Batch operation to ensure atomicity
    const batch = writeBatch(db);
    
    // Process all debts in the group
    debtsSnap.forEach(debtDoc => {
      const debtRef = doc(db, 'users', userId, 'debts', debtDoc.id);
      
      if (keepDebts) {
        // Just remove groupId reference
        batch.update(debtRef, { 
          groupId: null,
          updatedAt: new Date().toISOString()
        });
      } else {
        // Delete the debt entirely
        batch.delete(debtRef);
      }
    });
    
    // Delete the group
    const groupRef = doc(db, 'users', userId, 'debtGroups', groupId);
    batch.delete(groupRef);
    
    // Commit the batch
    await batch.commit();
    
    console.log(`Debt group ${groupId} deleted, debts ${keepDebts ? 'kept' : 'deleted'}`);
  } catch (error) {
    console.error('Error deleting debt group:', error);
    throw error;
  }
};

/**
 * Get all debt groups for a user
 * @param {string} userId - ID of the user who is owed money
 * @returns {Promise<Array>} - Array of debt groups
 */
export const getDebtGroups = async (userId) => {
  try {
    if (!userId) {
      throw new Error('userId is required');
    }
    
    const userGroupsRef = collection(db, 'users', userId, 'debtGroups');
    const q = query(userGroupsRef, orderBy('createdAt', 'desc'));
    
    const querySnapshot = await getDocs(q);
    const groups = [];
    
    querySnapshot.forEach((doc) => {
      groups.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return groups;
  } catch (error) {
    console.error('Error getting debt groups:', error);
    throw error;
  }
};

/**
 * Get a specific debt group with its debts
 * @param {string} userId - ID of the user who is owed money
 * @param {string} groupId - ID of the debt group
 * @returns {Promise<Object>} - Debt group with array of debts
 */
export const getDebtGroupWithDebts = async (userId, groupId) => {
  try {
    if (!userId || !groupId) {
      throw new Error('userId and groupId are required');
    }
    
    // Get the group
    const groupRef = doc(db, 'users', userId, 'debtGroups', groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
      throw new Error(`Debt group ${groupId} not found`);
    }
    
    const groupData = {
      id: groupSnap.id,
      ...groupSnap.data()
    };
    
    // Get all debts in the group
    const userDebtsRef = collection(db, 'users', userId, 'debts');
    const debtsQuery = query(userDebtsRef, where('groupId', '==', groupId));
    const debtsSnap = await getDocs(debtsQuery);
    
    const debts = [];
    debtsSnap.forEach(doc => {
      debts.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Add debts to group data
    groupData.debts = debts;
    
    return groupData;
  } catch (error) {
    console.error('Error getting debt group with debts:', error);
    throw error;
  }
};

/**
 * Cancel a recurring debt series
 * @param {string} userId - ID of the user who is owed money
 * @param {string} recurringId - ID of the recurring debt to cancel
 * @returns {Promise<void>}
 */
export const cancelRecurringDebt = async (userId, recurringId) => {
  try {
    if (!userId || !recurringId) {
      throw new Error('userId and recurringId are required');
    }
    
    console.log(`Canceling recurring debt ${recurringId} for user ${userId}`);
    const recurringRef = doc(db, 'users', userId, 'recurringDebts', recurringId);
    const now = new Date().toISOString();
    
    // Mark the recurring debt as inactive
    await updateDoc(recurringRef, {
      isActive: false,
      updatedAt: now
    });
    
    console.log(`Recurring debt ${recurringId} marked as inactive`);
  } catch (error) {
    console.error('Error canceling recurring debt:', error);
    throw error;
  }
};

/**
 * Get all recurring debts for a user
 * @param {string} userId - ID of the user
 * @returns {Promise<Array>} - Array of recurring debt documents
 */
export const fetchRecurringDebts = async (userId) => {
  try {
    if (!userId) {
      console.warn('fetchRecurringDebts called without a userId');
      return [];
    }
    
    console.log(`Fetching recurring debts for user: ${userId}`);
    
    // Get all recurring debts for the user
    const recurringDebtsRef = collection(db, 'users', userId, 'recurringDebts');
    const q = query(recurringDebtsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    console.log(`Query returned ${querySnapshot.size} recurring debt documents`);
    
    const recurringDebts = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`Recurring debt document ${doc.id}:`, data);
      recurringDebts.push({
        id: doc.id,
        ...data,
      });
    });
    
    return recurringDebts;
  } catch (error) {
    console.error('Error fetching recurring debts:', error);
    throw error;
  }
 };

/**
 * Get a recurring debt template by ID
 * @param {string} userId - ID of the user
 * @param {string} recurringId - ID of the recurring debt template
 * @returns {Promise<Object|null>} - Recurring debt template or null if not found
 */
export const getRecurringDebtById = async (userId, recurringId) => {
  try {
    if (!userId || !recurringId) {
      console.warn('getRecurringDebtById called without required parameters');
      return null;
    }
    
    console.log(`Fetching recurring debt template ${recurringId} for user ${userId}`);
    
    // Get the recurring debt document
    const recurringRef = doc(db, 'users', userId, 'recurringDebts', recurringId);
    const docSnap = await getDoc(recurringRef);
    
    if (!docSnap.exists()) {
      console.log(`Recurring debt template ${recurringId} not found`);
      return null;
    }
    
    const recurringDebt = {
      id: docSnap.id,
      ...docSnap.data()
    };
    
    return recurringDebt;
  } catch (error) {
    console.error('Error fetching recurring debt template:', error);
    throw error;
  }
}; 