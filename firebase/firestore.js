import { collection, getDocs, doc, getDoc, query, where, orderBy, limit, addDoc, updateDoc, deleteDoc, Timestamp, setDoc } from 'firebase/firestore';
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
 * @returns {Promise<Object>} - Created debt with ID
 */
export const createDebt = async (userId, { debtorName, amount, description = '' }) => {
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
      createdAt: now,
      updatedAt: now,
      isPaid: false,
      userId: String(userId)
    };
    
    console.log('Debt data being saved:', debtData);
    const docRef = await addDoc(userDebtsRef, debtData);
    console.log(`Debt created with ID: ${docRef.id}`);
    
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
 * @returns {Promise<void>}
 */
export const markDebtAsPaid = async (userId, debtId) => {
  try {
    const debtRef = doc(db, 'users', userId, 'debts', debtId);
    const now = new Date().toISOString();
    
    await updateDoc(debtRef, {
      isPaid: true,
      paidAt: now,
      updatedAt: now,
    });
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
    await deleteDoc(debtRef);
  } catch (error) {
    console.error('Error deleting debt:', error);
    throw error;
  }
}; 