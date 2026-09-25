# iStartup Junior — Season 2

Responsive competition scoreboard for MS Dhoni Global School. The app uses Supabase Auth and Postgres. Projects, judge accounts, scores, and reveal state are stored in the connected Supabase project, not in browser storage.

## Run locally

```powershell
cd "D:\AI\AI Projects\ScoreTracker"
npm install
npm run dev
```

Open the local URL printed by Vite. Run `npm run build` to produce the static site in `dist/`.

The checked-in `.env.example` describes the two browser-safe variables. The configured `.env.local` targets the dedicated iStartup Junior Supabase project and is ignored by Git. Never put a database password or service role key into a `VITE_` variable.

## Event flow

1. The single existing admin signs in through **Admin**. Admin self-signup is disabled.
2. Add projects with a name, description, and team members. Projects can be edited and deleted.
3. Judges select **Judge → Create an account**. Each judge can add multiple numeric scores to a project, edit them, or delete them.
4. In **Reveal controls**, the admin can reveal or hide each judge's scores per project. The public total automatically sums only currently revealed scores.
5. Guests open **Public scores** without an account. The page checks for updates automatically every four seconds.

The `supabase/schema.sql` file contains the initial tables, database checks, access policies, and publish triggers. The `supabase/functions/register/index.ts` Edge Function creates email-confirmed accounts server-side so the app does not require email verification. It uses the service role key only inside Supabase, never in the browser.
