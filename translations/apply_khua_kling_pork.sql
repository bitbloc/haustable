-- Owner confirmed (2026-11-16): Khua Kling is made with good-grade minced pork.
-- Names the protein in the Chinese, Lao and English text of the dish (id 10) and of the
-- three sets that include it (147, 148, 143). Thai columns are not touched.
BEGIN;

UPDATE public.menu_items SET
    name_zh = replace(name_zh, '咖喱肉末', '咖喱猪肉末'),
    description_zh = replace(description_zh, '咖喱肉末', '咖喱猪肉末'),
    name_lo = replace(name_lo, 'ຄົ່ວກິ້ງກັບຜັກສົດ', 'ຄົ່ວກິ້ງໝູສັບກັບຜັກສົດ'),
    description_lo = replace(description_lo, 'ຄົ່ວກິ້ງກັບຜັກສົດ', 'ຄົ່ວກິ້ງໝູສັບກັບຜັກສົດ')
WHERE id IN (10, 147, 148, 143);

UPDATE public.menu_items SET
    description_zh = '泰南风味干炒咖喱优质猪肉末，加新鲜香草，配生鲜蔬菜。辣。',
    description_lo = 'ຊີ້ນໝູສັບເກຣດດີຂົ້ວແຫ້ງກັບເຄື່ອງແກງປັກໃຕ້ ແລະ ສະໝຸນໄພສົດ ເສີບພ້ອມຜັກສົດ. ເຜັດ.',
    description_en = 'Southern-style dry curry of good-grade minced pork with fresh herbs, served with fresh vegetables on the side. Spicy.'
WHERE id = 10;

COMMIT;
