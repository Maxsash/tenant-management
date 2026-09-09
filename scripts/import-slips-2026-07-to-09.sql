-- ===========================================================================
-- Handwritten slip import: July 2026 -> 4 September 2026
-- Source: "Expenses 2026 july aug sept.pdf" (37 scanned slips, Hindi)
--
-- Built against the live catalogue export (expense_categories_rows.csv,
-- expense_items_rows.csv, expenses_rows.csv), so it reuses your existing
-- Hinglish item names (Aaloo, Pyaaz, Gilki ...) rather than inventing new
-- spellings. New items follow the same convention.
--
-- ALREADY IN THE DB, therefore NOT re-imported:
--   3.7.26  the whole kirana bill (28 rows) + Fresh juice
--   4.7.26  Fresh juice
--   6.7.26  Fresh juice, Paneer 90, Envelope 500 (shaadi), Jalebi 150
--   14.7.26 the whole vegetable slip (8 rows, 160)
--
-- Run the whole file at once. It is one transaction: if anything fails,
-- nothing lands. To undo afterwards:
--   delete from expenses where created_at >= '<the timestamp you ran this>';
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- Step 1: put every weight in kg.
--
-- Right now the same vegetable is stored two ways -- Aaloo as (2, 'kg') but
-- Kheera as (500, 'g') -- so sum(quantity) for an item is meaningless, which
-- is exactly the number you said you want to plot. This converts the existing
-- gram rows and their catalogue defaults to kg, and everything imported below
-- is already in kg. 500 g becomes 0.5.
--
-- Drop this block if you would rather keep grams, but then the rows below
-- will not line up with the old ones.
-- ---------------------------------------------------------------------------
update expenses
   set quantity = round(quantity / 1000.0, 3), unit = 'kg'
 where unit = 'g' and quantity is not null;

update expense_items set default_unit = 'kg' where default_unit = 'g';

-- ---------------------------------------------------------------------------
-- Step 2: items the slips need that the catalogue does not have yet.
-- No new categories are needed -- Medical, Religious, Eating Out, Personal,
-- Gifts & Social and Household Help already cover everything on these slips.
-- Repairs (AC, washing machine stand, Dr. Fixit) go under Household.
-- ---------------------------------------------------------------------------
insert into expense_items (name, category, default_unit) values
  -- vegetables
  ('Parwal',                      'Vegetables & Fruits', 'kg'),
  ('Baingan',                     'Vegetables & Fruits', 'kg'),
  ('Lahsun',                      'Vegetables & Fruits', 'kg'),
  ('Adrak',                       'Vegetables & Fruits', 'kg'),
  ('Nimbu',                       'Vegetables & Fruits', 'pcs'),
  -- dairy
  ('Khoya',                       'Dairy', 'kg'),
  ('Amul butter',                 'Dairy', 'kg'),
  -- groceries
  ('Maida',                       'Groceries', 'kg'),
  ('Singhade ka atta',            'Groceries', 'packet'),
  ('Chironji',                    'Groceries', 'kg'),
  ('Moongfali',                   'Groceries', 'kg'),
  ('Mulethi',                     'Groceries', 'kg'),
  ('Krackjack biscuit',           'Groceries', 'packet'),
  ('Bakery biscuit (Jeera)',      'Groceries', 'packet'),
  ('Biscuit (assorted)',          'Groceries', 'packet'),
  ('Kellogs Oats Plain',          'Groceries', 'kg'),
  ('Pasta',                       'Groceries', 'kg'),
  ('Chowmein',                    'Groceries', 'kg'),
  ('Nutrela soya chunks',         'Groceries', 'kg'),
  ('Tulsi green tea',             'Groceries', 'kg'),
  ('Chai patti (Red Label)',      'Groceries', 'kg'),
  ('Fortune refined soyabean oil','Groceries', 'L'),
  ('Paav',                        'Groceries', 'packet'),
  ('Harpic',                      'Groceries', 'L'),
  ('Vanish',                      'Groceries', 'pcs'),
  ('Machis',                      'Groceries', 'pcs'),
  ('Pawan - shop settlement',     'Groceries', null),
  -- personal care
  ('Malish',                      'Personal Care', null),
  ('Shampoo',                     'Personal Care', null),
  ('Dettol handwash',             'Personal Care', 'L'),
  -- medical
  ('Dr. Ortho oil',               'Medical', 'pcs'),
  ('Dettol antiseptic liquid',    'Medical', 'L'),
  -- religious
  ('Peda',                        'Religious', 'kg'),
  ('Nariyal',                     'Religious', 'pcs'),
  ('Prasad',                      'Religious', null),
  ('Mandir mein chadhava',        'Religious', null),
  ('Pooja ka saaman',             'Religious', null),
  ('Hanuman ji ka chola',         'Religious', null),
  ('Dona',                        'Religious', null),
  -- eating out
  ('Gujhiya',                     'Eating Out', null),
  ('Chai',                        'Eating Out', null),
  ('Parcel',                      'Eating Out', null),
  -- household
  ('Rassi',                       'Household', null),
  ('Photo frame',                 'Household', null),
  ('Ghadi ke cell',               'Household', 'pcs'),
  ('Khaad',                       'Household', null),
  ('Daana',                       'Household', null),
  ('Washing machine stand',       'Household', null),
  ('AC repair',                   'Household', null),
  ('Dr. Fixit',                   'Household', 'pcs'),
  -- transport / other
  ('Driver',                      'Transport', null),
  ('Photocopy',                   'Other', null),
  ('Chawal pisai',                'Other', null),
  ('Paise gir gaye',              'Other', null)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Step 3: the expenses.
