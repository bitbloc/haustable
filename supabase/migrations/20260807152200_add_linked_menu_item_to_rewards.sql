-- Add linked_menu_item_id to xhaus_rewards to support auto-injecting items on reward redemption
ALTER TABLE xhaus_rewards ADD COLUMN IF NOT EXISTS linked_menu_item_id BIGINT REFERENCES menu_items(id) ON DELETE SET NULL;
