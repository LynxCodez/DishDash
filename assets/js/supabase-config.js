/* ============================================================
   DISHDASH — Supabase connection config
   ------------------------------------------------------------
   1. Open your project at https://supabase.com/dashboard
   2. Project Settings → API:
        • copy the "Project URL"       → paste below as SUPABASE_URL
        • copy the "anon public" key   → paste below as SUPABASE_ANON_KEY
   3. Run supabase/schema.sql once in the SQL Editor (see SETUP-SUPABASE.md)
   4. Reload the site — it now syncs through Supabase across browsers.

   The anon key is SAFE to expose in frontend code (it is designed for
   it) — real protection comes from the Row Level Security policies in
   schema.sql. Never paste the service_role key here or anywhere client-side.
   ============================================================ */
'use strict';

window.DD_SUPABASE_CONFIG = {
  SUPABASE_URL: 'https://bmpgjudltyhcvtaswlyy.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtcGdqdWRsdHloY3Z0YXN3bHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MTc5MTMsImV4cCI6MjEwNDE5MzkxM30.4Gej3qx3B47uKdhtoM6cqZ6THiYof9ii6O3qAjWH-I0'
};