-- item_id is resolved by name, so a lump row ("<Category> (mixed)", the shape
-- lib/expenses.ts writes in lump mode) simply lands with a null item_id.
-- Every slip was cash. Notes carry the raw slip wording for checking later.
-- ---------------------------------------------------------------------------
insert into expenses
  (expense_date, item_id, item_name, category, quantity, unit, amount,
   payment_method, notes, is_itemized)
select
  v.expense_date::date, i.id, v.item_name, v.category,
  v.quantity::numeric, v.unit, v.amount::numeric,
  'Cash', v.notes, v.is_itemized::boolean
from (values

-- ===== JULY 2026 ==========================================================
-- Only the July lines that are NOT already in the DB. The 3.7.26 kirana bill,
-- the 14.7.26 vegetable slip and the 4.7 / 6.7 juice, paneer, envelope and
-- jalebi rows were all entered already.
--
-- The unlabelled "3.7.26 (1) 300 रु" is deliberately left out: you said it
-- belongs to another slip, so entering it would double count.

('2026-07-05','Pawan - shop settlement','Groceries',null,null,'75','5.7.26 -- 75 रु. पवन को दिये; settling the pending bill at Pawan bhaiya''s shop','true'),
('2026-07-06','Paise gir gaye','Other',null,null,'200','6.7.26 -- 200 रु. गिर गये','true'),

-- 7.7.26 -- vegetable slip in red pen. Slip total 460, lines sum 460.
('2026-07-07','Aaloo','Vegetables & Fruits','3','kg','40','7.7.26 आलू - 3 kg 40','true'),
('2026-07-07','Pyaaz','Vegetables & Fruits','2','kg','80','7.7.26 प्याज - 2 kg 80','true'),
('2026-07-07','Tamatar','Vegetables & Fruits','1','kg','40','7.7.26 टमाटर - 1 kg 40','true'),
('2026-07-07','Lauki','Vegetables & Fruits','0.5','kg','15','7.7.26 लौकी - 1/2 kg 15','true'),
('2026-07-07','Gilki','Vegetables & Fruits','0.5','kg','15','7.7.26 गिलकी - 500 g 15','true'),
('2026-07-07','Parwal','Vegetables & Fruits','0.25','kg','15','7.7.26 परवल - 250 g 15','true'),
('2026-07-07','Bhindi','Vegetables & Fruits','0.25','kg','10','7.7.26 भिन्डी - 250 g 10','true'),
('2026-07-07','Kheera','Vegetables & Fruits','0.5','kg','20','7.7.26 खीरा - 500 g 20','true'),
('2026-07-07','Kaddu','Vegetables & Fruits','0.5','kg','15','7.7.26 कद्दू - 500 g 15','true'),
('2026-07-07','Aam','Vegetables & Fruits',null,'kg','60','7.7.26 आम लंगड़ा / बादाम 60; quantity not written','true'),
('2026-07-07','Nimbu','Vegetables & Fruits','4','pcs','10','7.7.26 नींबू - 4 10','true'),
('2026-07-07','Peda','Religious','0.5','kg','140','7.7.26 पेड़ा - 500 g 140','true'),

-- Undated slips. You said anything without a date is July, so these sit on
-- 15 July 2026 as a placeholder -- move them if you can date them.

-- Vegetable slip whose back reads "500 given / 300 सब्जी / 120 जूस / 80 left".
-- Lines sum 295 against the 300 written on the back.
('2026-07-15','Karela','Vegetables & Fruits','0.25','kg','15','DATE NOT ON SLIP (July). करेला - 250 g 15','true'),
('2026-07-15','Aaloo','Vegetables & Fruits','3','kg','40','DATE NOT ON SLIP (July). आलू - 3 kg 40','true'),
('2026-07-15','Pyaaz','Vegetables & Fruits','2','kg','70','DATE NOT ON SLIP (July). प्याज - 2 kg 70','true'),
('2026-07-15','Tamatar','Vegetables & Fruits','1','kg','40','DATE NOT ON SLIP (July). टमाटर - 1 kg 40','true'),
('2026-07-15','Barbati','Vegetables & Fruits','0.25','kg','10','DATE NOT ON SLIP (July). बरबटी - 250 g 10','true'),
('2026-07-15','Gilki','Vegetables & Fruits','0.75','kg','10','DATE NOT ON SLIP (July). गिलकी - 750 g 10','true'),
('2026-07-15','Parwal','Vegetables & Fruits','0.25','kg','15','DATE NOT ON SLIP (July). परवल - 250 g 15','true'),
('2026-07-15','Kheera','Vegetables & Fruits','0.5','kg','15','DATE NOT ON SLIP (July). खीरा - 500 g 15','true'),
('2026-07-15','Hari Mirch','Vegetables & Fruits',null,null,'0','DATE NOT ON SLIP (July). हरी मिर्च + नींबू listed with no price; the 300 on the back suggests about 5','true'),
('2026-07-15','Aam','Vegetables & Fruits',null,'kg','80','DATE NOT ON SLIP (July). लंगड़ा आम 80; बादाम आम also listed with no price','true'),
('2026-07-15','Fresh juice','Groceries',null,null,'120','DATE NOT ON SLIP (July). Back of that slip: 500 given, 300 सब्जी, 120 जूस, 80 left','true'),

-- Vegetable slip with no date and no total. Lines sum 150.
('2026-07-15','Pyaaz','Vegetables & Fruits','1','kg','40','DATE NOT ON SLIP (July). प्याज - 1 kg 40','true'),
('2026-07-15','Gilki','Vegetables & Fruits','0.5','kg','15','DATE NOT ON SLIP (July). गिलकी - 500 g 15','true'),
('2026-07-15','Bhindi','Vegetables & Fruits','0.25','kg','5','DATE NOT ON SLIP (July). भिन्डी - 250 g 5','true'),
('2026-07-15','Parwal','Vegetables & Fruits','0.25','kg','20','DATE NOT ON SLIP (July). परवल - 250 g 20','true'),
('2026-07-15','Baingan','Vegetables & Fruits','0.5','kg','0','DATE NOT ON SLIP (July). बैंगन गोल - 500 g; no price written on the slip','true'),
('2026-07-15','Hari Mirch','Vegetables & Fruits',null,null,'10','DATE NOT ON SLIP (July). हरी मिर्च 10','true'),
('2026-07-15','Lauki','Vegetables & Fruits','1','kg','20','DATE NOT ON SLIP (July). लौकी - 1 kg 20','true'),
('2026-07-15','Arbi','Vegetables & Fruits','0.5','kg','10','DATE NOT ON SLIP (July). अरबी - 500 g 10','true'),
('2026-07-15','Tamatar','Vegetables & Fruits','1','kg','20','DATE NOT ON SLIP (July). टमाटर - 1 किलो 20','true'),
('2026-07-15','Kheera','Vegetables & Fruits','0.5','kg','10','DATE NOT ON SLIP (July). खीरा - आधा किलो 10','true'),

-- Two snack runs where per-item prices were not written, so they stay lumps.
('2026-07-15','Groceries (mixed)','Groceries',null,null,'350','DATE NOT ON SLIP (July). Real Orange Juice 1, Real Apple Juice 1, Kurkure Jowar Puffs 2, Lays Blue 2 x 20, Kurkure 1 x 20, Dairy Milk Crackle 2. Slip: 500 given, 350 spent, 150 back','false'),
('2026-07-15','Groceries (mixed)','Groceries',null,null,'320','DATE NOT ON SLIP (July). Real Orange Juice 1, Real Apple Juice 1, Bread 2, Lays Blue 2 x 20, Kurkure 1 x 20. Back of slip: 110 + 120 + 40 + 60, total written 320','false'),

-- Small slip: Red label 250 + machis 20 + shampoo 85 = 345. The "Refined 160"
-- written below that subtotal is left out: it is the same purchase as the 150
-- oil row already sitting on 20.7.26.
('2026-07-15','Chai patti (Red Label)','Groceries',null,null,'250','DATE NOT ON SLIP (July). Red label 250','true'),
('2026-07-15','Machis','Groceries',null,null,'20','DATE NOT ON SLIP (July). machis 20','true'),
('2026-07-15','Shampoo','Personal Care',null,null,'85','DATE NOT ON SLIP (July). shampoo 85 (slip subtotal 345)','true'),

('2026-07-15','AC repair','Household',null,null,'1400','DATE NOT ON SLIP (July). 1400 A.C. सुधराई','true'),

-- ===== AUGUST 2026 ========================================================
-- Nothing in August is in the DB yet except the 1.8.26 rows, which none of
-- these slips touch.

-- 3.8.26 -- kirana bill, items 1-33 across two sides of one sheet.
-- The slip works out 2887 - 365 = 2522, i.e. the Kellogs muesli at #31 came
-- off the bill, so it is not imported. Struck-out lines (#4, #5, #14, and
-- Rooh Afza at #29) are not imported either. These lines sum to 2442.
('2026-08-03','Fortune refined sunflower oil','Groceries','1','L','0','Kirana #1: fortune refined sunflower oil - 1 lit; no price written on the slip','true'),
('2026-08-03','Suji','Groceries','2','kg','100','Kirana #2: सूजी - 2 kg 100','true'),
('2026-08-03','Saabudaana (Bareek)','Groceries','1','kg','100','Kirana #3: Nylon साबूदाना (बारीक) - 1 kg 100','true'),
('2026-08-03','Maggi','Groceries','3','pack','174','Kirana #6: Maggi ३ का पैक - 3 174','true'),
('2026-08-03','Masala-e-magic','Groceries','8','packet','40','Kirana #7: Maggi masala-e-magic - 8 40','true'),
('2026-08-03','Eno - Lemon','Groceries','8','packet','80','Kirana #8: Eno lemon - 8 80','true'),
('2026-08-03','Tomato Sauce','Groceries','1','kg','110','Kirana #9: Kissan sauce - 500 g + 500 g 110','true'),
('2026-08-03','Good day biscuit','Groceries','2','packet','90','Kirana #10: Goodday biscuit - 2 90','true'),
('2026-08-03','Krackjack biscuit','Groceries','1','packet','35','Kirana #11: Krackjack - 1 35','true'),
('2026-08-03','Kaju shaped biscuit','Groceries','2','packet','80','Kirana #12: काजू बिस्किट - 2 80','true'),
('2026-08-03','Bourbon biscuit','Groceries','1','packet','40','Kirana #13: Bourbon britannia - 1 40','true'),
('2026-08-03','Kishmish','Groceries','0.25','kg','150','Kirana #15: किशमिश - 250 g 150','true'),
('2026-08-03','Glucon D - Orange','Groceries','0.5','kg','180','Kirana #17: Glucon-D orange - 500 g 180','true'),
('2026-08-03','Pasta','Groceries','0.5','kg','90','Kirana #18: Pasta - 500 g 90','true'),
('2026-08-03','Chowmein','Groceries','0.5','kg','80','Kirana #19: Chow mein (plain noodles) - 500 g 80','true'),
('2026-08-03','Amul butter','Dairy','0.1','kg','63','Kirana #20: Amul butter - 100 g 63','true'),
('2026-08-03','Ariel liquid machine wash','Groceries','1','L','145','Kirana #21: Ariel liquid machine wash - 1 lit 145','true'),
('2026-08-03','Vim bar','Groceries','8','pcs','70','Kirana #22: Vim bar - 8 70','true'),
('2026-08-03','Harpic','Groceries','0.5','L','110','Kirana #23: Harpic - 500 ml 110','true'),
('2026-08-03','Kellogs Oats Plain','Groceries','0.5','kg','0','Kirana #24: Kellogs oats plain - 500 g; no price written on this slip','true'),
('2026-08-03','Vanish','Groceries','1','pcs','75','Kirana #25: Vanish 75','true'),
('2026-08-03','Nutrela soya chunks','Groceries','0.2','kg','80','Kirana #26: Nutrela mini soya chunks - 200 g 80','true'),
('2026-08-03','Dettol handwash','Personal Care','1','L','95','Kirana #28: Dettol liquid handwash - 1 lit 95','true'),
('2026-08-03','Mulethi','Groceries','0.25','kg','80','Kirana #30: मुलेठी - 250 g 80','true'),
('2026-08-03','Dettol antiseptic liquid','Medical','0.1','L','80','Kirana #32: Dettol antiseptic liquid - 100 ml 80','true'),
('2026-08-03','Tulsi green tea','Groceries','0.1','kg','295','Kirana #33: Tulsi green tea organic classic - 100 g 295','true'),
-- #16 is illegible and has no price; #27 (Patanjali natural shampoo) has no
-- price. Neither is imported.
('2026-08-03','Groceries (mixed)','Groceries',null,null,'1500','3.8.26 रु. 1500/ -- a second amount written beside the 2522 kirana total, with no items against it','false'),

-- 6.8.26 -- vegetable slip. Slip total 180, lines sum 180. लौकी struck out.
('2026-08-06','Aaloo','Vegetables & Fruits','2','kg','20','6.8.26 आलू - 2 kg 20','true'),
('2026-08-06','Pyaaz','Vegetables & Fruits','2','kg','70','6.8.26 प्याज - 2 kg 70','true'),
('2026-08-06','Tamatar','Vegetables & Fruits','1','kg','20','6.8.26 टमाटर - 1 kg 20','true'),
('2026-08-06','Kheera','Vegetables & Fruits','0.5','kg','10','6.8.26 खीरा - 500 g 10','true'),
('2026-08-06','Baingan','Vegetables & Fruits','0.5','kg','10','6.8.26 छोटे बैंगन गोल - 500 g 10','true'),
('2026-08-06','Kaddu','Vegetables & Fruits','0.5','kg','10','6.8.26 कद्दू - 500 g 10','true'),
('2026-08-06','Bhindi','Vegetables & Fruits','0.25','kg','5','6.8.26 भिन्डी - 250 g 5','true'),
('2026-08-06','Parwal','Vegetables & Fruits','0.25','kg','20','6.8.26 परवल या टिंडा - 250 g 20','true'),
('2026-08-06','Gilki','Vegetables & Fruits','0.5','kg','15','6.8.26 गिलकी - 500 g 15','true'),

-- 7.8.26 / 8.8.26
('2026-08-07','Eating Out (mixed)','Eating Out',null,null,'150','7.8.26 जलेबी, समोसा, भजिया - 150 रु (one price for all three)','false'),
('2026-08-07','Vegetables & Fruits (mixed)','Vegetables & Fruits',null,null,'170','7.8.26 सेब नाशपाती केला - 170 रु (one price for all three)','false'),
('2026-08-07','Ghadi ke cell','Household',null,null,'40','7.8.26 घड़ी के सेल - 40 रु','true'),
('2026-08-08','Khaad','Household',null,null,'1000','8.8.26 खाद - 1000 रु','true'),
('2026-08-08','Daana','Household',null,null,'100','8.8.26 दाना - 100 रु','true'),

-- 10.8.26 - 12.8.26 (one sheet, both sides)
('2026-08-10','Hanuman ji ka chola','Religious',null,null,'1500','10.8.26 हनुमान जी के चोला - 1500 रु','true'),
('2026-08-10','Gujhiya','Eating Out',null,null,'800','10.8.26 रसभरी गुझिया - 800 रु','true'),
('2026-08-10','Chai','Eating Out',null,null,'40','10.8.26 चाय - 40 रु','true'),
('2026-08-11','Prasad','Religious',null,null,'70','11.8.26 प्रसाद - 70 रु','true'),
('2026-08-11','Mandir mein chadhava','Religious',null,null,'50','11.8.26 मंदिर में चढ़ाया - 50 रु','true'),
('2026-08-11','Parcel','Eating Out',null,null,'240','11.8.26 पार्सल - 240 रु','true'),
('2026-08-11','Malish','Personal Care',null,null,'100','11.8.26 मालिश - 100 रु','true'),
-- the "सब्जी 150" on that sheet is itemised on its own slip, sums to 150
('2026-08-11','Aaloo','Vegetables & Fruits','2','kg','25','11.8.26 आलू - 2 kg 25 (itemises the सब्जी 150 line)','true'),
('2026-08-11','Tamatar','Vegetables & Fruits','1','kg','25','11.8.26 टमाटर - 1 kg 25','true'),
('2026-08-11','Lauki','Vegetables & Fruits','1','kg','20','11.8.26 लौकी - 1 kg 20','true'),
('2026-08-11','Kheera','Vegetables & Fruits','0.5','kg','10','11.8.26 खीरा - 500 g 10','true'),
('2026-08-11','Karela','Vegetables & Fruits','0.5','kg','20','11.8.26 करेला - 500 g 20','true'),
('2026-08-11','Parwal','Vegetables & Fruits','0.25','kg','20','11.8.26 परवल - 250 g 20','true'),
('2026-08-11','Bhindi','Vegetables & Fruits','0.25','kg','5','11.8.26 भिन्डी - 250 g 5','true'),
('2026-08-11','Hari Mirch','Vegetables & Fruits',null,null,'10','11.8.26 हरी मिर्च 10','true'),
('2026-08-11','Gilki','Vegetables & Fruits','0.5','kg','15','11.8.26 गिलकी - 500 g 15','true'),
('2026-08-12','Photocopy','Other',null,null,'50','12.8.26 फोटो कॉपी - 50 रु','true'),
('2026-08-12','Paneer','Dairy',null,null,'125','12.8.26 पनीर व दही - 125 रु (paneer and curd on one price)','true'),

-- 14.8.26 - 16.8.26
('2026-08-14','Dr. Ortho oil','Medical',null,null,'240','14.8.26 डॉ. आर्थो तेल - 240 रु','true'),
('2026-08-14','Parcel','Eating Out',null,null,'1605','14.8.26 पार्सल (तनु) - 1605 रु','true'),
('2026-08-15','Parcel','Eating Out',null,null,'1423','15.8.26 पार्सल (तनु) - 1423 रु','true'),
('2026-08-16','Parcel','Eating Out',null,null,'410','16.8.26 पार्सल (तनु) - 410 रु','true'),
('2026-08-16','Driver','Transport',null,null,'500','16.8.26 ड्राइवर के लिये - 500 रु, यश को','true'),

-- 18.8.26 - 21.8.26. Slip total reads 1145 or 1345; the lines sum 1345.
('2026-08-18','Malish','Personal Care',null,null,'100','18.8.26 मालिश - 100 रु','true'),
('2026-08-19','Malish','Personal Care',null,null,'100','19.8.26 मालिश - 100 रु','true'),
('2026-08-19','Laung Sev','Groceries','1','kg','130','19.8.26 लौंग सेव - 130 रु','true'),
('2026-08-20','Malish','Personal Care',null,null,'100','20.8.26 मालिश - 100 रु','true'),
('2026-08-20','Scooty Fuel','Transport',null,'L','390','20.8.26 पेट्रोल - 390 रु','true'),
('2026-08-21','Vegetables & Fruits (mixed)','Vegetables & Fruits',null,null,'60','21.8.26 फल, नारियल पानी - 60 रु','false'),
('2026-08-21','Vegetables & Fruits (mixed)','Vegetables & Fruits',null,null,'150','21.8.26 सब्जी - 150 रु; no itemised slip for this one','false'),
('2026-08-21','Kellogs Oats Plain','Groceries','0.5','kg','110','21.8.26 "ओडरस" = Oats - 110 रु. The undated Kellogs Plain Oats 500 g / 110 slip is taken as the detail for this line, not a separate purchase','true'),
('2026-08-21','Dr. Fixit','Household','2','pcs','200','21.8.26 डॉ. फिक्सिट - 200 रु; the separate slip reads "Dr. Fixit - 2  200/-"','true'),
('2026-08-21','Photocopy','Other',null,null,'5','21.8.26 फोटो कॉपी - 5 रु','true'),

-- 24.8.26 - 28.8.26
('2026-08-24','Dr. Ortho oil','Medical',null,null,'240','24.8.26 डॉ. आर्थो तेल - 240','true'),
('2026-08-24','Malish','Personal Care',null,null,'100','24.8.26 मालिश - 100','true'),
('2026-08-25','Gujhiya','Eating Out',null,null,'200','25.8.26 रसभरी गुझिया - 200','true'),
('2026-08-26','Malish','Personal Care',null,null,'100','26.8.26 मालिश - 100 रु','true'),
-- "मूसली, बिस्कुट 440" is itemised on its own slip: musli 360 + biscuit 80
('2026-08-26','Muesli- Fruit & Nut Kellogs','Groceries','0.5','kg','360','26.8.26 मूसली 360; pack size not written, taken as 500 g from the July purchase at the same price','true'),
('2026-08-26','Biscuit (assorted)','Groceries',null,null,'80','26.8.26 बिस्कुट 80; brand not written','true'),
-- "सब्जी 180" is itemised on its own slip, sums to 180
('2026-08-26','Arbi','Vegetables & Fruits','0.5','kg','10','26.8.26 अरबी - 500 g 10','true'),
('2026-08-26','Aaloo','Vegetables & Fruits','2','kg','25','26.8.26 आलू - 2 kg 25','true'),
('2026-08-26','Pyaaz','Vegetables & Fruits','1','kg','50','26.8.26 प्याज - 1 kg; the price runs off the torn edge of the slip, so priced at the usual 50/kg. That puts the day at 230 against the 180 written on the day slip','true'),
('2026-08-26','Tamatar','Vegetables & Fruits','1','kg','25','26.8.26 टमाटर - 1 kg 25','true'),
('2026-08-26','Lauki','Vegetables & Fruits','1','kg','25','26.8.26 लौकी - 1 kg 25','true'),
('2026-08-26','Gilki','Vegetables & Fruits','0.75','kg','20','26.8.26 गिलकी - 750 g 20','true'),
('2026-08-26','Barbati','Vegetables & Fruits','0.25','kg','10','26.8.26 बरबटी - 250 g 10','true'),
('2026-08-26','Parwal','Vegetables & Fruits','0.25','kg','20','26.8.26 परवल - 250 g 20','true'),
('2026-08-26','Karela','Vegetables & Fruits','0.5','kg','25','26.8.26 करेला - 500 g 25','true'),
('2026-08-26','Hari Mirch','Vegetables & Fruits',null,null,'10','26.8.26 हरी मिर्च 10','true'),
('2026-08-26','Kheera','Vegetables & Fruits','0.5','kg','10','26.8.26 खीरा - 500 g 10','true'),
('2026-08-27','Malish','Personal Care',null,null,'100','27.8.26 मालिश - 100','true'),
('2026-08-27','Nariyal','Religious',null,'pcs','50','27.8.26 नारियल - 50 रु','true'),
-- "किराना 800" is itemised on its own slip; lines sum 805
('2026-08-27','Good day biscuit','Groceries','2','packet','80','27.8.26 Good day biscuit - 2 80','true'),
('2026-08-27','Kaju shaped biscuit','Groceries','2','packet','80','27.8.26 kaju biscuit - 2 80','true'),
('2026-08-27','Aloo bhujia (Bikano)','Groceries','0.5','kg','110','27.8.26 Aloo Bhujia - 500 g 110','true'),
('2026-08-27','Bakery biscuit (Jeera)','Groceries','1','packet','55','27.8.26 Bakery biscuit (jeera) - 1 55','true'),
('2026-08-27','Maggi','Groceries','2','pack','110','27.8.26 Maggi ४ का पैक - 2 110','true'),
('2026-08-27','Suji','Groceries','1','kg','50','27.8.26 सूजी - 1 kg 50','true'),
('2026-08-27','Fortune refined soyabean oil','Groceries','2','L','320','27.8.26 Fortune refined soyabean - 2 lit 320','true'),
('2026-08-28','Santosh Sweeper','Household Help',null,null,'1000','28.8.26 संतोष स्विफ्ट - 1000 रु','true'),

-- 29.8.26
('2026-08-29','Medicines','Medical',null,null,'630','29.8.26 दवाई - 630 रु. Separate slip lists Asomex 2.5 (30 tab), B Complex capsule (30 tab), Montas L (60 tab), Ecosprin 75 (15 tab); Ecospirin 30 tab and Vicks VapoRub struck out. Working on another slip: 330 + 300 = 630','true'),
('2026-08-29','Photo frame','Household',null,null,'450','29.8.26 फोटो फ्रेम - 450 रु','true'),
('2026-08-29','Moongfali','Groceries',null,'kg','160','29.8.26 मूंगफली - 160 रु','true'),
('2026-08-29','Rassi','Household',null,null,'50','29.8.26 रस्सी - 30 + 20 रु','true'),
('2026-08-29','Vegetables & Fruits (mixed)','Vegetables & Fruits',null,null,'100','29.8.26 सेब, नाशपाती - 100 रु','false'),

('2026-08-31','Washing machine stand','Household',null,null,'950','31.8.26 वाशिंग मशीन स्टैंड - 950 रु','true'),

-- ===== SEPTEMBER 2026 =====================================================

-- 1.9.26 -- the day slip records "सब्जी 395"; the itemised list (two sides of
-- one sheet, items 1-13) sums to 375. The 20 gap is not accounted for.
('2026-09-01','Aaloo','Vegetables & Fruits','3','kg','40','1.9.26 आलू - 3 kg 40','true'),
('2026-09-01','Pyaaz','Vegetables & Fruits','2','kg','70','1.9.26 प्याज - 2 kg 70','true'),
('2026-09-01','Lahsun','Vegetables & Fruits','0.25','kg','50','1.9.26 लहसुन - 250 g 50','true'),
('2026-09-01','Adrak','Vegetables & Fruits','0.2','kg','20','1.9.26 अदरक - 200 g 20','true'),
('2026-09-01','Tamatar','Vegetables & Fruits','1','kg','40','1.9.26 टमाटर - 1 kg 40','true'),
('2026-09-01','Lauki','Vegetables & Fruits','1','kg','25','1.9.26 लौकी - 1 kg 25','true'),
('2026-09-01','Bhindi','Vegetables & Fruits','0.25','kg','10','1.9.26 भिन्डी - 250 g 10','true'),
('2026-09-01','Kheera','Vegetables & Fruits','1','kg','25','1.9.26 खीरा - 1 kg 25 (500 g struck out)','true'),
('2026-09-01','Shimla mirch','Vegetables & Fruits','0.25','kg','20','1.9.26 शिमला मिर्च - 250 g 20','true'),
('2026-09-01','Hari Mirch','Vegetables & Fruits',null,null,'15','1.9.26 हरी मिर्च 15','true'),
('2026-09-01','Kaddu','Vegetables & Fruits','0.5','kg','15','1.9.26 कद्दू - 500 g 15','true'),
('2026-09-01','Baingan','Vegetables & Fruits','0.5','kg','15','1.9.26 गोल बैंगन - 500 g 15','true'),
('2026-09-01','Gilki','Vegetables & Fruits','0.5','kg','30','1.9.26 गिलकी - 500 g 30','true'),
('2026-09-01','Chawal pisai','Other',null,null,'20','1.9.26 चावल पिसाई - 20 रु','true'),
('2026-09-01','Dona','Religious',null,null,'100','1.9.26 दोना के नाऊ को - 100 रु; leaf dona for pooja, brought by the barber','true'),

-- 2.9.26 / 3.9.26
('2026-09-02','Pooja ka saaman','Religious',null,null,'110','2.9.26 पूजा का सामान - 110 रु','true'),
('2026-09-02','LPG Cylinder','Utilities','1',null,'1025','2.9.26 गैस सिलेन्डर - 1025 रु','true'),
('2026-09-02','Paav','Groceries',null,'packet','50','2.9.26 पाव (ब्रेड) - 50 रु','true'),
('2026-09-03','Khoya','Dairy',null,null,'200','3.9.26 खोवा - 200 रु','true'),
('2026-09-03','Parcel','Eating Out',null,null,'500','3.9.26 पार्सल (यश) - 500 रु','true'),

-- 4.9.26 -- the day slip records "फल, दही 200", "मेवा, पूजा का सामान 745" and
-- "पेड़ा 150". The 745 is itemised on another slip (items 1-5 sum to exactly
-- 745) and the peda is item 8 on that same list, so both go in as items.
('2026-09-04','Vegetables & Fruits (mixed)','Vegetables & Fruits',null,null,'200','4.9.26 फल, दही - 200 रु (fruit and curd on one price)','false'),
('2026-09-04','Kishmish','Groceries','0.25','kg','150','4.9.26 किशमिश - 250 g 150','true'),
('2026-09-04','Kaaju','Groceries','0.25','kg','250','4.9.26 काजू - 250 g 250','true'),
('2026-09-04','Chironji','Groceries','0.1','kg','200','4.9.26 चिरौंजी - 100 g 200','true'),
('2026-09-04','Singhade ka atta','Groceries','3','packet','120','4.9.26 सिंघाड़े का आटा - 3 पैकेट 120','true'),
('2026-09-04','Maida','Groceries','0.5','kg','25','4.9.26 मैदा - 500 g 25','true'),
('2026-09-04','Peda','Religious','0.25','kg','150','4.9.26 पेड़ा - 250 g 150','true')
-- "पूजा का पट" is on that slip with no price and the 745 balances without it,
-- so it is not imported.

) as v(expense_date, item_name, category, quantity, unit, amount, notes, is_itemized)
left join expense_items i on i.name = v.item_name;

-- ---------------------------------------------------------------------------
-- Step 4: tidy up rows that were typed as free text before these items
-- existed, so they group with the new ones.
-- ---------------------------------------------------------------------------
update expenses e
   set item_id = i.id
  from expense_items i
 where e.item_id is null and e.item_name = i.name;

update expenses set item_name = 'Bread Plain' where item_name = 'Plain Bread';

commit;

-- ---------------------------------------------------------------------------
-- Checks to run afterwards.
-- ---------------------------------------------------------------------------
-- Month totals:
--   select to_char(expense_date,'YYYY-MM') as month, count(*), sum(amount)
--   from expenses group by 1 order by 1;
--
-- Anything still unlinked (only the "(mixed)" lumps and one-off free text
-- should show up):
--   select item_name, count(*) from expenses where item_id is null
--   group by 1 order by 2 desc;
--
-- Consumption trend, e.g. onion by month:
--   select to_char(expense_date,'YYYY-MM') as month,
--          sum(quantity) as kg, sum(amount) as spend
--   from expenses where item_name = 'Pyaaz' group by 1 order by 1;
--
-- Everything that still needs a look at the scan:
--   select expense_date, item_name, amount, notes from expenses
--   where notes like '%VERIFY%' or amount = 0 order by expense_date;
