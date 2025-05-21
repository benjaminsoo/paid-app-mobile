/**
 * Firebase Cloud Functions for Paid App
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase admin
admin.initializeApp();

/**
 * Scheduled function that runs daily to generate recurring debt instances
 */
exports.generateRecurringDebts = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const db = admin.firestore();
    const today = new Date();
    const now = today.toISOString();
    console.log(`Running recurring debt generation at ${now}`);
    
    try {
      // Process individual recurring debts
      await processRecurringDebts(db, today, now);
      
      // Process recurring debt groups
      await processRecurringGroups(db, today, now);
      
      return { success: true };
    } catch (error) {
      console.error('Error in generateRecurringDebts function:', error);
      throw error;
    }
  });

/**
 * Process individual recurring debts
 */
async function processRecurringDebts(db, today, now) {
  try {
    // Get all active recurring debts where nextGenerationDate <= today
    const recurringDebtsQuery = db.collectionGroup('recurringDebts')
      .where('isActive', '==', true)
      .where('nextGenerationDate', '<=', now);
    
    const recurringDebtsSnapshot = await recurringDebtsQuery.get();
    console.log(`Found ${recurringDebtsSnapshot.size} recurring debts to process`);
    
    // Process each recurring debt
    const batch = db.batch();
    const generatedDebts = [];
    
    for (const doc of recurringDebtsSnapshot.docs) {
      const recurringDebt = doc.data();
      const docPath = doc.ref.path;
      const userId = recurringDebt.userId;
      
      console.log(`Processing recurring debt ${doc.id} for user ${userId}`);
      
      // Check if we've reached the end date
      if (recurringDebt.endDate && new Date(recurringDebt.endDate) <= today) {
        console.log(`Recurring debt ${doc.id} has reached its end date, marking as inactive`);
        batch.update(doc.ref, { 
          isActive: false,
          updatedAt: now
        });
        continue;
      }
      
      // Generate the next instance
      try {
        // Create new debt document
        const newDebtRef = db.collection(`users/${userId}/debts`).doc();
        const instanceIndex = (recurringDebt.generatedDebtIds || []).length;
        
        const newDebt = {
          debtorName: recurringDebt.debtorName,
          amount: recurringDebt.amount,
          description: recurringDebt.description,
          phoneNumber: recurringDebt.phoneNumber || '',
          createdAt: now,
          updatedAt: now,
          isPaid: false,
          userId: userId,
          isRecurring: true,
          recurringId: doc.id,
          recurringInstanceIndex: instanceIndex
        };
        
        // Add groupId if present in the recurring template
        if (recurringDebt.groupId) {
          newDebt.groupId = recurringDebt.groupId;
        }
        
        batch.set(newDebtRef, newDebt);
        generatedDebts.push({
          id: newDebtRef.id,
          userId,
          recurringId: doc.id,
          amount: recurringDebt.amount
        });
        
        // Use current nextGenerationDate as the reference point for the next generation
        // This ensures we follow the original schedule based on the start date
        const currentNext = new Date(recurringDebt.nextGenerationDate);
        
        // Calculate next generation date based on frequency
        switch (recurringDebt.frequency) {
          case 'daily':
            currentNext.setDate(currentNext.getDate() + 1);
            break;
          case 'weekly':
            currentNext.setDate(currentNext.getDate() + 7);
            break;
          case 'biweekly':
            currentNext.setDate(currentNext.getDate() + 14);
            break;
          case 'monthly':
            currentNext.setMonth(currentNext.getMonth() + 1);
            break;
          case 'quarterly':
            currentNext.setMonth(currentNext.getMonth() + 3);
            break;
          case 'yearly':
            currentNext.setFullYear(currentNext.getFullYear() + 1);
            break;
        }
        
        batch.update(doc.ref, {
          lastGeneratedDate: now,
          nextGenerationDate: currentNext.toISOString(),
          generatedDebtIds: admin.firestore.FieldValue.arrayUnion(newDebtRef.id),
          updatedAt: now
        });
        
      } catch (err) {
        console.error(`Error generating debt instance for recurring debt ${doc.id}:`, err);
      }
    }
    
    // Commit the batch
    await batch.commit();
    console.log(`Generated ${generatedDebts.length} new debt instances`);
    
    // Update group totals for group debts
    for (const debt of generatedDebts) {
      try {
        const debtDoc = await db.collection(`users/${debt.userId}/debts`).doc(debt.id).get();
        const debtData = debtDoc.data();
        
        if (debtData.groupId) {
          // Update the group's totals
          console.log(`Updating group ${debtData.groupId} for new debt ${debt.id}`);
          
          const groupRef = db.collection(`users/${debt.userId}/debtGroups`).doc(debtData.groupId);
          await groupRef.update({
            updatedAt: now,
            totalAmount: admin.firestore.FieldValue.increment(debt.amount),
            debtIds: admin.firestore.FieldValue.arrayUnion(debt.id)
          });
        }
      } catch (err) {
        console.error(`Error updating group for debt ${debt.id}:`, err);
      }
    }
    
    return { processed: generatedDebts.length };
  } catch (error) {
    console.error('Error processing recurring debts:', error);
    throw error;
  }
}

