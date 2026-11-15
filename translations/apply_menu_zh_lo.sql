-- Chinese and Lao display names for the customer menu. Fills name_zh / name_lo
-- (+ description_zh / description_lo on menu_items). Thai and English columns are not touched.
BEGIN;
UPDATE public.menu_items SET name_zh = '套餐：日式酱汁低温慢煮猪肉饭 + 饮品', name_lo = 'ຊຸດ: ເຂົ້າຊອດຍີ່ປຸ່ນໝູຊູວີ + ເຄື່ອງດື່ມ', description_zh = '原价 214 泰铢，套餐价 189 泰铢。
可从指定饮品中任选。', description_lo = 'ປົກກະຕິ 214 ບາດ, ສັ່ງເປັນຊຸດເຫຼືອ 189 ບາດ.
ເລືອກເຄື່ອງດື່ມທີ່ກຳນົດໄວ້ໄດ້.' WHERE id = 116;
UPDATE public.menu_items SET name_zh = '套餐：泰式酸辣烤猪肉饭（Nam Tok）+ 饮品', name_lo = 'ຊຸດ: ເຂົ້າໝູຕົກເຕົາ (ນ້ຳຕົກໝູ) + ເຄື່ອງດື່ມ', description_zh = '原价 174 泰铢，套餐价 149 泰铢。
可从指定饮品中任选。', description_lo = 'ປົກກະຕິ 174 ບາດ, ສັ່ງເປັນຊຸດເຫຼືອ 149 ບາດ.
ເລືອກເຄື່ອງດື່ມທີ່ກຳນົດໄວ້ໄດ້.' WHERE id = 114;
UPDATE public.menu_items SET name_zh = '套餐：招牌烤猪颈肉饭 + 饮品', name_lo = 'ຊຸດ: ເຂົ້າຄໍໝູປີ້ງສູດເຮືອນ + ເຄື່ອງດື່ມ', description_zh = '原价 174 泰铢，套餐价 149 泰铢。
可从指定饮品中任选。', description_lo = 'ປົກກະຕິ 174 ບາດ, ສັ່ງເປັນຊຸດເຫຼືອ 149 ບາດ.
ເລືອກເຄື່ອງດື່ມທີ່ກຳນົດໄວ້ໄດ້.' WHERE id = 115;
UPDATE public.menu_items SET name_zh = 'L 套餐（2-4 人）泰南风味套餐：臭豆炒虾 • 泰南鱼内脏咖喱 • 干炒咖喱猪肉末配鲜蔬（Khua Kling） • 米饭 1 钵', name_lo = 'ຊຸດ L ສຳລັບ 2-4 ຄົນ ຊຸດລົດຊາດປັກໃຕ້: ສະຕໍຂົ້ວກຸ້ງ • ແກງໄຕປາ • ຄົ່ວກິ້ງໝູສັບກັບຜັກສົດ • ເຂົ້າຈ້າວ 1 ໂຖ', description_zh = '臭豆炒虾 • 泰南鱼内脏咖喱 • 干炒咖喱猪肉末配鲜蔬（Khua Kling） • 米饭 1 钵', description_lo = 'ສະຕໍຂົ້ວກຸ້ງ • ແກງໄຕປາ • ຄົ່ວກິ້ງໝູສັບກັບຜັກສົດ • ເຂົ້າຈ້າວ 1 ໂຖ' WHERE id = 147;
UPDATE public.menu_items SET name_zh = 'L 套餐（2-4 人）：Tom Jiw 酸辣清汤 • 招牌烤猪颈肉 • 炒良叶（泰南野菜） • 米饭 1 钵', name_lo = 'ຊຸດ L ສຳລັບ 2-4 ຄົນ: ຕົ້ມຈິ໋ວ • ຄໍໝູປີ້ງສູດເຮືອນ • ຂົ້ວໃບຫຼຽງ • ເຂົ້າຈ້າວ 1 ໂຖ', description_zh = 'Tom Jiw 酸辣清汤 • 招牌烤猪颈肉 • 炒良叶（泰南野菜） • 米饭 1 钵', description_lo = 'ຕົ້ມຈິ໋ວ • ຄໍໝູປີ້ງສູດເຮືອນ • ຂົ້ວໃບຫຼຽງ • ເຂົ້າຈ້າວ 1 ໂຖ' WHERE id = 141;
UPDATE public.menu_items SET name_zh = 'XL 套餐（4-6 人）泰南重口味套餐：臭豆炒虾 • 泰南鱼内脏咖喱 • 干炒咖喱猪肉末配鲜蔬（Khua Kling） • 泰南虾酱甜猪肉 • 炒良叶（泰南野菜） • 酸咖喱虾配酸笋 • 米饭 2 钵', name_lo = 'ຊຸດ XL ສຳລັບ 4-6 ຄົນ ຊຸດລົດຈັດປັກໃຕ້: ສະຕໍຂົ້ວກຸ້ງ • ແກງໄຕປາ • ຄົ່ວກິ້ງໝູສັບກັບຜັກສົດ • ໝູຫວານກະປິປັກໃຕ້ • ຂົ້ວໃບຫຼຽງ • ແກງສົ້ມກຸ້ງໜໍ່ໄມ້ສົ້ມ • ເຂົ້າຈ້າວ 2 ໂຖ', description_zh = '臭豆炒虾 • 泰南鱼内脏咖喱 • 干炒咖喱猪肉末配鲜蔬（Khua Kling） • 泰南虾酱甜猪肉 • 炒良叶（泰南野菜） • 酸咖喱虾配酸笋 • 米饭 2 钵', description_lo = 'ສະຕໍຂົ້ວກຸ້ງ • ແກງໄຕປາ • ຄົ່ວກິ້ງໝູສັບກັບຜັກສົດ • ໝູຫວານກະປິປັກໃຕ້ • ຂົ້ວໃບຫຼຽງ • ແກງສົ້ມກຸ້ງໜໍ່ໄມ້ສົ້ມ • ເຂົ້າຈ້າວ 2 ໂຖ' WHERE id = 148;
UPDATE public.menu_items SET name_zh = 'XL 套餐（4-6 人）家宴套餐：Tom Jiw 酸辣清汤 • 干炒咖喱猪肉末配鲜蔬（Khua Kling） • 泰南虾酱甜猪肉 • 招牌烤猪颈肉 • 炒良叶（泰南野菜） • 米饭 2 钵', name_lo = 'ຊຸດ XL ສຳລັບ 4-6 ຄົນ ຊຸດສຳຮັບເຮືອນ: ຕົ້ມຈິ໋ວ • ຄົ່ວກິ້ງໝູສັບກັບຜັກສົດ • ໝູຫວານກະປິປັກໃຕ້ • ຄໍໝູປີ້ງສູດເຮືອນ • ຂົ້ວໃບຫຼຽງ • ເຂົ້າຈ້າວ 2 ໂຖ', description_zh = 'Tom Jiw 酸辣清汤 • 干炒咖喱猪肉末配鲜蔬（Khua Kling） • 泰南虾酱甜猪肉 • 招牌烤猪颈肉 • 炒良叶（泰南野菜） • 米饭 2 钵', description_lo = 'ຕົ້ມຈິ໋ວ • ຄົ່ວກິ້ງໝູສັບກັບຜັກສົດ • ໝູຫວານກະປິປັກໃຕ້ • ຄໍໝູປີ້ງສູດເຮືອນ • ຂົ້ວໃບຫຼຽງ • ເຂົ້າຈ້າວ 2 ໂຖ' WHERE id = 143;
UPDATE public.menu_items SET name_zh = '鸡肉绿咖喱', name_lo = 'ແກງຂຽວຫວານໄກ່', description_zh = '经典泰式绿咖喱，配鸡肉、椰奶和泰国罗勒。', description_lo = 'ແກງຂຽວຫວານໄທແບບດັ້ງເດີມ ໃສ່ໄກ່ ນ້ຳກະທິ ແລະ ຜັກບົວລະພາ.' WHERE id = 108;
UPDATE public.menu_items SET name_zh = '牛腱绿咖喱', name_lo = 'ແກງຂຽວຫວານຊີ້ນງົວນ່ອງລາຍ', description_zh = '泰式绿咖喱，配慢炖牛腱。', description_lo = 'ແກງຂຽວຫວານໄທ ໃສ່ຊີ້ນງົວສ່ວນນ່ອງລາຍຕຸ໋ນຈົນເປື່ອຍ.' WHERE id = 107;
UPDATE public.menu_items SET name_zh = '泰南发酵鱼内脏咖喱（味道浓烈！）', name_lo = 'ແກງໄຕປາ (ລົດຊາດຈັດຈ້ານ!)', description_zh = '泰南重口味咖喱，用发酵鱼内脏加蔬菜和香草烹煮。非常辣，味道浓郁。', description_lo = 'ແກງປັກໃຕ້ລົດຈັດ ເຮັດຈາກໄຕປາ (ເຄື່ອງໃນປາໝັກ) ຜັກ ແລະ ສະໝຸນໄພ. ເຜັດຫຼາຍ ແລະ ລົດຊາດເຂັ້ມຂຸ້ນ.' WHERE id = 109;
UPDATE public.menu_items SET name_zh = '鸡肉玛莎曼咖喱', name_lo = 'ແກງມັດສະໝັ່ນໄກ່', description_zh = '口味温和、香料浓郁的玛莎曼咖喱，配鸡肉。', description_lo = 'ແກງມັດສະໝັ່ນລົດອ່ອນ ຫອມເຄື່ອງເທດ ໃສ່ໄກ່.' WHERE id = 106;
UPDATE public.menu_items SET name_zh = '牛腱玛莎曼咖喱', name_lo = 'ແກງມັດສະໝັ່ນຊີ້ນງົວນ່ອງລາຍ', description_zh = '口味温和、香料浓郁的玛莎曼咖喱，配慢炖牛腱。', description_lo = 'ແກງມັດສະໝັ່ນລົດອ່ອນ ຫອມເຄື່ອງເທດ ໃສ່ຊີ້ນງົວສ່ວນນ່ອງລາຍຕຸ໋ນຈົນເປື່ອຍ.' WHERE id = 110;
UPDATE public.menu_items SET name_zh = '泰南酸咖喱虾', name_lo = 'ແກງສົ້ມກຸ້ງ (ແບບປັກໃຕ້)', description_zh = '泰南酸咖喱虾，可选配酸笋或椰子芯。', description_lo = 'ແກງສົ້ມກຸ້ງແບບປັກໃຕ້ ເລືອກໃສ່ໜໍ່ໄມ້ສົ້ມ ຫຼື ຍອດໝາກພ້າວອ່ອນ.' WHERE id = 32;
UPDATE public.menu_items SET name_zh = '泰南酸咖喱海鱼（Pla Samlee）', name_lo = 'ແກງສົ້ມປາສຳລີ (ແບບປັກໃຕ້)', description_zh = '泰南酸咖喱，用 Pla Samlee（一种海鱼）烹煮，可选配酸笋或椰子芯。', description_lo = 'ແກງສົ້ມແບບປັກໃຕ້ ໃສ່ປາສຳລີ (ປາທະເລ) ເລືອກໃສ່ໜໍ່ໄມ້ສົ້ມ ຫຼື ຍອດໝາກພ້າວອ່ອນ.' WHERE id = 94;
UPDATE public.menu_items SET name_zh = '招牌烤猪颈肉（单点菜）', name_lo = 'ຄໍໝູປີ້ງສູດເຮືອນ (ກັບເຂົ້າ)', description_zh = '猪颈肉用本店秘制配方腌制后烤制，配泰式辣蘸酱（Jaew）。', description_lo = 'ຄໍໝູໝັກດ້ວຍສູດຂອງຮ້ານ ປີ້ງແລ້ວເສີບພ້ອມແຈ່ວ.' WHERE id = 25;
UPDATE public.menu_items SET name_zh = '泰南干炒辣咖喱猪肉末配鲜蔬（Khua Kling）', name_lo = 'ຄົ່ວກິ້ງໝູສັບກັບຜັກສົດ', description_zh = '泰南风味干炒咖喱优质猪肉末，加新鲜香草，配生鲜蔬菜。辣。', description_lo = 'ຊີ້ນໝູສັບເກຣດດີຂົ້ວແຫ້ງກັບເຄື່ອງແກງປັກໃຕ້ ແລະ ສະໝຸນໄພສົດ ເສີບພ້ອມຜັກສົດ. ເຜັດ.' WHERE id = 10;
UPDATE public.menu_items SET name_zh = '酸辣清汤猪软骨（Tom Jiw）（单点菜）', name_lo = 'ຕົ້ມຈິ໋ວກະດູກອ່ອນໝູ (ກັບເຂົ້າ)', description_zh = '酸辣清汤，配炖至软嫩的猪软骨和香草。', description_lo = 'ແກງນ້ຳໃສລົດເຜັດສົ້ມ ໃສ່ກະດູກອ່ອນໝູຕົ້ມຈົນນຸ້ມ ແລະ ສະໝຸນໄພ.' WHERE id = 27;
UPDATE public.menu_items SET name_zh = '家常鸡蛋炒良叶（泰南野菜）', name_lo = 'ໃບຫຼຽງຂົ້ວໃສ່ໄຂ່ສູດເຮືອນ', description_zh = '良叶（买麻藤叶）是泰国南部的一种绿叶菜，按我们家里的做法与鸡蛋同炒。', description_lo = 'ໃບຫຼຽງ ຜັກພື້ນບ້ານປັກໃຕ້ຂອງໄທ ຂົ້ວໃສ່ໄຂ່ແບບທີ່ເຮົາເຮັດກິນຢູ່ເຮືອນ.' WHERE id = 139;
UPDATE public.menu_items SET name_zh = '臭豆炒虾（泰南重口味）', name_lo = 'ສະຕໍຂົ້ວກຸ້ງລົດຈັດ', description_zh = '臭豆和虾用虾酱、辣椒同炒，泰南风味。', description_lo = 'ໝາກສະຕໍ ແລະ ກຸ້ງ ຂົ້ວກັບກະປິ ແລະ ໝາກເຜັດ ແບບປັກໃຕ້.' WHERE id = 138;
UPDATE public.menu_items SET name_zh = '泰式酸辣烤猪肉沙拉（Nam Tok Moo）（单点菜）', name_lo = 'ໝູຕົກເຕົາ (ນ້ຳຕົກໝູ) (ກັບເຂົ້າ)', description_zh = '烤猪肉拌酸辣酱汁，加烤米碎和香草。', description_lo = 'ໝູປີ້ງຄົນກັບນ້ຳປຸງລົດເຜັດສົ້ມ ໃສ່ເຂົ້າຄົ່ວ ແລະ ຜັກຫອມ.' WHERE id = 26;
UPDATE public.menu_items SET name_zh = '泰南虾酱甜猪肉', name_lo = 'ໝູຫວານກະປິປັກໃຕ້', description_zh = '猪肉加泰南虾酱炖煮，甜咸口味。', description_lo = 'ໝູຕົ້ມລົດຫວານເຄັມກັບກະປິປັກໃຕ້.' WHERE id = 95;
UPDATE public.menu_items SET name_zh = '泰式煎蛋饼盖饭', name_lo = 'ເຂົ້າໄຂ່ຈືນ', description_zh = '蓬松的泰式煎蛋饼，盖在米饭上。', description_lo = 'ໄຂ່ຈືນຟູໆແບບໄທ ວາງເທິງເຂົ້າຈ້າວ.' WHERE id = 13;
UPDATE public.menu_items SET name_zh = '猪肉末煎蛋饼盖饭', name_lo = 'ເຂົ້າໄຂ່ຈືນໝູສັບ', description_zh = '泰式猪肉末煎蛋饼，盖在米饭上。', description_lo = 'ໄຂ່ຈືນແບບໄທໃສ່ໝູສັບ ວາງເທິງເຂົ້າຈ້າວ.' WHERE id = 105;
UPDATE public.menu_items SET name_zh = '荷包蛋盖饭（2 个蛋）', name_lo = 'ເຂົ້າໄຂ່ດາວ 2 ໜ່ວຍ', description_zh = '两个荷包蛋，盖在米饭上。', description_lo = 'ໄຂ່ດາວ 2 ໜ່ວຍ ວາງເທິງເຂົ້າຈ້າວ.' WHERE id = 15;
UPDATE public.menu_items SET name_zh = '绿咖喱酱汁饭 • 牛裙肉', name_lo = 'ເຂົ້າຊອດແກງຂຽວຫວານ • ຊີ້ນງົວສ່ວນຫາງວ່າວ', description_zh = '浓郁绿咖喱酱汁浇饭，铺上牛裙肉片。', description_lo = 'ຊອດແກງຂຽວຫວານເຂັ້ມຂຸ້ນລາດເຂົ້າ ວາງໜ້າດ້ວຍຊີ້ນງົວສ່ວນຫາງວ່າວສະໄລ້.' WHERE id = 103;
UPDATE public.menu_items SET name_zh = '绿咖喱酱汁饭 • 牛肩颈肉', name_lo = 'ເຂົ້າຊອດແກງຂຽວຫວານ • ຊີ້ນງົວສັນຄໍ', description_zh = '浓郁绿咖喱酱汁浇饭，铺上软嫩的牛肩颈肉。', description_lo = 'ຊອດແກງຂຽວຫວານເຂັ້ມຂຸ້ນລາດເຂົ້າ ວາງໜ້າດ້ວຍຊີ້ນງົວສັນຄໍນຸ້ມໆ.' WHERE id = 104;
UPDATE public.menu_items SET name_zh = '绿咖喱酱汁饭 • 牛胸肉片', name_lo = 'ເຂົ້າຊອດແກງຂຽວຫວານ • ຊີ້ນງົວເສືອຮ້ອງໄຫ້ສະໄລ້', description_zh = '浓郁绿咖喱酱汁浇饭，铺上牛胸肉片。', description_lo = 'ຊອດແກງຂຽວຫວານເຂັ້ມຂຸ້ນລາດເຂົ້າ ວາງໜ້າດ້ວຍຊີ້ນງົວເສືອຮ້ອງໄຫ້ສະໄລ້.' WHERE id = 102;
UPDATE public.menu_items SET name_zh = '绿咖喱酱汁饭 • 低温慢煮猪肉', name_lo = 'ເຂົ້າຊອດແກງຂຽວຫວານ • ໝູຊູວີ', description_zh = '浓郁绿咖喱酱汁浇饭，铺上低温慢煮猪肉。', description_lo = 'ຊອດແກງຂຽວຫວານເຂັ້ມຂຸ້ນລາດເຂົ້າ ວາງໜ້າດ້ວຍໝູຊູວີ.' WHERE id = 101;
UPDATE public.menu_items SET name_zh = '日式酱汁饭 • 牛裙肉', name_lo = 'ເຂົ້າຊອດຍີ່ປຸ່ນ • ຊີ້ນງົວສ່ວນຫາງວ່າວ', description_zh = '甜咸日式酱汁浇饭，铺上牛裙肉片。', description_lo = 'ຊອດຍີ່ປຸ່ນລົດຫວານເຄັມລາດເຂົ້າ ວາງໜ້າດ້ວຍຊີ້ນງົວສ່ວນຫາງວ່າວສະໄລ້.' WHERE id = 97;
UPDATE public.menu_items SET name_zh = '日式酱汁饭 • 牛肩颈肉', name_lo = 'ເຂົ້າຊອດຍີ່ປຸ່ນ • ຊີ້ນງົວສັນຄໍ', description_zh = '甜咸日式酱汁浇饭，铺上软嫩的牛肩颈肉。', description_lo = 'ຊອດຍີ່ປຸ່ນລົດຫວານເຄັມລາດເຂົ້າ ວາງໜ້າດ້ວຍຊີ້ນງົວສັນຄໍນຸ້ມໆ.' WHERE id = 151;
UPDATE public.menu_items SET name_zh = '日式酱汁饭 • 牛胸肉片', name_lo = 'ເຂົ້າຊອດຍີ່ປຸ່ນ • ຊີ້ນງົວເສືອຮ້ອງໄຫ້ສະໄລ້', description_zh = '甜咸日式酱汁浇饭，铺上牛胸肉片。', description_lo = 'ຊອດຍີ່ປຸ່ນລົດຫວານເຄັມລາດເຂົ້າ ວາງໜ້າດ້ວຍຊີ້ນງົວເສືອຮ້ອງໄຫ້ສະໄລ້.' WHERE id = 96;
UPDATE public.menu_items SET name_zh = '日式酱汁饭 • 低温慢煮猪肉', name_lo = 'ເຂົ້າຊອດຍີ່ປຸ່ນ • ໝູຊູວີ', description_zh = '甜咸日式酱汁浇饭，铺上低温慢煮猪肉。', description_lo = 'ຊອດຍີ່ປຸ່ນລົດຫວານເຄັມລາດເຂົ້າ ວາງໜ້າດ້ວຍໝູຊູວີ.' WHERE id = 4;
UPDATE public.menu_items SET name_zh = '玛莎曼咖喱酱汁饭 • 牛肩颈肉', name_lo = 'ເຂົ້າຊອດແກງມັດສະໝັ່ນ • ຊີ້ນງົວສັນຄໍ', description_zh = '口味温和、香料浓郁的玛莎曼咖喱浇饭，铺上软嫩的牛肩颈肉。', description_lo = 'ແກງມັດສະໝັ່ນລົດອ່ອນ ຫອມເຄື່ອງເທດ ລາດເຂົ້າ ວາງໜ້າດ້ວຍຊີ້ນງົວສັນຄໍນຸ້ມໆ.' WHERE id = 98;
UPDATE public.menu_items SET name_zh = '玛莎曼咖喱酱汁饭 • 牛胸肉片', name_lo = 'ເຂົ້າຊອດແກງມັດສະໝັ່ນ • ຊີ້ນງົວເສືອຮ້ອງໄຫ້ສະໄລ້', description_zh = '口味温和、香料浓郁的玛莎曼咖喱浇饭，铺上牛胸肉片。', description_lo = 'ແກງມັດສະໝັ່ນລົດອ່ອນ ຫອມເຄື່ອງເທດ ລາດເຂົ້າ ວາງໜ້າດ້ວຍຊີ້ນງົວເສືອຮ້ອງໄຫ້ສະໄລ້.' WHERE id = 100;
UPDATE public.menu_items SET name_zh = '玛莎曼咖喱酱汁饭 • 牛裙肉', name_lo = 'ເຂົ້າຊອດແກງມັດສະໝັ່ນ • ຊີ້ນງົວສ່ວນຫາງວ່າວ', description_zh = '口味温和、香料浓郁的玛莎曼咖喱浇饭，铺上牛裙肉片。', description_lo = 'ແກງມັດສະໝັ່ນລົດອ່ອນ ຫອມເຄື່ອງເທດ ລາດເຂົ້າ ວາງໜ້າດ້ວຍຊີ້ນງົວສ່ວນຫາງວ່າວສະໄລ້.' WHERE id = 99;
UPDATE public.menu_items SET name_zh = '玛莎曼咖喱酱汁饭 • 低温慢煮猪肉', name_lo = 'ເຂົ້າຊອດແກງມັດສະໝັ່ນ • ໝູຊູວີ', description_zh = '口味温和、香料浓郁的玛莎曼咖喱浇饭，铺上低温慢煮猪肉。', description_lo = 'ແກງມັດສະໝັ່ນລົດອ່ອນ ຫອມເຄື່ອງເທດ ລາດເຂົ້າ ວາງໜ້າດ້ວຍໝູຊູວີ.' WHERE id = 11;
UPDATE public.menu_items SET name_zh = '泰式酸辣烤猪肉饭（Nam Tok）', name_lo = 'ເຂົ້າໝູຕົກເຕົາ', description_zh = '本店做法的 Nam Tok 猪肉：烤猪肉拌酸辣酱汁，加烤米碎和香草，配米饭。', description_lo = 'ນ້ຳຕົກໝູສູດເຮືອນ: ໝູປີ້ງຄົນກັບນ້ຳປຸງລົດເຜັດສົ້ມ ໃສ່ເຂົ້າຄົ່ວ ແລະ ຜັກຫອມ ກິນກັບເຂົ້າ.' WHERE id = 9;
UPDATE public.menu_items SET name_zh = '招牌烤猪颈肉饭', name_lo = 'ເຂົ້າຄໍໝູປີ້ງສູດເຮືອນ', description_zh = '选用真正的猪颈肉，以本店自制酱汁腌制后烤制，盖在米饭上，配泰式辣蘸酱（Jaew）解腻。', description_lo = 'ໃຊ້ຄໍໝູແທ້ໆ ໝັກດ້ວຍຊອດສູດຂອງຮ້ານເອງ ປີ້ງແລ້ວວາງເທິງເຂົ້າ ກິນກັບແຈ່ວ ຊ່ວຍຕັດຄວາມມັນ.' WHERE id = 85;
UPDATE public.menu_items SET name_zh = '绿咖喱意面配泰国优质牛肉（辣）', name_lo = 'ສະປາເກັດຕີ້ແກງຂຽວຫວານຊີ້ນງົວຂຸນ (ເຜັດ)', description_zh = '意大利面拌辣味绿咖喱酱，配软嫩的泰国优质牛肉。🌶️', description_lo = 'ສະປາເກັດຕີ້ໃນຊອດແກງຂຽວຫວານລົດເຜັດ ໃສ່ຊີ້ນງົວຂຸນໄທເນື້ອນຸ້ມ. 🌶️' WHERE id = 8;
UPDATE public.menu_items SET name_zh = '猪肉番茄肉酱意面（不辣）', name_lo = 'ສະປາເກັດຕີ້ໂບໂລເນສໝູ (ບໍ່ເຜັດ)', description_zh = '意大利面配经典猪肉波隆那肉酱。不辣。', description_lo = 'ສະປາເກັດຕີ້ຊອດໂບໂລເນສໝູແບບດັ້ງເດີມ. ບໍ່ເຜັດ.' WHERE id = 7;
UPDATE public.menu_items SET name_zh = '小份套餐：米饭 + 酸辣清汤猪软骨（Samrap Jiw）', name_lo = 'ສຳຮັບຈິ໋ວ (ເຂົ້າຈ້າວ + ຕົ້ມຈິ໋ວກະດູກອ່ອນໝູ)', description_zh = '米饭配 Tom Jiw 清汤，猪软骨炖至软烂。分量刚好吃饱，适合想喝口热汤、吃得清淡的客人。', description_lo = 'ຊຸດເຂົ້າຈ້າວກັບຕົ້ມຈິ໋ວກະດູກອ່ອນໝູ ຕົ້ມຈົນເປື່ອຍນຸ້ມ. ປະລິມານອີ່ມພໍດີ ເໝາະກັບຄົນຢາກຊົດນ້ຳແກງຮ້ອນໆ ເບົາໆ.' WHERE id = 5;
UPDATE public.menu_items SET name_zh = '薄荷可可', name_lo = 'ໂກໂກ້ມິ້ນ', description_zh = '浓郁巧克力，香气柔和，配上薄荷的清凉，每一层都甜润顺口。', description_lo = 'ຊັອກໂກແລັດເຂັ້ມຂຸ້ນ ຫອມນຸ້ມ ຕັດດ້ວຍຄວາມເຢັນສົດຊື່ນຂອງມິ້ນ ຫວານນຸ້ມລົງຕົວທຸກຊັ້ນ.' WHERE id = 164;
UPDATE public.menu_items SET name_zh = '草莓可可', name_lo = 'ໂກໂກ້ສະຕໍເບີຣີ', description_zh = '浓郁巧克力搭配酸甜草莓，香气柔和，清爽多汁，甜味恰到好处。', description_lo = 'ຊັອກໂກແລັດເຂັ້ມຂຸ້ນຄູ່ກັບສະຕໍເບີຣີລົດຫວານອົມສົ້ມ ຫອມນຸ້ມ ສົດຊື່ນ ຫວານສ່ຳລົງຕົວ.' WHERE id = 165;
UPDATE public.menu_items SET name_zh = '可可（热/冰）', name_lo = 'ໂກໂກ້ (ຮ້ອນ/ເຢັນ)', description_zh = '浓郁可可。可选热饮或冰饮。', description_lo = 'ໂກໂກ້ເຂັ້ມຂຸ້ນ. ມີທັງຮ້ອນ ແລະ ເຢັນ.' WHERE id = 72;
UPDATE public.menu_items SET name_zh = '泰式奶茶（热/冰）', name_lo = 'ຊາໄທ (ຮ້ອນ/ເຢັນ)', description_zh = '香浓顺滑的泰式奶茶。✨', description_lo = 'ຊາໄທຫອມມັນເຂັ້ມຂຸ້ນ ✨' WHERE id = 67;
UPDATE public.menu_items SET name_zh = '青柠茶', name_lo = 'ຊາໝາກນາວ', description_zh = '冰茶加新鲜青柠，酸甜可口。', description_lo = 'ຊາເຢັນໃສ່ໝາກນາວສົດ ລົດສົ້ມຫວານ.' WHERE id = 150;
UPDATE public.menu_items SET name_zh = '茉莉花茶（冰）', name_lo = 'ຊາດອກມະລິ (ເຢັນ)', description_zh = '冰茉莉花茶，清淡带花香。', description_lo = 'ຊາດອກມະລິເຢັນ ລົດເບົາ ຫອມດອກໄມ້.' WHERE id = 69;
UPDATE public.menu_items SET name_zh = '红色糖浆青柠苏打', name_lo = 'ນ້ຳແດງໝາກນາວໂຊດາ', description_zh = '红色糖浆加青柠和苏打水，泰国经典饮品。', description_lo = 'ນ້ຳຫວານສີແດງໃສ່ໝາກນາວ ແລະ ໂຊດາ ເຄື່ອງດື່ມຄລາສສິກຂອງໄທ.' WHERE id = 125;
UPDATE public.menu_items SET name_zh = '泰式粉红奶', name_lo = 'ນົມສີບົວ', description_zh = '用蛇皮果（Sala）风味糖浆调制的甜味粉红牛奶。', description_lo = 'ນົມຫວານສີບົວ ປຸງດ້ວຍນ້ຳຫວານກິ່ນສະລະ.' WHERE id = 127;
UPDATE public.menu_items SET name_zh = '纯抹茶', name_lo = 'ມັດຊະລ້ວນ', description_zh = '正宗日本抹茶，味道浓郁，苦味恰到好处，喝来平静安心。🍃', description_lo = 'ມັດຊະແທ້ຈາກຍີ່ປຸ່ນລົດເຂັ້ມຂຸ້ນ ຫອມຂົມພໍດີ ຈິບແລ້ວຮູ້ສຶກສະຫງົບ ສະບາຍໃຈ 🍃' WHERE id = 62;
UPDATE public.menu_items SET name_zh = '椰子抹茶', name_lo = 'ມັດຊະໝາກພ້າວ', description_zh = '抹茶加椰子，顺滑清爽。', description_lo = 'ມັດຊະກັບໝາກພ້າວ ນຸ້ມລິ້ນ ແລະ ເບົາສະບາຍ.' WHERE id = 126;
UPDATE public.menu_items SET name_zh = 'Haus 日本柚子抹茶', name_lo = 'ມັດຊະຢູຊຸ Haus', description_zh = '浓抹茶配清新的日本柚子香，酸甜柔和，每一口都有柚香。', description_lo = 'ມັດຊະເຂັ້ມກັບກິ່ນຫອມສົດຊື່ນຂອງຢູຊຸຍີ່ປຸ່ນ ລົດສົ້ມຫວານນຸ້ມນວນ ຫອມຢູຊຸເຕັມຄຳ.' WHERE id = 66;
UPDATE public.menu_items SET name_zh = '抹茶拿铁（热/冰）', name_lo = 'ມັດຊະລາເຕ້ (ຮ້ອນ/ເຢັນ)', description_zh = '浓郁抹茶配香滑鲜奶，顺口清爽，一天中任何时候都适合。', description_lo = 'ມັດຊະເຂັ້ມຂຸ້ນກັບນົມສົດຫອມນຸ້ມ ດື່ມງ່າຍ ສົດຊື່ນ ເໝາະກັບທຸກຊ່ວງເວລາຂອງມື້.' WHERE id = 63;
UPDATE public.menu_items SET name_zh = '橙汁抹茶', name_lo = 'ມັດຊະໝາກກ້ຽງ', description_zh = '香浓抹茶配酸甜适中的橙汁，清新提神。', description_lo = 'ມັດຊະຫອມເຂັ້ມຄູ່ກັບນ້ຳໝາກກ້ຽງລົດສົ້ມຫວານພໍດີ ດື່ມແລ້ວສົດຊື່ນຕື່ນໂຕ.' WHERE id = 65;
UPDATE public.menu_items SET name_zh = '浓缩咖啡（Espresso）', name_lo = 'ເອສເພຣສໂຊ ຊັອດ', description_zh = '一份浓缩咖啡。', description_lo = 'ເອສເພຣສໂຊ 1 ຊັອດ.' WHERE id = 61;
UPDATE public.menu_items SET name_zh = '卡布奇诺（冰/热）', name_lo = 'ຄາປູຊິໂນ (ເຢັນ/ຮ້ອນ)', description_zh = '浓缩咖啡加蒸奶和厚奶泡。可选冰饮或热饮。', description_lo = 'ເອສເພຣສໂຊກັບນົມຮ້ອນ ແລະ ຟອງນົມໜາ. ມີທັງເຢັນ ແລະ ຮ້ອນ.' WHERE id = 121;
UPDATE public.menu_items SET name_zh = '摩卡', name_lo = 'ມອກຄາ', description_zh = '浓缩咖啡加巧克力和牛奶。', description_lo = 'ເອສເພຣສໂຊກັບຊັອກໂກແລັດ ແລະ ນົມ.' WHERE id = 122;
UPDATE public.menu_items SET name_zh = '拿铁（冰/热）', name_lo = 'ລາເຕ້ (ເຢັນ/ຮ້ອນ)', description_zh = '浓缩咖啡加顺滑牛奶。可选冰饮或热饮。', description_lo = 'ເອສເພຣສໂຊກັບນົມນຸ້ມໆ. ມີທັງເຢັນ ແລະ ຮ້ອນ.' WHERE id = 56;
UPDATE public.menu_items SET name_zh = '美式咖啡（冰/热）', name_lo = 'ອາເມຣິກາໂນ (ເຢັນ/ຮ້ອນ)', description_zh = '浓缩咖啡加水，干净醇厚。可选冰饮或热饮。', description_lo = 'ເອສເພຣສໂຊຕື່ມນ້ຳ ລົດສະອາດ ເຂັ້ມ. ມີທັງເຢັນ ແລະ ຮ້ອນ.' WHERE id = 55;
UPDATE public.menu_items SET name_zh = '椰子美式', name_lo = 'ອາເມຣິກາໂນໝາກພ້າວ', description_zh = '美式咖啡加椰子水，清淡爽口。', description_lo = 'ອາເມຣິກາໂນໃສ່ນ້ຳໝາກພ້າວ ເບົາ ແລະ ສົດຊື່ນ.' WHERE id = 123;
UPDATE public.menu_items SET name_zh = '日本柚子美式', name_lo = 'ອາເມຣິກາໂນຢູຊຸ', description_zh = '美式咖啡加芳香的日本柚子。', description_lo = 'ອາເມຣິກາໂນກັບຢູຊຸຍີ່ປຸ່ນກິ່ນຫອມ.' WHERE id = 57;
UPDATE public.menu_items SET name_zh = '橙汁美式', name_lo = 'ອາເມຣິກາໂນໝາກກ້ຽງ', description_zh = '美式咖啡加橙汁，清新的柑橘风味。', description_lo = 'ອາເມຣິກາໂນໃສ່ນ້ຳໝາກກ້ຽງ ສົດໃສ ຫອມໝາກກ້ຽງ.' WHERE id = 58;
UPDATE public.menu_items SET name_zh = 'Aerocano 绵密美式', name_lo = 'ແອໂຣກາໂນ', description_zh = 'Aerocano 是打入空气的美式咖啡，口感细腻绵密，香气比普通美式更饱满。', description_lo = 'Aerocano ແມ່ນອາເມຣິກາໂນທີ່ຕີໃຫ້ຟູ ເຮັດໃຫ້ເນື້ອສຳຜັດນຽນນຸ້ມ ແລະ ຫອມກວ່າອາເມຣິກາໂນທຳມະດາ.' WHERE id = 124;
UPDATE public.menu_items SET name_zh = '优惠：2 大杯送 1 小杯', name_lo = 'ໂປຣ: 2 ຈອກໃຫຍ່ ແຖມ 1 ຈອກນ້ອຍ', description_zh = '买 2 大杯生啤，送 1 小杯。', description_lo = 'ຊື້ເບຍສົດ 2 ຈອກໃຫຍ່ ແຖມຟຣີ 1 ຈອກນ້ອຍ.' WHERE id = 83;
UPDATE public.menu_items SET name_zh = '优惠：2 扎送 1 大杯（640 ml）', name_lo = 'ໂປຣ: 2 ເຢືອກ ແຖມຟຣີ 1 ຈອກໃຫຍ່ (640 ml)', description_zh = '买 2 扎生啤，送 1 大杯（640 ml）。', description_lo = 'ຊື້ເບຍສົດ 2 ເຢືອກ ແຖມຟຣີ 1 ຈອກໃຫຍ່ (640 ml).' WHERE id = 84;
UPDATE public.menu_items SET name_zh = '优惠：Budweiser（3 瓶）', name_lo = 'ໂປຣ: Budweiser (3 ຂວດ)', description_zh = 'Budweiser 啤酒 3 瓶，优惠价。', description_lo = 'ເບຍ Budweiser 3 ຂວດ ໃນລາຄາໂປຣໂມຊັນ.' WHERE id = 6;
UPDATE public.menu_items SET name_zh = '优惠：Singha（3 瓶）', name_lo = 'ໂປຣ: Singha (3 ຂວດ)', description_zh = 'Singha 啤酒 3 瓶，优惠价。', description_lo = 'ເບຍ Singha 3 ຂວດ ໃນລາຄາໂປຣໂມຊັນ.' WHERE id = 48;
UPDATE public.menu_items SET name_zh = '优惠：Regency + 调酒饮料 3 瓶', name_lo = 'ໂປຣ: Regency + ມິກເຊີ 3 ຂວດ', description_zh = 'Regency 白兰地，配 3 瓶调酒用饮料。', description_lo = 'ບຣັ່ນດີ Regency ພ້ອມມິກເຊີ 3 ຂວດ.' WHERE id = 53;
UPDATE public.menu_items SET name_zh = '搭配：Honey Lager & Passion Fruit Wheat', name_lo = 'ຈັບຄູ່: Honey Lager & Passion Fruit Wheat', description_zh = 'Honey Lager 和 Passion Fruit Wheat 各一罐，两款精酿啤酒对比品尝。', description_lo = 'Honey Lager 1 ກະປ໋ອງ ແລະ Passion Fruit Wheat 1 ກະປ໋ອງ: ຄຣາຟເບຍ 2 ແບບໃຫ້ລອງທຽບກັນ.' WHERE id = 136;
UPDATE public.menu_items SET name_zh = '成对更划算：Honey Lager 2 罐', name_lo = 'ຊື້ຄູ່ຄຸ້ມກວ່າ: Honey Lager 2 ກະປ໋ອງ', description_zh = '两罐 Honey Lager，价格更优惠。', description_lo = 'Honey Lager 2 ກະປ໋ອງ ໃນລາຄາທີ່ຄຸ້ມກວ່າ.' WHERE id = 135;
UPDATE public.menu_items SET name_zh = '成对更划算：Mango & Passion Fruit Wheat 2 罐', name_lo = 'ຊື້ຄູ່ຄຸ້ມກວ່າ: Mango & Passion Fruit Wheat Can 2 ກະປ໋ອງ', description_zh = '原价 338 泰铢，两罐 319 泰铢。✨', description_lo = 'ປົກກະຕິ 338 ບາດ, ຊື້ຄູ່ເຫຼືອ 319 ບາດ ✨' WHERE id = 120;
UPDATE public.menu_items SET name_zh = '成对更划算：Wila Weizen 2 罐', name_lo = 'ຊື້ຄູ່ຄຸ້ມກວ່າ: Wila Weizen Can 2 ກະປ໋ອງ', description_zh = '原价 498 泰铢，两罐 479 泰铢。✨', description_lo = 'ປົກກະຕິ 498 ບາດ, ຊື້ຄູ່ເຫຼືອ 479 ບາດ ✨' WHERE id = 119;
UPDATE public.menu_items SET name_zh = '白米饭', name_lo = 'ເຂົ້າຈ້າວ', description_zh = '一盘茉莉香米饭。', description_lo = 'ເຂົ້າຈ້າວຫອມມະລິ 1 ຈານ.' WHERE id = 28;
UPDATE public.menu_items SET name_zh = '白米饭（分享钵）', name_lo = 'ເຂົ້າຈ້າວ (ໂຖ)', description_zh = '一钵茉莉香米饭，适合分享。', description_lo = 'ເຂົ້າຈ້າວຫອມມະລິ 1 ໂຖ ສຳລັບແບ່ງກັນກິນ.' WHERE id = 129;
UPDATE public.menu_items SET name_zh = '泰式煎蛋饼（2 个蛋）', name_lo = 'ໄຂ່ຈືນ (ໄຂ່ 2 ໜ່ວຍ)', description_zh = '用 2 个鸡蛋做的泰式煎蛋饼。', description_lo = 'ໄຂ່ຈືນແບບໄທ ໃຊ້ໄຂ່ໄກ່ 2 ໜ່ວຍ.' WHERE id = 29;
UPDATE public.menu_items SET name_zh = '猪肉末煎蛋饼（2 个蛋）', name_lo = 'ໄຂ່ຈືນໝູສັບ (ໄຂ່ 2 ໜ່ວຍ)', description_zh = '泰式猪肉末煎蛋饼，用 2 个鸡蛋制作。', description_lo = 'ໄຂ່ຈືນແບບໄທໃສ່ໝູສັບ ໃຊ້ໄຂ່ 2 ໜ່ວຍ.' WHERE id = 131;
UPDATE public.menu_items SET name_zh = '荷包蛋', name_lo = 'ໄຂ່ດາວ', description_zh = '边缘焦脆的荷包蛋。', description_lo = 'ໄຂ່ດາວຂອບກອບ.' WHERE id = 30;
UPDATE public.menu_items SET name_zh = '水煮蛋', name_lo = 'ໄຂ່ຕົ້ມ', description_zh = '一个水煮蛋。', description_lo = 'ໄຂ່ຕົ້ມ 1 ໜ່ວຍ.' WHERE id = 130;
UPDATE public.menu_items SET name_zh = '低温慢煮温泉蛋', name_lo = 'ໄຂ່ອອນເຊັນຊູວີ', description_zh = '慢煮鸡蛋，蛋黄柔滑。', description_lo = 'ໄຂ່ປຸງຊ້າໆ ໄຂ່ແດງນຸ້ມລື່ນ.' WHERE id = 31;
UPDATE public.menu_items SET name_zh = '鸡米花', name_lo = 'ໄກ່ປັອບ', description_zh = '一口大小的香脆炸鸡，配冷饮正合适。', description_lo = 'ໄກ່ທອດກອບຊິ້ນພໍດີຄຳ ເຂົ້າກັນດີກັບເຄື່ອງດື່ມເຢັນໆ.' WHERE id = 23;
UPDATE public.menu_items SET name_zh = '炸物拼盘', name_lo = 'ຊຸດທອດລວມ', description_zh = '多种本店炸小吃拼盘，适合分享。', description_lo = 'ຂອງທອດຫຼາຍຢ່າງຂອງຮ້ານລວມໃນຈານດຽວ ສຳລັບແບ່ງກັນກິນ.' WHERE id = 24;
UPDATE public.menu_items SET name_zh = '日式炙烤牛肉沙拉（Tataki）', name_lo = 'ທາທາກິ (ຍຳຊີ້ນງົວແບບຍີ່ປຸ່ນ)', description_zh = '牛肉以大火炙烤，外层微焦，内里保持生嫩多汁。冷食，配酱汁和红葱头丝。适合搭配气泡饮品。', description_lo = 'ຊີ້ນງົວປີ້ງໄຟແຮງ ໃຫ້ດ້ານນອກສຸກໄໝ້ເລັກນ້ອຍ ແຕ່ດ້ານໃນຍັງດິບ ນຸ້ມ ແລະ ສ່ຳ. ກິນແບບເຢັນໆກັບຊອດ ແລະ ຫົວຜັກບົ່ວແດງຊອຍ. ເຂົ້າກັນດີກັບເຄື່ອງດື່ມຊ່າໆ.' WHERE id = 17;
UPDATE public.menu_items SET name_zh = '香辣腌水果', name_lo = 'ໝາກໄມ້ດອງແຊບ', description_zh = '腌渍水果拌酸甜辣酱汁。', description_lo = 'ໝາກໄມ້ດອງຄົນກັບນ້ຳປຸງລົດເຜັດ ຫວານ ສົ້ມ.' WHERE id = 113;
UPDATE public.menu_items SET name_zh = '浓郁布朗尼配新鲜奶油芝士✨', name_lo = 'ຟັດຈ໌ບຣາວນີ ຄຣີມຊີສສົດ✨', description_zh = '口感软糯的布朗尼，用真巧克力和真黄油制作，味道浓郁，甜度低。单吃就好吃，配新鲜奶油芝士更搭。', description_lo = 'ບຣາວນີເນື້ອໜຶບ ໃຊ້ຊັອກໂກແລັດແທ້ ແລະ ເນີຍແທ້ ລົດເຂັ້ມຂຸ້ນ ຫວານໜ້ອຍ. ກິນລ້າໆກໍແຊບ ກິນກັບຄຣີມຊີສສົດຍິ່ງລົງຕົວ.' WHERE id = 132;
UPDATE public.menu_items SET name_zh = '炸薯条', name_lo = 'ມັນຝຣັ່ງທອດ', description_zh = '金黄香脆的薯条。', description_lo = 'ມັນຝຣັ່ງທອດກອບສີເຫຼືອງຄຳ.' WHERE id = 22;
UPDATE public.menu_items SET name_zh = '泰式凉拌腰果（辣）', name_lo = 'ຍຳໝາກມ່ວງຫິມະພານ (ເຜັດ)', description_zh = '烤腰果拌辣椒、青柠、红葱头和香草，配泰式酸辣凉拌汁。', description_lo = 'ໝາກມ່ວງຫິມະພານຄົ່ວ ຄົນກັບໝາກເຜັດ ໝາກນາວ ຫົວຜັກບົ່ວແດງ ແລະ ຜັກຫອມ ໃນນ້ຳຍຳລົດເຜັດແບບໄທ.' WHERE id = 112;
UPDATE public.menu_items SET name_zh = '白灼 Phon Yang Kham 牛肉配泰式辣蘸酱', name_lo = 'ລວກຈິ້ມຊີ້ນງົວໂພນຍາງຄຳ', description_zh = '一口大小的白灼 Phon Yang Kham 牛肉（产自沙功那空），配带烤米香的泰式辣蘸酱（Jaew）。味道浓郁而柔和，像在家吃饭一样。', description_lo = 'ຊີ້ນງົວໂພນຍາງຄຳ (ຈາກສະກົນນະຄອນ) ລວກພໍດີຄຳ ເສີບພ້ອມແຈ່ວຫອມເຂົ້າຄົ່ວ ລົດເຂັ້ມແຕ່ນຸ້ມນວນ ຄືກິນເຂົ້າຢູ່ເຮືອນ.' WHERE id = 21;
UPDATE public.menu_items SET name_zh = '炸鸡筋', name_lo = 'ເອັນໄກ່ທອດ', description_zh = '香脆的油炸鸡筋，很受欢迎的下酒小吃。', description_lo = 'ເອັນໄກ່ທອດກອບ ກັບແກ້ມຍອດນິຍົມ.' WHERE id = 111;
UPDATE public.menu_items SET name_zh = 'Umm Milk 冰淇淋杯（曲奇奶油味）', name_lo = 'ກະແລັມ Umm Milk ລົດຄຸກກີ້ແອນຄຣີມ', description_zh = '采用 Farm Chokchai 的 100% 鲜牛奶制作，口感浓郁顺滑。不含黄油和植物脂肪。', description_lo = 'ເຮັດຈາກນົມສົດແທ້ 100% ຈາກ Farm Chokchai ເນື້ອເຂັ້ມຂຸ້ນ ນຸ້ມລິ້ນ. ບໍ່ປະສົມເນີຍ ແລະ ໄຂມັນພືດ.' WHERE id = 133;
UPDATE public.menu_items SET name_zh = 'Umm Milk 冰淇淋杯（绿茶味）', name_lo = 'ກະແລັມ Umm Milk ລົດຊາຂຽວ', description_zh = '采用 Farm Chokchai 的 100% 鲜牛奶制作，口感浓郁顺滑。不含黄油和植物脂肪。', description_lo = 'ເຮັດຈາກນົມສົດແທ້ 100% ຈາກ Farm Chokchai ເນື້ອເຂັ້ມຂຸ້ນ ນຸ້ມລິ້ນ. ບໍ່ປະສົມເນີຍ ແລະ ໄຂມັນພືດ.' WHERE id = 162;
UPDATE public.menu_items SET name_zh = 'Umm Milk 冰淇淋杯（鲜奶味）', name_lo = 'ກະແລັມ Umm Milk ລົດນົມສົດ', description_zh = '采用 Farm Chokchai 的 100% 鲜牛奶制作，口感浓郁顺滑。不含黄油和植物脂肪。', description_lo = 'ເຮັດຈາກນົມສົດແທ້ 100% ຈາກ Farm Chokchai ເນື້ອເຂັ້ມຂຸ້ນ ນຸ້ມລິ້ນ. ບໍ່ປະສົມເນີຍ ແລະ ໄຂມັນພືດ.' WHERE id = 134;
UPDATE public.menu_items SET name_zh = '本店酱汁炒蔬菜炸豆腐', name_lo = 'ຂົ້ວຜັກເຕົ້າຫູ້ທອດຊອດສູດເຮືອນ', description_zh = '多种蔬菜和香脆炸豆腐，用本店酱汁同炒。适合素食者。', description_lo = 'ຜັກລວມ ແລະ ເຕົ້າຫູ້ທອດກອບ ຂົ້ວກັບຊອດສູດຂອງຮ້ານ. ເໝາະສຳລັບຄົນກິນມັງສະວິລັດ.' WHERE id = 159;
UPDATE public.menu_items SET name_zh = 'Honey Lager 蜂蜜拉格啤酒 330 ml', name_lo = 'Honey Lager 330 ml (ເບຍລາເກີນ້ຳເຜິ້ງ)', description_zh = 'Vana Brewing（Beervana 旗下）出品的拉格啤酒，加入泰国龙眼花蜂蜜一同发酵，香甜圆润，口感柔顺，非常易饮，不苦。', description_lo = 'ເບຍລາເກີຈາກ Vana Brewing (Beervana) ໝັກກັບນ້ຳເຜິ້ງດອກລຳໄຍແທ້ຂອງໄທ ລົດຫອມຫວານກົມກ່ອມ ນຸ້ມນວນ ດື່ມງ່າຍຫຼາຍ ແລະ ບໍ່ຂົມ.' WHERE id = 137;
UPDATE public.menu_items SET name_zh = 'Mango & Passion Fruit Wheat 芒果百香果小麦啤酒（罐装）330 ml', name_lo = 'Mango & Passion Fruit Wheat Can 330 ml (ເບຍເຂົ້າສາລີ ໝາກມ່ວງ ແລະ ໝາກນອດ)', description_zh = '金黄色浑浊的水果小麦啤酒，带熟芒果和酸甜百香果的香气。酒体轻至中等，口感柔顺，十分清爽。', description_lo = 'ເບຍເຂົ້າສາລີໝາກໄມ້ສີເຫຼືອງຄຳຂຸ່ນ ຫອມໝາກມ່ວງສຸກ ແລະ ໝາກນອດລົດສົ້ມອົມຫວານ. ບໍດີ້ເບົາຫາກາງ ນຸ້ມນວນ ແລະ ສົດຊື່ນຫຼາຍ.' WHERE id = 118;
UPDATE public.menu_items SET name_zh = 'Wila Weizen 小麦啤酒（罐装）490 ml', name_lo = 'Wila Weizen Can 490 ml (ເບຍເຂົ້າສາລີ)', description_zh = 'Vana Brewing 出品的泰式演绎德式小麦啤酒（Weizen）：带香蕉、香草和丁香气息，柔顺易饮。曾获 AIBA 和 Asia Beer Championship 奖项。', description_lo = 'ເບຍໄວເຊັນສະໄຕລ໌ເຢຍລະມັນໃນແບບໄທ ຈາກ Vana Brewing: ກິ່ນກ້ວຍ ວານີລາ ແລະ ການພູ ລົດນຸ້ມນວນ ດື່ມງ່າຍ. ໄດ້ຮັບລາງວັນ AIBA ແລະ Asia Beer Championship.' WHERE id = 117;
UPDATE public.menu_items SET name_zh = '开瓶费（每瓶）', name_lo = 'ຄ່າເປີດຂວດເຫຼົ້າ (ຕໍ່ຂວດ)', description_zh = '自带酒类按瓶收取的费用。', description_lo = 'ຄ່າບໍລິການຕໍ່ຂວດ ສຳລັບເຄື່ອງດື່ມແອນກໍຮໍທີ່ນຳມາເອງ.' WHERE id = 54;
UPDATE public.menu_items SET name_zh = 'Budweiser 啤酒', name_lo = 'ເບຍ Budweiser', description_zh = 'Budweiser 啤酒，瓶装。', description_lo = 'ເບຍ Budweiser ແບບຂວດ.' WHERE id = 49;
UPDATE public.menu_items SET name_zh = 'Singha 啤酒', name_lo = 'ເບຍ Singha', description_zh = 'Singha 啤酒，瓶装。', description_lo = 'ເບຍ Singha ແບບຂວດ.' WHERE id = 47;
UPDATE public.menu_items SET name_zh = 'Regency 白兰地（扁瓶）', name_lo = 'Regency (ຂວດແບນ)', description_zh = 'Regency 泰国白兰地，扁瓶装。', description_lo = 'ບຣັ່ນດີໄທ Regency ຂະໜາດຂວດແບນ.' WHERE id = 51;
UPDATE public.menu_items SET name_zh = 'Asahi 生啤 1 L 扎', name_lo = 'Asahi ເບຍສົດ ເຢືອກ 1 ລິດ', description_zh = 'Asahi 生啤，1 L 扎装。', description_lo = 'ເບຍສົດ Asahi ເຢືອກ 1 ລິດ.' WHERE id = 45;
UPDATE public.menu_items SET name_zh = 'Asahi 生啤 小杯 S', name_lo = 'Asahi ເບຍສົດ ຈອກນ້ອຍ S', description_zh = 'Asahi 生啤，小杯。', description_lo = 'ເບຍສົດ Asahi ຈອກນ້ອຍ.' WHERE id = 43;
UPDATE public.menu_items SET name_zh = 'Asahi 生啤 大杯 L', name_lo = 'Asahi ເບຍສົດ ຈອກໃຫຍ່ L', description_zh = 'Asahi 生啤，大杯。', description_lo = 'ເບຍສົດ Asahi ຈອກໃຫຍ່.' WHERE id = 44;
UPDATE public.menu_items SET name_zh = '日本毛豆', name_lo = 'ຖົ່ວແຮະຍີ່ປຸ່ນ (ເອດາມາເມະ)', description_zh = '蒸日本毛豆，撒少许盐。', description_lo = 'ຖົ່ວເຫຼືອງຝັກອ່ອນຍີ່ປຸ່ນໜຶ້ງ ໂຮຍເກືອເລັກນ້ອຍ.' WHERE id = 18;
UPDATE public.menu_items SET name_zh = '盐烤腰果', name_lo = 'ໝາກມ່ວງຫິມະພານຄົ່ວເກືອ', description_zh = '加盐烘烤的腰果，简单的下酒小吃。', description_lo = 'ໝາກມ່ວງຫິມະພານຄົ່ວກັບເກືອ ກັບແກ້ມງ່າຍໆ.' WHERE id = 19;
UPDATE public.menu_items SET name_zh = 'Woodsmoke.', name_lo = 'Woodsmoke.', description_zh = '全新无酒精鸡尾酒，融合深沉的橡木香气。
酒精 0%', description_lo = 'ມັອກເທວຈອກໃໝ່ ທີ່ປະສານຄວາມເລິກຂອງກິ່ນໄມ້ໂອກ.
ແອນກໍຮໍ 0%' WHERE id = 39;
UPDATE public.menu_items SET name_zh = 'Khak Ee Lee 烤米香特调（泰国东北方言“真带劲”）', name_lo = 'ຄັກອີຫຼີ', description_zh = 'Cocktail +100
我们提取泰国东北菜的灵魂食材“烤米”的香气，柔和、深沉，带独特的坚果香，再融入橙香和泰国香草的清新，一举杯便香气扑鼻。😋
这一杯不只是饮品，而是用我们的方式重新讲述本地风味。', description_lo = 'Cocktail +100
ເຮົາດຶງເອົາກິ່ນຫອມຂອງ "ເຂົ້າຄົ່ວ" ວັດຖຸດິບຫົວໃຈຂອງອາຫານອີສານ ທີ່ຫອມ ນຸ້ມ ເລິກ ແລະ ມີກິ່ນຖົ່ວສະເພາະຕົວ ມາປະສົມກັບຄວາມສົດຊື່ນຂອງກິ່ນໝາກກ້ຽງ ແລະ ສະໝຸນໄພໄທ ຫອມຂຶ້ນດັງທັນທີທີ່ຍົກດື່ມ 😋
ຈອກນີ້ບໍ່ແມ່ນພຽງເຄື່ອງດື່ມ ແຕ່ຄືການເລົ່າລົດຊາດທ້ອງຖິ່ນໃໝ່ໃນແບບຂອງເຮົາ.' WHERE id = 92;
UPDATE public.menu_items SET name_zh = '夏日（Kimhan）', name_lo = 'ຄິມຫັນ (ລະດູຮ້ອນ)', description_zh = 'Cocktail +100
明亮、清爽、充满活力的饮品。', description_lo = 'Cocktail +100
"ຄິມຫັນ" ເຄື່ອງດື່ມທີ່ສົດໃສ ສົດຊື່ນ ແລະ ເຕັມໄປດ້ວຍຊີວິດຊີວາ.' WHERE id = 36;
UPDATE public.menu_items SET name_zh = '幻梦（Nimit）', name_lo = 'ນິມິດ', description_zh = 'Cocktail +100
香气如梦的饮品，每喝一口都展现新的层次。', description_lo = 'Cocktail +100
"ນິມິດ" ເຄື່ອງດື່ມຫອມກຸ່ນຊວນຝັນ ທີ່ເຜີຍລົດຊາດຊັ້ນໃໝ່ທຸກຄັ້ງທີ່ຈິບ.' WHERE id = 35;
UPDATE public.menu_items SET name_zh = '幻影（Maya）', name_lo = 'ມາຍາ', description_zh = 'Cocktail +100
神秘、引人探索的无酒精鸡尾酒，味道令人难忘。', description_lo = 'Cocktail +100
"ມາຍາ" ມັອກເທວລຶກລັບໜ້າຄົ້ນຫາ ທີ່ມາພ້ອມລົດຊາດໜ້າປະທັບໃຈ.' WHERE id = 37;
UPDATE public.menu_items SET name_zh = '“你好，James 先生” Highball', name_lo = 'ສະບາຍດີ ທ່ານເຈມ Highball', description_zh = 'Jameson 威士忌调制的 Highball，配柠檬。', description_lo = 'ວິສກີ Jameson ປຸງແບບ Highball ພ້ອມເລມອນ.' WHERE id = 38;
UPDATE public.menu_items SET name_zh = 'Hom Ai Mak Mao 泰东北野莓特调', name_lo = 'ຫອມອ້າຍໝາກເມົ່າ', description_zh = 'Cocktail +100
以泰国东北（伊桑）的野生浆果 Mak Mao 🫐 为主角，与其他材料调配出恰到好处的平衡口味。', description_lo = 'Cocktail +100
ເຄື່ອງດື່ມທີ່ໃຊ້ໝາກເມົ່າ ຫຼື ເບີຣີອີສານ 🫐 ເປັນຫົວໃຈຫຼັກ ປະສົມກັບສ່ວນປະສົມອື່ນໆ ຈົນໄດ້ລົດຊາດສົມດຸນພໍດີ.' WHERE id = 34;
UPDATE public.menu_items SET name_zh = '可口可乐 550 ml（瓶装）', name_lo = 'ໂຄ້ກ 550 ml (ຂວດ)', description_zh = '经典可口可乐，550 ml 瓶装。', description_lo = 'ໂຄຄາ-ໂຄລາ ຄລາສສິກ ຂວດ 550 ml.' WHERE id = 79;
UPDATE public.menu_items SET name_zh = '无糖可口可乐（罐装）', name_lo = 'ໂຄ້ກບໍ່ມີນ້ຳຕານ (ກະປ໋ອງ)', description_zh = '零糖可口可乐，罐装。', description_lo = 'ໂຄຄາ-ໂຄລາ ບໍ່ມີນ້ຳຕານ ແບບກະປ໋ອງ.' WHERE id = 78;
UPDATE public.menu_items SET name_zh = 'Schweppes 汤力水', name_lo = 'Schweppes ໂທນິກ', description_zh = 'Schweppes 汤力水，口感清爽，可调酒也可直接饮用。', description_lo = 'ນ້ຳໂທນິກ Schweppes ລົດສົດຊື່ນ ໃຊ້ປະສົມ ຫຼື ດື່ມລ້າໆກໍໄດ້.' WHERE id = 152;
UPDATE public.menu_items SET name_zh = 'Schweppes 青柠苏打', name_lo = 'Schweppes ໝາກນາວໂຊດາ', description_zh = 'Schweppes 青柠苏打，气泡十足，清爽。', description_lo = 'Schweppes ໝາກນາວໂຊດາ ຊ່າ ແລະ ສົດຊື່ນ.' WHERE id = 80;
UPDATE public.menu_items SET name_zh = '苏打水', name_lo = 'ໂຊດາ', description_zh = '原味苏打水，适合搭配烈酒。', description_lo = 'ນ້ຳໂຊດາທຳມະດາ ເຂົ້າກັນດີກັບເຫຼົ້າ.' WHERE id = 81;
UPDATE public.menu_items SET name_zh = '冰块（小桶）', name_lo = 'ນ້ຳກ້ອນ (ຖັງນ້ອຍ)', description_zh = '一小桶冰块，供整桌使用。', description_lo = 'ນ້ຳກ້ອນ 1 ຖັງນ້ອຍ ສຳລັບໂຕະ.' WHERE id = 82;
UPDATE public.menu_items SET name_zh = '冰块（大桶）', name_lo = 'ນ້ຳກ້ອນ (ຖັງໃຫຍ່)', description_zh = '一大桶冰块，供整桌使用。', description_lo = 'ນ້ຳກ້ອນ 1 ຖັງໃຫຍ່ ສຳລັບໂຕະ.' WHERE id = 128;
UPDATE public.menu_items SET name_zh = 'Singha 饮用水 1.5 L', name_lo = 'ນ້ຳດື່ມ Singha 1.5 ລິດ', description_zh = 'Singha 饮用水，1.5 L 瓶装，适合分享。', description_lo = 'ນ້ຳດື່ມ Singha ຂວດ 1.5 ລິດ ສຳລັບແບ່ງກັນດື່ມ.' WHERE id = 75;
UPDATE public.menu_items SET name_zh = 'Singha 饮用水 600 ml', name_lo = 'ນ້ຳດື່ມ Singha 600 ml', description_zh = 'Singha 饮用水，600 ml 瓶装。', description_lo = 'ນ້ຳດື່ມ Singha ຂວດ 600 ml.' WHERE id = 74;
UPDATE public.menu_items SET name_zh = 'Flow 矿泉水', name_lo = 'ນ້ຳແຮ່ Flow', description_zh = 'Flow 天然矿泉水。', description_lo = 'ນ້ຳແຮ່ທຳມະຊາດ Flow.' WHERE id = 76;
UPDATE public.menu_items SET name_zh = 'Oishi 绿茶（玻璃瓶）', name_lo = 'Oishi ຊາຂຽວ (ຂວດແກ້ວ)', description_zh = 'Oishi 日式绿茶，玻璃瓶装。', description_lo = 'ຊາຂຽວຍີ່ປຸ່ນ Oishi ແບບຂວດແກ້ວ.' WHERE id = 77;
UPDATE public.menu_items SET name_zh = '清仓：“หรอย”（Roi）T恤 均码', name_lo = 'ລ້າງສະຕັອກ ຟຣີໄຊສ໌: ເສື້ອຍືດລາຍ "หรอย" (ຫຣອຍ)', description_zh = '清仓 T恤，印有“หรอย”（Roi）字样，均码。', description_lo = 'ເສື້ອຍືດລ້າງສະຕັອກ ພິມລາຍ "หรอย" (ຫຣອຍ) ຟຣີໄຊສ໌.' WHERE id = 157;
UPDATE public.menu_items SET name_zh = '3 键 Clicker 按键玩具（可换外壳）', name_lo = 'Clicker 3 ປຸ່ມ (ປ່ຽນເຄສໄດ້)', description_zh = NULL, description_lo = NULL WHERE id = 163;
UPDATE public.menu_items SET name_zh = '黑色 Clicker 按键玩具（不发光）', name_lo = 'Clicker ສີດຳ (ບໍ່ມີໄຟ)', description_zh = NULL, description_lo = NULL WHERE id = 156;
UPDATE public.menu_items SET name_zh = '那空拍侬 Clicker 按键玩具（LED 发光）', name_lo = 'Clicker ນະຄອນພະນົມ (LED)', description_zh = 'Enter 那空拍侬：把“最幸福城市”的感觉随身带着。
手闲不下来的人一定喜欢。我们把湄公河畔流动的线条放进这枚 Enter 键造型里，按下会亮起柔光，按键手感让人停不下来，帮你放松解压。背面可自行打开更换电池，尽管按，不怕没电。', description_lo = 'Enter ນະຄອນພະນົມ: ພົກຄວາມຮູ້ສຶກຂອງເມືອງທີ່ສຸກທີ່ສຸດຕິດໂຕໄວ້.
ໃຜທີ່ມືຢູ່ບໍ່ສຸກຕ້ອງມັກ. ເຮົາເອົາລາຍເສັ້ນພິ້ວໆແຄມແມ່ນ້ຳຂອງມາໃສ່ໃນປຸ່ມ Enter ຮູບຊົງນີ້ ກົດແລ້ວມີໄຟເຮືອງຂຶ້ນ ຈັງຫວະຄລິກກົດແລ້ວເພີນ ຊ່ວຍຜ່ອນຄາຍຄວາມຄຽດ. ດ້ານຫຼັງແກະປ່ຽນຖ່ານເອງໄດ້ ກົດຫຼິ້ນໄດ້ດົນໆ ບໍ່ຕ້ອງຢ້ານໄຟມອດ.' WHERE id = 155;
UPDATE public.menu_items SET name_zh = 'Haus 双色钥匙牌', name_lo = 'ປ້າຍຫ້ອຍກະແຈ Haus ສອງສີ', description_zh = 'Haus 双色钥匙牌。', description_lo = 'ປ້າຍຫ້ອຍກະແຈ Haus ແບບສອງສີ.' WHERE id = 161;
UPDATE public.menu_items SET name_zh = '钥匙扣（小）', name_lo = 'ພວງກະແຈ (ນ້ອຍ)', description_zh = 'Haus 小号钥匙扣。', description_lo = 'ພວງກະແຈ Haus ຂະໜາດນ້ອຍ.' WHERE id = 160;
UPDATE public.menu_items SET name_zh = 'Naga in haus（那伽艺术玩具）', name_lo = 'Naga in haus (ອາດທອຍພະຍານາກ)', description_zh = '别处见不到的那伽（Naga）造型：缩小比例的全黑艺术玩具风格，帅气凶猛，又带一点俏皮。可以挂在包上，也可以摆在办公桌上。', description_lo = 'ພະຍານາກເວີຊັນທີ່ບໍ່ເຄີຍເຫັນຢູ່ໃສ ດີໄຊນ໌ຫຍໍ້ສ່ວນແບບອາດທອຍໂທນສີດຳເຂັ້ມ ເທ່ ດຸດັນ ແຕ່ແຝງຄວາມໜ້າຮັກແບບກວນໆ. ເອົາໄປຫ້ອຍກະເປົາ ຫຼື ຕັ້ງໂຕະເຮັດວຽກກໍໄດ້.' WHERE id = 145;
UPDATE public.menu_items SET name_zh = '贴纸套装：That Phanom（特价）', name_lo = 'ຊຸດສະຕິກເກີ: ທາດພະນົມ (ຫຼຸດລາຄາ)', description_zh = 'That Phanom（塔帕侬）贴纸套装，清仓。', description_lo = 'ຊຸດສະຕິກເກີທາດພະນົມ ລ້າງສະຕັອກ.' WHERE id = 158;
UPDATE public.menu_items SET name_zh = 'Test', name_lo = 'Test', description_zh = NULL, description_lo = NULL WHERE id = 154;
UPDATE public.menu_items SET name_zh = '“จริตจัด 那空拍侬”T恤（Jarit Jad Nakhon Phanom）', name_lo = 'ເສື້ອ "จริตจัด ນະຄອນພະນົມ" (ຈະຣິດຈັດ)', description_zh = '“จริตจัด”采用非常现代的泰文字体，“นครพนม”（那空拍侬）字样的灵感来自老电影院招牌，复古而有力。背面印有那空拍侬府所有县和乡的名称。到店购买价 750 泰铢。', description_lo = 'ຄຳວ່າ "จริตจัด" ເປັນຟອນໄທສະໄຕລ໌ໂມເດີນ ສ່ວນຄຳວ່າ "นครพนม" (ນະຄອນພະນົມ) ໄດ້ແຮງບັນດານໃຈຈາກປ້າຍໜ້າໂຮງໜັງເກົ່າ ໃຫ້ຄວາມຮູ້ສຶກເຣໂທຣແຕ່ແຂງແຮງ. ດ້ານຫຼັງພິມລາຍຊື່ທຸກອຳເພີ ແລະ ທຸກຕຳບົນໃນນະຄອນພະນົມ. ລາຄາໜ້າຮ້ານ 750 ບາດ.' WHERE id = 153;
UPDATE public.menu_items SET name_zh = 'Naga in haus（红色）', name_lo = 'Naga in haus (ສີແດງ)', description_zh = NULL, description_lo = NULL WHERE id = 144;
UPDATE public.menu_items SET name_zh = 'Winky Merry ( C )', name_lo = 'Winky Merry ( C )', description_zh = 'Winky Merry🎄✨ 迎接欢乐月份的饮品，带水果的柔和甜味，配上蔓越莓的清爽酸味，还有可以轻轻咀嚼的口感，梦幻又明亮，像一份小小的幸福。', description_lo = 'Winky Merry🎄✨ ເຄື່ອງດື່ມຕ້ອນຮັບເດືອນແຫ່ງຄວາມສຸກ ຫວານນຸ້ມຈາກໝາກໄມ້ ຕັດດ້ວຍຄວາມສົ້ມສົດຊື່ນຂອງແຄຣນເບີຣີ ມີເນື້ອໃຫ້ຄ້ຽວເບົາໆ ໃຫ້ຄວາມຮູ້ສຶກສົດໃສ ຄືຄວາມສຸກນ້ອຍໆ.' WHERE id = 33;
UPDATE public.menu_categories SET name_zh = '套餐', name_lo = 'ຊຸດອາຫານ' WHERE id = 'a2920b33-7bd1-4a5c-9f97-d5b7c327fb20';
UPDATE public.menu_categories SET name_zh = '主菜（下饭菜）', name_lo = 'ກັບເຂົ້າ' WHERE id = 'bc7b96cc-6a67-4430-ad7f-b92b797ea26b';
UPDATE public.menu_categories SET name_zh = '单人餐（饭与面）', name_lo = 'ອາຫານຈານດຽວ (ເຂົ້າ ແລະ ເສັ້ນ)' WHERE id = '524de295-438b-4bf1-a4d2-379d3ba05847';
UPDATE public.menu_categories SET name_zh = '茶、抹茶、可可', name_lo = 'ຊາ ມັດຊະ ໂກໂກ້' WHERE id = '912683ef-fdc3-40a3-8dd8-b09507791240';
UPDATE public.menu_categories SET name_zh = '咖啡', name_lo = 'ກາເຟ' WHERE id = '7524bb8a-4698-45c6-aa17-d8ccc296f667';
UPDATE public.menu_categories SET name_zh = '啤酒优惠', name_lo = 'ໂປຣເບຍ' WHERE id = '8a3dcc6b-9eff-42b2-83d5-1e02dd0a98cd';
UPDATE public.menu_categories SET name_zh = '加点（米饭、鸡蛋）', name_lo = 'ສັ່ງເພີ່ມ (ເຂົ້າ ໄຂ່)' WHERE id = '8fd95861-4d30-4f68-8aae-c13924dd1bf9';
UPDATE public.menu_categories SET name_zh = '甜品与小吃', name_lo = 'ຂອງຫວານ ແລະ ຂອງກິນຫຼິ້ນ' WHERE id = '36755ca5-86c2-435f-8539-1a31a1fe0667';
UPDATE public.menu_categories SET name_zh = '素食', name_lo = 'ມັງສະວິລັດ' WHERE id = '2fb626e7-d682-455c-8798-0b674849aa8d';
UPDATE public.menu_categories SET name_zh = '啤酒与酒类', name_lo = 'ເບຍ ແລະ ເຄື່ອງດື່ມແອນກໍຮໍ' WHERE id = 'b441665e-2f23-4df3-a11d-63485e1690dc';
UPDATE public.menu_categories SET name_zh = '即上小吃', name_lo = 'ຂອງກິນຫຼິ້ນພ້ອມເສີບ' WHERE id = '652086be-5ce8-467b-8e98-278fc6aa2d05';
UPDATE public.menu_categories SET name_zh = '鸡尾酒与无酒精鸡尾酒', name_lo = 'ຄັອກເທວ ແລະ ມັອກເທວ' WHERE id = '1983955d-5787-4351-b729-51b95761f125';
UPDATE public.menu_categories SET name_zh = '瓶装饮料与冰块', name_lo = 'ເຄື່ອງດື່ມຂວດ ແລະ ນ້ຳກ້ອນ' WHERE id = '1407d869-4eed-489e-aeeb-ba7ef19f57bd';
UPDATE public.menu_categories SET name_zh = 'Hausmade.', name_lo = 'Hausmade.' WHERE id = 'e61d0015-fec6-4389-afbb-cde205200581';
UPDATE public.option_groups SET name_zh = '加浓缩', name_lo = 'ເພີ່ມຊັອດ' WHERE id = 'e594b072-0480-4626-8403-81e166366ea6';
UPDATE public.option_groups SET name_zh = '加料', name_lo = 'ສັ່ງເພີ່ມ' WHERE id = '269c4ddd-d70f-4c7e-abe2-20cf25868f22';
UPDATE public.option_groups SET name_zh = '鸡尾酒或无酒精', name_lo = 'ຄັອກເທວ ຫຼື ມັອກເທວ' WHERE id = '9843facc-7487-4915-a1ca-1dbfacfec43b';
UPDATE public.option_groups SET name_zh = '咖啡豆', name_lo = 'ເມັດກາເຟ' WHERE id = '102047df-8efb-499a-91a9-aa3a17cd3391';
UPDATE public.option_groups SET name_zh = '颜色', name_lo = 'ສີ (ເລືອກສີ)' WHERE id = '61e358b2-6a32-48d3-8815-c620f712e9e2';
UPDATE public.option_groups SET name_zh = '热 / 冰', name_lo = 'ຮ້ອນ / ເຢັນ' WHERE id = 'b53da692-ca23-4bac-869c-7264ce6f22a7';
UPDATE public.option_groups SET name_zh = 'T恤尺码', name_lo = 'ຂະໜາດເສື້ອ' WHERE id = 'a08b4298-c675-4dc3-ab61-cf65a5703c3d';
UPDATE public.option_groups SET name_zh = '选择饮品', name_lo = 'ເລືອກເຄື່ອງດື່ມ' WHERE id = 'aa90ec29-abbc-4a1f-a987-3bcfb1bef173';
UPDATE public.option_groups SET name_zh = '酱料', name_lo = 'ຊອດ' WHERE id = '62661583-333c-4fa2-bb6f-3ab65a1bc73c';
UPDATE public.option_groups SET name_zh = '日式酱汁', name_lo = 'ຊອດຍີ່ປຸ່ນ' WHERE id = 'da8f2bc5-6f28-4712-a8b1-bfdb67e416bc';
UPDATE public.option_groups SET name_zh = '燕麦奶', name_lo = 'ນົມໂອດ' WHERE id = 'ae21fb37-3d80-4349-a631-9f68566376b8';
UPDATE public.option_groups SET name_zh = '蜂蜜', name_lo = 'ນ້ຳເຜິ້ງ' WHERE id = 'e0e7fc7a-b9c5-4f2b-ba6a-c10bf62b9238';
UPDATE public.option_groups SET name_zh = '请选择食材', name_lo = 'ກະລຸນາເລືອກວັດຖຸດິບ' WHERE id = '7da97599-a31b-49ed-a095-e89fea14c988';
UPDATE public.option_groups SET name_zh = '辣椒盐蘸料', name_lo = 'ໝາກເຜັດເກືອ (ສຳລັບຈ້ຳ)' WHERE id = 'a9e4f363-56e5-447d-a4bf-4dfc6ff8ab86';
UPDATE public.option_groups SET name_zh = '冰块', name_lo = 'ແຍກ/ໃສ່ນ້ຳກ້ອນ' WHERE id = '153d0097-2f64-4f15-b43b-7bc235fc26b8';
UPDATE public.option_groups SET name_zh = '甜度', name_lo = 'ລະດັບຄວາມຫວານ' WHERE id = 'aca32fcd-5e54-415e-bf9f-34493203fe03';
UPDATE public.option_choices SET name_zh = '加一份浓缩', name_lo = 'ເພີ່ມຊັອດ' WHERE id = '299e0c72-b508-4fe2-940c-1469f9fb7b54';
UPDATE public.option_choices SET name_zh = '荷包蛋', name_lo = 'ໄຂ່ດາວ' WHERE id = '454204e2-f605-4fec-9d82-3ec79dd58cc0';
UPDATE public.option_choices SET name_zh = '水煮蛋', name_lo = 'ໄຂ່ຕົ້ມ' WHERE id = 'ad7354dd-2e2f-4707-bd7e-9bf2d1a5be51';
UPDATE public.option_choices SET name_zh = '低温慢煮温泉蛋', name_lo = 'ໄຂ່ອອນເຊັນຊູວີ' WHERE id = 'f2a2f3e3-0591-441b-b407-36284bdb0bcf';
UPDATE public.option_choices SET name_zh = '鸡尾酒（含酒精）', name_lo = 'ຄັອກເທວ (ມີແອນກໍຮໍ)' WHERE id = '6865ef9f-cc5f-4aef-917f-14cc2e4c0ff2';
UPDATE public.option_choices SET name_zh = '无酒精鸡尾酒（不含酒精）', name_lo = 'ມັອກເທວ (ບໍ່ມີແອນກໍຮໍ)' WHERE id = '7f63e712-9332-412e-a4a7-17c9bf766e76';
UPDATE public.option_choices SET name_zh = 'Bolaven（中度烘焙）：红糖、巧克力、坚果风味，口感柔顺，酸度极低', name_lo = 'Bolaven (ຄົ່ວກາງ): ນ້ຳຕານແດງ ຊັອກໂກແລັດ ຖົ່ວ, ນຸ້ມລະມຸນ ສົ້ມໜ້ອຍຫຼາຍ' WHERE id = 'db39169a-1ac6-44b7-9056-747026a3a9f5';
UPDATE public.option_choices SET name_zh = 'Brazil Santos（中度烘焙）：浓而柔顺，醇厚度高，不酸', name_lo = 'Brazil Santos (ຄົ່ວກາງ): ເຂັ້ມແຕ່ນຸ້ມ, ບໍດີ້ແໜ້ນ ບໍ່ສົ້ມ' WHERE id = 'df1d1ea0-63b5-4048-9ea8-fb2861463c04';
UPDATE public.option_choices SET name_zh = 'Ethiopia Yirgacheffe G2（中度烘焙）：花香与果香', name_lo = 'Ethiopia Yirgacheffe G2 (ຄົ່ວກາງ): ຫອມໂທນດອກໄມ້ ແລະ ໝາກໄມ້' WHERE id = '1cf07ccb-6a22-406d-b086-57aa5d7c349c';
UPDATE public.option_choices SET name_zh = 'Rainy Blend（Brazil + Guatemala）：适合加奶，口感柔顺', name_lo = 'Rainy Blend (Brazil + Guatemala): ເຂົ້າກັບນົມ, ບໍດີ້ນຸ້ມ' WHERE id = '99b19bc5-7ba8-424d-bde8-f49062192ba6';
UPDATE public.option_choices SET name_zh = 'Suan Ya Luang（中度烘焙）：红糖、果香，适合日常饮用', name_lo = 'Suan Ya Luang (ຄົ່ວກາງ): ນ້ຳຕານແດງ ຫອມໝາກໄມ້, ດື່ມໄດ້ທຸກມື້' WHERE id = 'a00967e0-63d2-4d9c-b62a-7894732beeb0';
UPDATE public.option_choices SET name_zh = '白红色', name_lo = 'ສີຂາວ-ແດງ' WHERE id = '06264ca8-3929-48ce-8efa-1819b50b0cc9';
UPDATE public.option_choices SET name_zh = '黑色', name_lo = 'ສີດຳ' WHERE id = '4552ef0f-2fe5-44a9-9ae8-d0798a740b3e';
UPDATE public.option_choices SET name_zh = '冰', name_lo = 'ເຢັນ' WHERE id = '0b345819-92a2-49cc-b8ea-06bda04dc968';
UPDATE public.option_choices SET name_zh = '热', name_lo = 'ຮ້ອນ' WHERE id = 'ee056755-9c1b-475a-8274-db2dc1221632';
UPDATE public.option_choices SET name_zh = '2XL', name_lo = '2XL' WHERE id = '2d668d4f-53f7-44c8-8be8-076061b1d883';
UPDATE public.option_choices SET name_zh = '3XL', name_lo = '3XL' WHERE id = 'e07969df-c16d-44e6-8311-7b9e506cc35d';
UPDATE public.option_choices SET name_zh = '4XL', name_lo = '4XL' WHERE id = 'b508edc4-ae2a-4edf-9ec1-5085a0554723';
UPDATE public.option_choices SET name_zh = 'L', name_lo = 'L' WHERE id = 'afb2a5fe-2774-4e45-8b52-ec7bcacf1de9';
UPDATE public.option_choices SET name_zh = 'M', name_lo = 'M' WHERE id = 'd6720396-842e-408e-82c5-3ad58be1650b';
UPDATE public.option_choices SET name_zh = 'S', name_lo = 'S' WHERE id = '118cc552-75b0-4ae2-9aee-61a0abf4a746';
UPDATE public.option_choices SET name_zh = 'XL', name_lo = 'XL' WHERE id = 'c983be50-fd0c-469f-809f-154873b71969';
UPDATE public.option_choices SET name_zh = '泰式奶茶', name_lo = 'ຊາໄທ' WHERE id = '8bab60a6-dee0-4e60-b989-c9b50c1bbc11';
UPDATE public.option_choices SET name_zh = '青柠茶', name_lo = 'ຊາໝາກນາວ' WHERE id = 'a5ff6f47-cf97-45bf-81e5-130dc775ebcc';
UPDATE public.option_choices SET name_zh = '茉莉花茶', name_lo = 'ຊາດອກມະລິ' WHERE id = '8e26b06a-fdad-46af-908a-0082db362c41';
UPDATE public.option_choices SET name_zh = '红色糖浆青柠苏打', name_lo = 'ນ້ຳແດງໝາກນາວໂຊດາ' WHERE id = '61264676-0007-40bd-bdb3-b3eed5eab965';
UPDATE public.option_choices SET name_zh = '泰式粉红奶', name_lo = 'ນົມສີບົວ' WHERE id = 'bbebe3b6-4858-487a-8cca-0adf9579c146';
UPDATE public.option_choices SET name_zh = '美式咖啡', name_lo = 'ອາເມຣິກາໂນ' WHERE id = '99926459-4727-45d4-8b16-2bf52f48352f';
UPDATE public.option_choices SET name_zh = '不要酱', name_lo = 'ບໍ່ເອົາຊອດ' WHERE id = '1816c2d3-0f84-431f-98c0-e57eef083218';
UPDATE public.option_choices SET name_zh = '要辣椒酱', name_lo = 'ເອົາຊອດໝາກເຜັດ' WHERE id = '178c7b56-f98e-480c-8b76-a393ce407efc';
UPDATE public.option_choices SET name_zh = '要番茄酱', name_lo = 'ເອົາຊອດໝາກເລັ່ນ' WHERE id = 'ef38178e-0c10-4385-98cf-d45148560041';
UPDATE public.option_choices SET name_zh = '加日式酱汁 1 小碗', name_lo = 'ເພີ່ມຊອດຍີ່ປຸ່ນ 1 ຖ້ວຍ' WHERE id = 'a06a62f3-6c1a-48b4-a423-3ca5e5c0c2ea';
UPDATE public.option_choices SET name_zh = 'Oatside 燕麦奶', name_lo = 'ນົມໂອດ Oatside' WHERE id = 'a9cbb5be-1de7-4eaf-a75a-05d5032feddc';
UPDATE public.option_choices SET name_zh = '蜂蜜 15 ml', name_lo = 'ນ້ຳເຜິ້ງ 15 ml' WHERE id = '6a4f13b6-be8b-408d-b06e-858559606cc8';
UPDATE public.option_choices SET name_zh = '蜂蜜 + 柠檬', name_lo = 'ນ້ຳເຜິ້ງ + ເລມອນ' WHERE id = '2646af9f-1a10-4ee0-9c5b-5b33e860b5a2';
UPDATE public.option_choices SET name_zh = '椰子芯', name_lo = 'ຍອດໝາກພ້າວອ່ອນ' WHERE id = '5d7b8a27-c914-436d-8beb-88e15ef83ae7';
UPDATE public.option_choices SET name_zh = '酸笋', name_lo = 'ໜໍ່ໄມ້ສົ້ມ' WHERE id = 'bee580b9-e950-4662-bbbe-fc8d7503e292';
UPDATE public.option_choices SET name_zh = '虾酱辣椒盐', name_lo = 'ໝາກເຜັດເກືອກະປິ' WHERE id = '9b0a0cec-3030-4d40-b8e8-852a9e0fcfcb';
UPDATE public.option_choices SET name_zh = '老挝风味辣椒盐', name_lo = 'ໝາກເຜັດເກືອແບບລາວ' WHERE id = 'fcf4f83b-c257-428d-bb36-db99b4089f71';
UPDATE public.option_choices SET name_zh = '冰块另放', name_lo = 'ແຍກນ້ຳກ້ອນ' WHERE id = 'e5534223-6dcf-4af9-ae23-6751ca77a074';
UPDATE public.option_choices SET name_zh = '加冰，即可饮用', name_lo = 'ໃສ່ນ້ຳກ້ອນ ພ້ອມດື່ມ' WHERE id = '46411dd8-ea9d-4683-94f3-5ee422501f61';
UPDATE public.option_choices SET name_zh = '无糖', name_lo = 'ບໍ່ຫວານ' WHERE id = 'b1d32141-4ab1-400c-ae1d-af1126e6ba88';
UPDATE public.option_choices SET name_zh = '少糖', name_lo = 'ຫວານໜ້ອຍ' WHERE id = '3cd035cf-500b-4f8b-881e-973eeb535e78';
UPDATE public.option_choices SET name_zh = '正常糖', name_lo = 'ຫວານປົກກະຕິ' WHERE id = '5c45ff46-b62e-43e2-8f97-c3d48d57217a';
UPDATE public.option_choices SET name_zh = '多糖', name_lo = 'ຫວານຫຼາຍ' WHERE id = '1dae8901-4315-41bc-a66b-c25740ae75f6';
COMMIT;
