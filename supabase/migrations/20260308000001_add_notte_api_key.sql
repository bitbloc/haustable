-- Insert the Notte API Key into the app_settings table
INSERT INTO public.app_settings (key, value)
VALUES ('notte_api_key', 'sk-notte-2b49a0a17e09ebabc1a0a5665efd6925f704bcef401a2ae43f9e1f227033671a')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
