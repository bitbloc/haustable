-- 1. Create Menu Categories Table
create table if not exists menu_categories (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  name text not null,
  display_order int default 0
);

-- 2. Create Option Groups Table
create table if not exists option_groups (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  name text not null,
  is_required boolean default false,
  selection_type text default 'single', -- 'single' or 'multiple'
  min_selection int default 0,
  max_selection int default 1
);

-- 3. Create Option Choices Table
create table if not exists option_choices (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  group_id uuid references option_groups(id) on delete cascade,
  name text not null,
  price_modifier decimal(10,2) default 0.00,
  is_available boolean default true,
  display_order int default 0
);

-- 4. Create Link Table (Menu Items <-> Option Groups)
create table if not exists menu_item_options (
  menu_item_id bigint references menu_items(id) on delete cascade,
  option_group_id uuid references option_groups(id) on delete cascade,
  display_order int default 0,
  primary key (menu_item_id, option_group_id)
);

-- 5. Update Menu Items Table
-- Add new columns safely
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'menu_items' and column_name = 'category_id') then
    alter table menu_items add column category_id uuid references menu_categories(id) on delete set null;
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'menu_items' and column_name = 'description') then
    alter table menu_items add column description text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'menu_items' and column_name = 'is_recommended') then
    alter table menu_items add column is_recommended boolean default false;
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'menu_items' and column_name = 'image_url') then
    alter table menu_items add column image_url text;
  end if;
end $$;

-- 6. Enable RLS (Optional but recommended)
alter table menu_categories enable row level security;
alter table option_groups enable row level security;
alter table option_choices enable row level security;
alter table menu_item_options enable row level security;

-- Open access for now (or adjust as needed)
create policy "Public read categories" on menu_categories for select using (true);
create policy "Public read option groups" on option_groups for select using (true);
create policy "Public read option choices" on option_choices for select using (true);
create policy "Public read menu item options" on menu_item_options for select using (true);

-- Allow Insert/Update for authenticated users (Admin)
create policy "Enable all for users" on menu_categories using (true) with check (true);
create policy "Enable all for users" on option_groups using (true) with check (true);
create policy "Enable all for users" on option_choices using (true) with check (true);
create policy "Enable all for users" on menu_item_options using (true) with check (true);
