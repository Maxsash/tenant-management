-- Run once in the Supabase SQL editor to set up the expenses module.

create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  icon text not null default '📦',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists expense_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  default_unit text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  item_id uuid references expense_items(id) on delete set null,
  item_name text not null,
  category text not null,
  quantity numeric,
  unit text,
  amount numeric not null,
  payment_method text not null,
  notes text,
  is_itemized boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- safety net in case this script already ran once before is_itemized existed
alter table expenses add column if not exists is_itemized boolean not null default true;

create index if not exists expenses_expense_date_idx on expenses (expense_date);

insert into expense_categories (name, icon, sort_order) values
  ('Dairy', '🥛', 0),
  ('Vegetables & Fruits', '🥕', 1),
  ('Groceries', '🛒', 2),
  ('Utilities', '💡', 3),
  ('Household', '🏠', 4),
  ('Household Help', '🧹', 5),
  ('Subscriptions', '📺', 6),
  ('Transport', '⛽', 7),
  ('Personal Care', '🧴', 8),
  ('Other', '📦', 9)
on conflict (name) do nothing;

insert into expense_items (name, category, default_unit) values
  ('Milk', 'Dairy', 'L'),
  ('Curd', 'Dairy', 'kg'),
  ('Potato', 'Vegetables & Fruits', 'kg'),
  ('Onion', 'Vegetables & Fruits', 'kg'),
  ('Tomato', 'Vegetables & Fruits', 'kg'),
  ('Rice', 'Groceries', 'kg'),
  ('Wheat Flour (Atta)', 'Groceries', 'kg'),
  ('Cooking Oil', 'Groceries', 'L'),
  ('LPG Cylinder', 'Utilities', null),
  ('Electricity Bill', 'Utilities', null),
  ('Water Bill', 'Utilities', null),
  ('Wifi Bill', 'Utilities', null),
  ('Mobile Recharge', 'Utilities', null),
  ('Newspaper', 'Household', null),
  ('General Househelp', 'Household Help', null),
  ('Milkman', 'Household Help', null),
  ('Cook', 'Household Help', null),
  ('Utensil Washer', 'Household Help', null),
  ('Brooming & Mopping Lady', 'Household Help', null),
  ('Sweeper', 'Household Help', null),
  ('Netflix', 'Subscriptions', null),
  ('Sony LIV', 'Subscriptions', null),
  ('Hotstar', 'Subscriptions', null),
  ('Scooty Fuel', 'Transport', 'L'),
  ('Car Fuel', 'Transport', 'L')
on conflict (name) do nothing;
