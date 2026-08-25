-- The one thing the language switch could never reach.
--
-- Every visible string in this shop is a hand-written pair — English and
-- Nepali, chosen at render time. Every string except the ones that matter most:
-- a shoe's name and its description come out of this table, and this table
-- holds one of each. So a shopper who has pressed ने still reads "close shoes",
-- "jeans shoes", "halka fom". The switch turns the furniture and leaves the
-- goods in English.
--
-- That is what the owner meant by "system le didaina" — the system genuinely
-- does not allow it, and no amount of translating components would have fixed
-- it. It needed a column.
--
-- Nullable on purpose. A product with no Nepali name falls back to the English
-- one, which is exactly today's behaviour, so this migration changes nothing
-- until somebody types a word. The owner fills these in from /admin/products,
-- one shoe at a time, and each one improves the moment it is saved.

ALTER TABLE products ADD COLUMN IF NOT EXISTS name_ne TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS description_ne TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS long_description_ne TEXT;
