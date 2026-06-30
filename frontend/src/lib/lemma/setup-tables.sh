#!/usr/bin/env bash
# Run this after creating a Lemma pod and selecting it:
#   lemma auth login
#   lemma pod create career-os --with-starter
#   lemma pods select career-os --save-default
#
# Then run: bash src/lib/lemma/setup-tables.sh

POD_ID=$(lemma pod list --json 2>/dev/null | grep '"id"' | head -1 | sed 's/.*"id": "\(.*\)",/\1/')
if [ -z "$POD_ID" ]; then
  echo "No pod found. Create one first: lemma pod create career-os --with-starter"
  exit 1
fi

echo "Creating tables in pod: $POD_ID"

# Create applications table
lemma table create \
  --pod-id "$POD_ID" \
  --payload-file "$(dirname "$0")/tables/applications.json" \
  --name "Applications" \
  --slug "applications" 2>/dev/null || \
  echo "  → applications table already exists"

# Create profiles table
lemma table create \
  --pod-id "$POD_ID" \
  --name "Profiles" \
  --slug "profiles" 2>/dev/null || \
  echo "  → profiles table already exists"

# Create chat_messages table
lemma table create \
  --pod-id "$POD_ID" \
  --name "Chat Messages" \
  --slug "chat_messages" 2>/dev/null || \
  echo "  → chat_messages table already exists"

echo ""
echo "Done! Set these env vars in .env.local:"
echo "  NEXT_PUBLIC_LEMMA_POD_ID=$POD_ID"
echo "  NEXT_PUBLIC_LEMMA_API_URL=https://api.lemma.work"
echo "  NEXT_PUBLIC_LEMMA_AUTH_URL=https://lemma.work/auth"
