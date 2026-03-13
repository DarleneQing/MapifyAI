-- Migration: Seed demo data for testing and offline demos
-- Provides 20 sample stores in Zurich area for US-26 (Demo seed data)
-- Set is_seed_data = true so these never expire

-- ---------------------------------------------------------------------------
-- Demo stores in Zurich area
-- ---------------------------------------------------------------------------
insert into public.stores (
  place_id, name, category, subcategories, location, address, city,
  rating, review_count, price_level, opening_hours, is_open_now,
  is_seed_data, crawled_at
) values
-- Hair salons
('ChIJ_demo_hair_01', 'Zurich Style Studio', 'hair_salon', array['haircut', 'coloring'], 
 st_makepoint(8.5417, 47.3769)::geography, 'Bahnhofstrasse 25', 'Zürich',
 4.7, 342, 3, '{"monday": {"open": "09:00", "close": "19:00"}, "tuesday": {"open": "09:00", "close": "19:00"}, "wednesday": {"open": "09:00", "close": "19:00"}, "thursday": {"open": "09:00", "close": "21:00"}, "friday": {"open": "09:00", "close": "19:00"}, "saturday": {"open": "10:00", "close": "17:00"}, "sunday": null}'::jsonb,
 true, true, now()),

('ChIJ_demo_hair_02', 'Coiffeur Bellevue', 'hair_salon', array['haircut', 'styling'],
 st_makepoint(8.5450, 47.3667)::geography, 'Bellevueplatz 3', 'Zürich',
 4.5, 218, 2, '{"monday": {"open": "08:30", "close": "18:30"}, "tuesday": {"open": "08:30", "close": "18:30"}, "wednesday": {"open": "08:30", "close": "18:30"}, "thursday": {"open": "08:30", "close": "20:00"}, "friday": {"open": "08:30", "close": "18:30"}, "saturday": {"open": "09:00", "close": "16:00"}, "sunday": null}'::jsonb,
 true, true, now()),

('ChIJ_demo_hair_03', 'Budget Cuts Express', 'hair_salon', array['haircut'],
 st_makepoint(8.5300, 47.3780)::geography, 'Langstrasse 45', 'Zürich',
 4.1, 567, 1, '{"monday": {"open": "10:00", "close": "20:00"}, "tuesday": {"open": "10:00", "close": "20:00"}, "wednesday": {"open": "10:00", "close": "20:00"}, "thursday": {"open": "10:00", "close": "20:00"}, "friday": {"open": "10:00", "close": "20:00"}, "saturday": {"open": "10:00", "close": "18:00"}, "sunday": {"open": "12:00", "close": "17:00"}}'::jsonb,
 true, true, now()),

-- Car wash
('ChIJ_demo_carwash_01', 'SparkleWash Zurich', 'car_wash', array['hand_wash', 'detailing'],
 st_makepoint(8.5150, 47.3890)::geography, 'Industriestrasse 12', 'Zürich',
 4.6, 189, 2, '{"monday": {"open": "07:00", "close": "20:00"}, "tuesday": {"open": "07:00", "close": "20:00"}, "wednesday": {"open": "07:00", "close": "20:00"}, "thursday": {"open": "07:00", "close": "20:00"}, "friday": {"open": "07:00", "close": "20:00"}, "saturday": {"open": "08:00", "close": "18:00"}, "sunday": {"open": "09:00", "close": "16:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_carwash_02', 'AutoGlanz Premium', 'car_wash', array['automatic', 'premium_detail'],
 st_makepoint(8.5500, 47.4000)::geography, 'Thurgauerstrasse 88', 'Zürich',
 4.8, 456, 3, '{"monday": {"open": "06:00", "close": "22:00"}, "tuesday": {"open": "06:00", "close": "22:00"}, "wednesday": {"open": "06:00", "close": "22:00"}, "thursday": {"open": "06:00", "close": "22:00"}, "friday": {"open": "06:00", "close": "22:00"}, "saturday": {"open": "07:00", "close": "20:00"}, "sunday": {"open": "08:00", "close": "18:00"}}'::jsonb,
 true, true, now()),

