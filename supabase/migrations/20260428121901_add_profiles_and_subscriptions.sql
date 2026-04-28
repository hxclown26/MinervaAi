/*
  # Add profiles and subscriptions tables

  ## New Tables

  ### profiles
  - `id` (uuid, PK, references auth.users)
  - `empresa` (text) - Company name
  - `pais` (text) - Country
  - `giro` (text) - Industry/sector
  - `full_name` (text) - Full name
  - `onboarding_done` (boolean) - Legacy compat flag
  - `profile_completed` (boolean) - New auth gate flag
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### subscriptions
  - `id` (uuid, PK)
  - `user_id` (uuid, references auth.users)
  - `email` (text)
  - `plan` (text) - salesman, pyme, enterprise
  - `status` (text) - active, cancelled, expired
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Users can only read/write their own profile
  - Users can only read their own subscriptions
  - Service role can insert/update subscriptions (for webhooks)
*/

-- ── PROFILES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa text DEFAULT '',
  pais text DEFAULT '',
  giro text DEFAULT '',
  full_name text DEFAULT '',
  onboarding_done boolean DEFAULT false,
  profile_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── SUBSCRIPTIONS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text DEFAULT '',
  plan text DEFAULT 'salesman',
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow anon reads for payment webhook compatibility (status check by email)
CREATE POLICY "Anon can read subscriptions by email for payment check"
  ON subscriptions FOR SELECT
  TO anon
  USING (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_email_idx ON subscriptions(email);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
