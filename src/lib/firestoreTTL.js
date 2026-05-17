/**
 * Firestore TTL (Time-To-Live) Utilities for Staging Environment
 * Automatically deletes documents after 1 month in staging
 */

import { serverTimestamp } from "firebase/firestore";

/**
 * Add TTL to a document for staging environment
 * TTL of 30 days = 2592000 seconds
 */
export const ADD_TTL_DAYS = 30;
export const TTL_MILLISECONDS = ADD_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Create TTL timestamp for a document
 * Returns expiry time as a Date object (30 days from now)
 * @returns {Date} Expiry timestamp
 */
export const getTTLTimestamp = () => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + ADD_TTL_DAYS);
  return expiryDate;
};

/**
 * Prepare a document with TTL field for staging
 * @param {Object} data - Document data
 * @param {boolean} isStaging - Whether this is staging environment
 * @returns {Object} Document data with TTL field if staging
 */
export const withTTL = (data, isStaging = false) => {
  if (!isStaging) return data;
  
  return {
    ...data,
    __expiresAt: getTTLTimestamp()
  };
};

/**
 * Check if document is expired
 * @param {Object} doc - Firestore document
 * @returns {boolean} True if document has expired
 */
export const isDocumentExpired = (doc) => {
  if (!doc.__expiresAt) return false;
  const expiresAt = new Date(doc.__expiresAt);
  return new Date() > expiresAt;
};