-- Restaurants
('ChIJ_demo_restaurant_01', 'Zeughauskeller', 'restaurant', array['swiss', 'traditional'],
 st_makepoint(8.5395, 47.3725)::geography, 'Bahnhofstrasse 28a', 'Zürich',
 4.4, 2341, 2, '{"monday": {"open": "11:30", "close": "23:00"}, "tuesday": {"open": "11:30", "close": "23:00"}, "wednesday": {"open": "11:30", "close": "23:00"}, "thursday": {"open": "11:30", "close": "23:00"}, "friday": {"open": "11:30", "close": "23:30"}, "saturday": {"open": "11:30", "close": "23:30"}, "sunday": {"open": "11:30", "close": "22:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_restaurant_02', 'Hiltl Vegetarian', 'restaurant', array['vegetarian', 'buffet'],
 st_makepoint(8.5385, 47.3732)::geography, 'Sihlstrasse 28', 'Zürich',
 4.6, 1876, 2, '{"monday": {"open": "06:00", "close": "23:00"}, "tuesday": {"open": "06:00", "close": "23:00"}, "wednesday": {"open": "06:00", "close": "23:00"}, "thursday": {"open": "06:00", "close": "23:00"}, "friday": {"open": "06:00", "close": "24:00"}, "saturday": {"open": "08:00", "close": "24:00"}, "sunday": {"open": "08:00", "close": "23:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_restaurant_03', 'Clouds Restaurant', 'restaurant', array['fine_dining', 'international'],
 st_makepoint(8.5310, 47.3870)::geography, 'Maagplatz 5', 'Zürich',
 4.7, 892, 4, '{"monday": null, "tuesday": {"open": "18:00", "close": "23:00"}, "wednesday": {"open": "18:00", "close": "23:00"}, "thursday": {"open": "18:00", "close": "23:00"}, "friday": {"open": "18:00", "close": "24:00"}, "saturday": {"open": "18:00", "close": "24:00"}, "sunday": null}'::jsonb,
 false, true, now()),

-- Cafes
('ChIJ_demo_cafe_01', 'Sprüngli Confiserie', 'cafe', array['chocolate', 'pastry'],
 st_makepoint(8.5397, 47.3695)::geography, 'Paradeplatz', 'Zürich',
 4.5, 3421, 3, '{"monday": {"open": "07:30", "close": "18:30"}, "tuesday": {"open": "07:30", "close": "18:30"}, "wednesday": {"open": "07:30", "close": "18:30"}, "thursday": {"open": "07:30", "close": "18:30"}, "friday": {"open": "07:30", "close": "18:30"}, "saturday": {"open": "08:00", "close": "17:00"}, "sunday": null}'::jsonb,
 true, true, now()),

('ChIJ_demo_cafe_02', 'Cafe Odeon', 'cafe', array['historic', 'coffee'],
 st_makepoint(8.5453, 47.3668)::geography, 'Limmatquai 2', 'Zürich',
 4.3, 1234, 2, '{"monday": {"open": "07:00", "close": "23:00"}, "tuesday": {"open": "07:00", "close": "23:00"}, "wednesday": {"open": "07:00", "close": "23:00"}, "thursday": {"open": "07:00", "close": "23:00"}, "friday": {"open": "07:00", "close": "24:00"}, "saturday": {"open": "08:00", "close": "24:00"}, "sunday": {"open": "09:00", "close": "22:00"}}'::jsonb,
 true, true, now()),

-- Gyms
('ChIJ_demo_gym_01', 'Migros Fitnesscenter', 'gym', array['fitness', 'group_classes'],
 st_makepoint(8.5350, 47.3750)::geography, 'Seidengasse 1', 'Zürich',
 4.2, 567, 1, '{"monday": {"open": "06:00", "close": "22:00"}, "tuesday": {"open": "06:00", "close": "22:00"}, "wednesday": {"open": "06:00", "close": "22:00"}, "thursday": {"open": "06:00", "close": "22:00"}, "friday": {"open": "06:00", "close": "22:00"}, "saturday": {"open": "08:00", "close": "20:00"}, "sunday": {"open": "09:00", "close": "18:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_gym_02', 'Holmes Place Zurich', 'gym', array['premium', 'spa', 'personal_training'],
 st_makepoint(8.5480, 47.3720)::geography, 'Seefeldstrasse 123', 'Zürich',
 4.6, 345, 4, '{"monday": {"open": "06:00", "close": "23:00"}, "tuesday": {"open": "06:00", "close": "23:00"}, "wednesday": {"open": "06:00", "close": "23:00"}, "thursday": {"open": "06:00", "close": "23:00"}, "friday": {"open": "06:00", "close": "22:00"}, "saturday": {"open": "08:00", "close": "20:00"}, "sunday": {"open": "08:00", "close": "20:00"}}'::jsonb,
 true, true, now()),

