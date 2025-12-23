#!/bin/bash

# Ensure we are in the project root
echo "Deploying 'send-web-push' Edge Function..."

# Deploy the function
# --no-verify-jwt is used because we handle auth inside or ignore it for server-side calls with service key
npx supabase functions deploy send-web-push --no-verify-jwt

echo "Deployment complete! Make sure you have run 'npx supabase login' beforehand."
