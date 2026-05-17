/**
 * Example: Using TTL in Data Operations
 * 
 * This file shows how to use the TTL utility when creating documents
 * in the staging environment.
 */

import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db, ENVIRONMENT } from './firebase';
import { withTTL } from './firestoreTTL';

/**
 * Example 1: Create a student document with TTL in staging
 */
export async function createStudentWithTTL(studentData) {
  const isStaging = ENVIRONMENT === 'staging';
  
  const dataWithTTL = withTTL(
    {
      ...studentData,
      createdAt: new Date(),
      environment: ENVIRONMENT,
    },
    isStaging
  );
  
  await setDoc(doc(db, 'students', studentData.id), dataWithTTL);
}

/**
 * Example 2: Add a pending change with TTL in staging
 */
export async function createPendingChangeWithTTL(changeData) {
  const isStaging = ENVIRONMENT === 'staging';
  
  const dataWithTTL = withTTL(
    {
      ...changeData,
      timestamp: new Date(),
      status: 'pending',
    },
    isStaging
  );
  
  const docRef = await addDoc(collection(db, 'pendingChanges'), dataWithTTL);
  return docRef.id;
}

/**
 * Example 3: Create batch operation with TTL
 */
export async function createAuditLogWithTTL(batch, logData) {
  const isStaging = ENVIRONMENT === 'staging';
  
  const dataWithTTL = withTTL(
    {
      ...logData,
      timestamp: new Date(),
    },
    isStaging
  );
  
  const docRef = doc(collection(db, 'auditLog'));
  batch.set(docRef, dataWithTTL);
  return docRef;
}

/**
 * Best Practices:
 * 
 * ✅ DO:
 * - Always use withTTL() when creating new documents in any collection
 * - Include environment indicator in the document for debugging
 * - Test TTL by creating documents and checking their expiry date
 * 
 * ❌ DON'T:
 * - Manually set __expiresAt field (use withTTL utility instead)
 * - Forget to update TTL policy in Firebase Console
 * - Mix staging and production data (separate projects handle this)
 * 
 * 🧪 Testing TTL:
 * - Create a test document in staging
 * - Check Firestore Console → Document details
 * - Verify __expiresAt field shows ~30 days from now
 * - After 30 days, document should be auto-deleted
 */