-- Pharmacies
('ChIJ_demo_pharmacy_01', 'Bellevue Apotheke', 'pharmacy', array['24h', 'prescription'],
 st_makepoint(8.5448, 47.3665)::geography, 'Theaterstrasse 14', 'Zürich',
 4.4, 234, 2, '{"monday": {"open": "00:00", "close": "24:00"}, "tuesday": {"open": "00:00", "close": "24:00"}, "wednesday": {"open": "00:00", "close": "24:00"}, "thursday": {"open": "00:00", "close": "24:00"}, "friday": {"open": "00:00", "close": "24:00"}, "saturday": {"open": "00:00", "close": "24:00"}, "sunday": {"open": "00:00", "close": "24:00"}}'::jsonb,
 true, true, now()),

-- Supermarkets
('ChIJ_demo_super_01', 'Coop City Bahnhofstrasse', 'supermarket', array['grocery', 'deli'],
 st_makepoint(8.5395, 47.3745)::geography, 'Bahnhofstrasse 57', 'Zürich',
 4.1, 1456, 2, '{"monday": {"open": "08:00", "close": "21:00"}, "tuesday": {"open": "08:00", "close": "21:00"}, "wednesday": {"open": "08:00", "close": "21:00"}, "thursday": {"open": "08:00", "close": "21:00"}, "friday": {"open": "08:00", "close": "21:00"}, "saturday": {"open": "08:00", "close": "20:00"}, "sunday": null}'::jsonb,
 true, true, now()),

('ChIJ_demo_super_02', 'Migros Hauptbahnhof', 'supermarket', array['grocery', 'convenience'],
 st_makepoint(8.5403, 47.3782)::geography, 'Bahnhofplatz 15', 'Zürich',
 4.0, 2134, 2, '{"monday": {"open": "06:00", "close": "22:00"}, "tuesday": {"open": "06:00", "close": "22:00"}, "wednesday": {"open": "06:00", "close": "22:00"}, "thursday": {"open": "06:00", "close": "22:00"}, "friday": {"open": "06:00", "close": "22:00"}, "saturday": {"open": "07:00", "close": "22:00"}, "sunday": {"open": "08:00", "close": "21:00"}}'::jsonb,
 true, true, now()),

-- Dentists
('ChIJ_demo_dentist_01', 'Zahnärztezentrum Zürich', 'dentist', array['general', 'cosmetic'],
 st_makepoint(8.5420, 47.3710)::geography, 'Talstrasse 58', 'Zürich',
 4.7, 189, 3, '{"monday": {"open": "08:00", "close": "18:00"}, "tuesday": {"open": "08:00", "close": "18:00"}, "wednesday": {"open": "08:00", "close": "18:00"}, "thursday": {"open": "08:00", "close": "20:00"}, "friday": {"open": "08:00", "close": "17:00"}, "saturday": null, "sunday": null}'::jsonb,
 true, true, now()),

-- Banks
('ChIJ_demo_bank_01', 'UBS Paradeplatz', 'bank', array['retail', 'wealth_management'],
 st_makepoint(8.5390, 47.3697)::geography, 'Bahnhofstrasse 45', 'Zürich',
 4.0, 567, null, '{"monday": {"open": "08:30", "close": "16:30"}, "tuesday": {"open": "08:30", "close": "16:30"}, "wednesday": {"open": "08:30", "close": "16:30"}, "thursday": {"open": "08:30", "close": "18:00"}, "friday": {"open": "08:30", "close": "16:30"}, "saturday": null, "sunday": null}'::jsonb,
 true, true, now()),

-- Pet services
('ChIJ_demo_pet_01', 'Tierklinik Zürich', 'veterinarian', array['emergency', 'surgery'],
 st_makepoint(8.5250, 47.3650)::geography, 'Winterthurerstrasse 260', 'Zürich',
 4.8, 423, 3, '{"monday": {"open": "00:00", "close": "24:00"}, "tuesday": {"open": "00:00", "close": "24:00"}, "wednesday": {"open": "00:00", "close": "24:00"}, "thursday": {"open": "00:00", "close": "24:00"}, "friday": {"open": "00:00", "close": "24:00"}, "saturday": {"open": "00:00", "close": "24:00"}, "sunday": {"open": "00:00", "close": "24:00"}}'::jsonb,
 true, true, now()),

