#!/bin/bash

# Automated Staging Environment Setup
# This script helps you quickly set up and configure the staging Firebase project

set -e

echo "🚀 IIFT Delhi Placement Management - Staging Setup"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Check Firebase CLI
echo "${BLUE}Step 1: Checking Firebase CLI...${NC}"
if ! command -v firebase &> /dev/null; then
    echo "${RED}Firebase CLI not installed. Install with:${NC}"
    echo "npm install -g firebase-tools"
    exit 1
fi
echo "${GREEN}✓ Firebase CLI found${NC}"
echo ""

# Step 2: Check authentication
echo "${BLUE}Step 2: Checking Firebase authentication...${NC}"
if ! firebase projects:list &> /dev/null; then
    echo "${YELLOW}Not authenticated. Running: firebase login${NC}"
    firebase login
fi
echo "${GREEN}✓ Firebase authenticated${NC}"
echo ""

# Step 3: Show manual project creation steps
echo "${BLUE}Step 3: Create Staging Project (Manual)${NC}"
echo ""
echo "Since automated project creation requires special permissions,"
echo "please create the project manually:"
echo ""
echo "  1. Go to: ${BLUE}https://console.firebase.google.com/${NC}"
echo "  2. Click: ${YELLOW}'+ Add project'${NC}"
echo "  3. Project name: ${YELLOW}placement-mgmt-staging${NC}"
echo "  4. Uncheck: Google Analytics (optional)"
echo "  5. Click: ${YELLOW}'Create project'${NC}"
echo "  6. Wait for project to be created (~1 min)"
echo ""
echo "Once created, press ENTER to continue..."
read -r

echo ""
echo "${BLUE}Step 4: Get Staging Project Credentials${NC}"
echo ""
echo "Follow these steps to get your staging credentials:"
echo ""
echo "  1. In Firebase Console, make sure you're in ${YELLOW}placement-mgmt-staging${NC} project"
echo "  2. Click: ${YELLOW}⚙️  Project Settings${NC} (top-left)"
echo "  3. Go to: ${YELLOW}Your apps${NC} tab"
echo "  4. Look for a web app (or click ${YELLOW}'+ Add app'${NC} → ${YELLOW}'Web'${NC})"
echo "  5. Click the app to view configuration"
echo "  6. Copy the entire config object under ${YELLOW}'firebaseConfig'${NC}"
echo ""
echo "Your config will look like:"
echo "${YELLOW}const firebaseConfig = {"
echo "  apiKey: 'xxx',"
echo "  authDomain: 'xxx',"
echo "  projectId: 'xxx',"
echo "  storageBucket: 'xxx',"
echo "  messagingSenderId: 'xxx',"
echo "  appId: 'xxx',"
echo "  measurementId: 'xxx'"
echo "}${NC}"
echo ""
echo "When ready, press ENTER to input your credentials..."
read -r

echo ""
echo "${BLUE}Step 5: Input Staging Credentials${NC}"
echo ""
echo "Enter your staging Firebase credentials:"
echo ""

read -p "API Key: " API_KEY
read -p "Auth Domain: " AUTH_DOMAIN
read -p "Project ID: " PROJECT_ID
read -p "Storage Bucket: " STORAGE_BUCKET
read -p "Messaging Sender ID: " MESSAGING_SENDER_ID
read -p "App ID: " APP_ID
read -p "Measurement ID (optional): " MEASUREMENT_ID

# Update firebase.js with credentials
echo ""
echo "${BLUE}Step 6: Updating firebase.js...${NC}"

cat > src/lib/firebase.js << 'EOF'
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Production Firebase Config
const productionConfig = {
  apiKey: "AIzaSyDeO8mQsjs0C2fzlNkC4QZ2GYZUFBL4Oic",
  authDomain: "placement-management-6133f.firebaseapp.com",
  projectId: "placement-management-6133f",
  storageBucket: "placement-management-6133f.firebasestorage.app",
  messagingSenderId: "123326226580",
  appId: "1:123326226580:web:66f55b2451bd4d52db9481",
  measurementId: "G-X7GEBWP384"
};

