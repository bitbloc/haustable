-- Seed Stock Categories
-- Updates existing categories or inserts new ones.

INSERT INTO public.stock_categories (id, label, icon, sort_order) VALUES
('restock', 'ต้องเติม (Restock)', '⚠️', 0),
('bar', 'บาร์ (Bar)', '🍸', 5),
('meat', 'เนื้อสัตว์ (Meat)', '🥩', 10),
('veg', 'ผัก (Veg)', '🥬', 15),
('sauce', 'ซอส/เครื่องปรุง (Sauce)', '🧂', 20),
('dry', 'ของแห้ง (Dry)', '🥫', 25),
('curry', 'พริกแกง (Curry)', '🥘', 30),
('frozen', 'อาหารแช่แข็ง (Frozen)', '❄️', 35),
('oil', 'น้ำมัน (Oil)', '🛢️', 40),
('soup', 'ซุป/สต็อก (Soup)', '🍲', 45),
('preserved', 'ของหมักดอง (Pickled)', '🏺', 50),
('packaging', 'บรรจุภัณฑ์ (Packaging)', '📦', 55),
('supplies', 'ของใช้ในครัว (Supplies)', '🧽', 60),
('other', 'อื่นๆ (Other)', '🔖', 99)
ON CONFLICT (id) DO UPDATE 
SET label = EXCLUDED.label, 
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order;