-- Electronics repair
('ChIJ_demo_repair_01', 'iRepair Zurich', 'electronics_repair', array['phone', 'laptop'],
 st_makepoint(8.5380, 47.3760)::geography, 'Löwenstrasse 29', 'Zürich',
 4.5, 678, 2, '{"monday": {"open": "09:00", "close": "19:00"}, "tuesday": {"open": "09:00", "close": "19:00"}, "wednesday": {"open": "09:00", "close": "19:00"}, "thursday": {"open": "09:00", "close": "19:00"}, "friday": {"open": "09:00", "close": "19:00"}, "saturday": {"open": "10:00", "close": "17:00"}, "sunday": null}'::jsonb,
 true, true, now()),

-- Laundry
('ChIJ_demo_laundry_01', 'Quick Wash Zurich', 'laundry', array['self_service', 'dry_cleaning'],
 st_makepoint(8.5320, 47.3800)::geography, 'Josefstrasse 102', 'Zürich',
 4.2, 234, 1, '{"monday": {"open": "07:00", "close": "22:00"}, "tuesday": {"open": "07:00", "close": "22:00"}, "wednesday": {"open": "07:00", "close": "22:00"}, "thursday": {"open": "07:00", "close": "22:00"}, "friday": {"open": "07:00", "close": "22:00"}, "saturday": {"open": "08:00", "close": "20:00"}, "sunday": {"open": "09:00", "close": "18:00"}}'::jsonb,
 true, true, now())

on conflict (place_id) do nothing;

-- ---------------------------------------------------------------------------
-- Demo review summaries for some stores
-- ---------------------------------------------------------------------------
insert into public.review_summaries (store_id, advantages, disadvantages, star_reasons, overall_summary, sentiment_score)
select 
  s.id,
  case s.name
    when 'Zurich Style Studio' then array['Excellent stylists with international experience', 'Modern techniques and trendy cuts', 'Great atmosphere and service', 'Good coffee while waiting']
    when 'Budget Cuts Express' then array['Very affordable prices', 'No appointment needed', 'Quick service', 'Convenient location']
    when 'SparkleWash Zurich' then array['Thorough hand wash quality', 'Friendly staff', 'Good interior cleaning', 'Reasonable prices']
    when 'Hiltl Vegetarian' then array['Best vegetarian buffet in Zurich', 'Historic restaurant since 1898', 'Great variety of dishes', 'Excellent vegan options']
    else array['Good service', 'Convenient location', 'Fair prices']
  end,
  case s.name
    when 'Zurich Style Studio' then array['Expensive for basic cuts', 'Sometimes hard to get appointments', 'Parking is difficult']
    when 'Budget Cuts Express' then array['Basic styling only', 'Can be crowded on weekends', 'No fancy treatments available']
    when 'SparkleWash Zurich' then array['Can be busy on weekends', 'Premium services are pricey', 'Limited waiting area']
    when 'Hiltl Vegetarian' then array['Can be crowded at lunch', 'Buffet price is per weight', 'Service can be slow when busy']
    else array['Can be busy at peak times', 'Limited parking']
  end,
  '{"5": ["Exceptional quality", "Highly recommended"], "4": ["Good overall experience"], "3": ["Average service"], "2": ["Some issues"], "1": ["Major problems"]}'::jsonb,
  case s.name
    when 'Zurich Style Studio' then 'Premium hair salon known for skilled stylists and modern techniques. Best for those willing to pay for quality.'
    when 'Budget Cuts Express' then 'No-frills haircuts at budget prices. Perfect for quick, simple cuts without the wait for appointments.'
    when 'SparkleWash Zurich' then 'Reliable hand car wash with attention to detail. Good balance of quality and price.'
    when 'Hiltl Vegetarian' then 'World''s oldest vegetarian restaurant. A must-visit for anyone interested in plant-based cuisine.'
    else 'A reliable local business with good reviews.'
  end,
  case 
    when s.rating >= 4.5 then 0.8
    when s.rating >= 4.0 then 0.6
    when s.rating >= 3.5 then 0.4
    else 0.2
  end
from public.stores s
where s.is_seed_data = true
  and s.name in ('Zurich Style Studio', 'Budget Cuts Express', 'SparkleWash Zurich', 'Hiltl Vegetarian')
on conflict (store_id) do nothing;

-- ---------------------------------------------------------------------------
-- Demo user profile
-- ---------------------------------------------------------------------------
insert into public.user_profiles (
  user_id, persona, budget_level, travel_purpose, special_needs,
  weight_price, weight_distance, weight_rating, weight_transit,
  preferred_categories, language, onboarding_completed
) values (
  'demo-user-001',
  'student',
  'budget',
  'daily_errands',
  array['none'],
  0.35, 0.25, 0.20, 0.20,
  array['hair_salon', 'restaurant', 'cafe'],
  'en',
  true
) on conflict (user_id) do nothing;
