#!/bin/bash

# Ensure we are in the project root
echo "Deploying 'send-web-push' Edge Function..."

# Deploy functions
# --no-verify-jwt is used because we handle auth inside or ignore it for server-side calls with service key
echo "Deploying Edge Functions..."
npx supabase functions deploy get-tracking-info --project-ref lxfavbzmebqqsffgyyph --no-verify-jwt
npx supabase functions deploy manage-booking --project-ref lxfavbzmebqqsffgyyph --no-verify-jwt
npx supabase functions deploy send-line-push --project-ref lxfavbzmebqqsffgyyph --no-verify-jwt
npx supabase functions deploy send-web-push --project-ref lxfavbzmebqqsffgyyph --no-verify-jwt

echo "Deployment complete! Make sure you have run 'npx supabase login' beforehand."