/**
 * Process recurring debt groups
 */
async function processRecurringGroups(db, today, now) {
  try {
    // Get all active recurring debt groups where nextGenerationDate <= today
    const recurringGroupsQuery = db.collectionGroup('debtGroups')
      .where('isActive', '==', true)
      .where('isRecurring', '==', true)
      .where('nextGenerationDate', '<=', now);
    
    const recurringGroupsSnapshot = await recurringGroupsQuery.get();
    console.log(`Found ${recurringGroupsSnapshot.size} recurring groups to process`);
    
    // Process each recurring group
    const generatedGroups = [];
    
    for (const doc of recurringGroupsSnapshot.docs) {
      const recurringGroup = doc.data();
      const userId = recurringGroup.userId;
      
      console.log(`Processing recurring group ${doc.id} for user ${userId}`);
      
      // Check if we've reached the end date
      if (recurringGroup.endDate && new Date(recurringGroup.endDate) <= today) {
        console.log(`Recurring group ${doc.id} has reached its end date, marking as inactive`);
        await doc.ref.update({ 
          isActive: false,
          updatedAt: now
        });
        continue;
      }
      
      try {
        // Get all debts in this group
        const debtsQuery = db.collection(`users/${userId}/debts`)
          .where('groupId', '==', doc.id);
        const debtsSnapshot = await debtsQuery.get();
        
        // Create a new group as the recurring instance
        const newGroupRef = db.collection(`users/${userId}/debtGroups`).doc();
        const instanceIndex = (recurringGroup.generatedGroupIds || []).length;
        
        const newGroup = {
          name: recurringGroup.name,
          description: recurringGroup.description || '',
          createdAt: now,
          updatedAt: now,
          isCompleted: false,
          totalAmount: 0,
          paidAmount: 0,
          debtIds: [],
          userId: userId,
          isRecurring: true,
          recurringId: doc.id,
          recurringInstanceIndex: instanceIndex
        };
        
        // Add the new group
        await newGroupRef.set(newGroup);
        
        // Add all debts to the new group
        const batch = db.batch();
        let totalAmount = 0;
        
        for (const debtDoc of debtsSnapshot.docs) {
          const debt = debtDoc.data();
          
          // Create a new debt for this instance
          const newDebtRef = db.collection(`users/${userId}/debts`).doc();
          const newDebt = {
            debtorName: debt.debtorName,
            amount: debt.amount,
            description: debt.description || '',
            phoneNumber: debt.phoneNumber || '',
            createdAt: now,
            updatedAt: now,
            isPaid: false,
            userId: userId,
            groupId: newGroupRef.id,
            isRecurring: true,
            recurringId: doc.id,
            recurringInstanceIndex: instanceIndex
          };
          
          batch.set(newDebtRef, newDebt);
          totalAmount += debt.amount;
        }
        
        // Update the new group with the correct total amount and debt IDs
        batch.update(newGroupRef, {
          totalAmount: totalAmount
        });
        
        // Use current nextGenerationDate as the reference point for the next generation
        // This ensures we follow the original schedule based on the start date
        const currentNext = new Date(recurringGroup.nextGenerationDate);
        
        // Calculate next generation date based on frequency
        switch (recurringGroup.frequency) {
          case 'daily':
            currentNext.setDate(currentNext.getDate() + 1);
            break;
          case 'weekly':
            currentNext.setDate(currentNext.getDate() + 7);
            break;
          case 'biweekly':
            currentNext.setDate(currentNext.getDate() + 14);
            break;
          case 'monthly':
            currentNext.setMonth(currentNext.getMonth() + 1);
            break;
          case 'quarterly':
            currentNext.setMonth(currentNext.getMonth() + 3);
            break;
          case 'yearly':
            currentNext.setFullYear(currentNext.getFullYear() + 1);
            break;
        }
        
        batch.update(doc.ref, {
          lastGeneratedDate: now,
          nextGenerationDate: currentNext.toISOString(),
          generatedGroupIds: admin.firestore.FieldValue.arrayUnion(newGroupRef.id),
          updatedAt: now
        });
        
        // Commit all the changes
        await batch.commit();
        
        generatedGroups.push({
          id: newGroupRef.id,
          userId,
          recurringId: doc.id,
          name: recurringGroup.name
        });
        
      } catch (err) {
        console.error(`Error generating group instance for recurring group ${doc.id}:`, err);
      }
    }
    
    console.log(`Generated ${generatedGroups.length} new group instances`);
    return { processed: generatedGroups.length };
    
  } catch (error) {
    console.error('Error processing recurring groups:', error);
    throw error;
  }
} 