// Staging Firebase Config
const stagingConfig = {
  apiKey: "STAGING_API_KEY",
  authDomain: "STAGING_AUTH_DOMAIN",
  projectId: "STAGING_PROJECT_ID",
  storageBucket: "STAGING_STORAGE_BUCKET",
  messagingSenderId: "STAGING_MESSAGING_SENDER_ID",
  appId: "STAGING_APP_ID",
  measurementId: "STAGING_MEASUREMENT_ID"
};

// Select environment based on NODE_ENV
const firebaseConfig = process.env.NODE_ENV === 'production' ? productionConfig : stagingConfig;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'staging';
EOF

# Replace placeholders
sed -i '' "s|STAGING_API_KEY|$API_KEY|g" src/lib/firebase.js
sed -i '' "s|STAGING_AUTH_DOMAIN|$AUTH_DOMAIN|g" src/lib/firebase.js
sed -i '' "s|STAGING_PROJECT_ID|$PROJECT_ID|g" src/lib/firebase.js
sed -i '' "s|STAGING_STORAGE_BUCKET|$STORAGE_BUCKET|g" src/lib/firebase.js
sed -i '' "s|STAGING_MESSAGING_SENDER_ID|$MESSAGING_SENDER_ID|g" src/lib/firebase.js
sed -i '' "s|STAGING_APP_ID|$APP_ID|g" src/lib/firebase.js
sed -i '' "s|STAGING_MEASUREMENT_ID|$MEASUREMENT_ID|g" src/lib/firebase.js

echo "${GREEN}✓ firebase.js updated${NC}"
echo ""

# Step 7: Update .firebaserc
echo "${BLUE}Step 7: Updating .firebaserc...${NC}"

cat > .firebaserc << EOF
{
  "projects": {
    "staging": "$PROJECT_ID",
    "production": "placement-management-6133f"
  },
  "targets": {},
  "etags": {}
}
EOF

echo "${GREEN}✓ .firebaserc updated${NC}"
echo ""

# Step 8: Deploy Firestore Rules to Staging
echo "${BLUE}Step 8: Deploy Firestore Rules${NC}"
echo ""
echo "Choose which project to deploy rules to:"
echo "  1. Staging only"
echo "  2. Production only"
echo "  3. Both"
echo "  4. Skip for now"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo "Deploying to staging..."
        firebase deploy --only firestore:rules --project staging
        ;;
    2)
        echo "Deploying to production..."
        firebase deploy --only firestore:rules --project production
        ;;
    3)
        echo "Deploying to staging..."
        firebase deploy --only firestore:rules --project staging
        echo "Deploying to production..."
        firebase deploy --only firestore:rules --project production
        ;;
    *)
        echo "Skipped deployment"
        ;;
esac

echo ""
echo "${BLUE}Step 9: Enable TTL Policy (Manual)${NC}"
echo ""
echo "⚠️  Important: You must enable Firestore TTL Policy manually"
echo ""
echo "  1. Go to: ${BLUE}https://console.firebase.google.com/${NC}"
echo "  2. Select: ${YELLOW}placement-mgmt-staging${NC} project"
echo "  3. Go to: ${YELLOW}Firestore Database${NC} → ${YELLOW}Settings${NC}}"
echo "  4. Find: ${YELLOW}TTL Policy${NC}} section"
echo "  5. Click: ${YELLOW}'Create Policy'${NC}}"
echo "  6. TTL field: ${YELLOW}__expiresAt${NC}}"
echo "  7. Collection: (leave empty for all collections)"
echo "  8. Click: ${YELLOW}'Save'${NC}}"
echo ""

echo ""
echo "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "📚 Next steps:"
echo "  • Test staging: ${YELLOW}npm run dev${NC}}"
echo "  • Build production: ${YELLOW}npm run build -- --mode production${NC}}"
echo "  • Build staging: ${YELLOW}npm run build -- --mode staging${NC}}"
echo ""
echo "For detailed info, see: ${YELLOW}STAGING_SETUP.md${NC}}"
echo ""
