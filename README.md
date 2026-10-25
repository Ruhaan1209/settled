# Settled

End the "where should we eat / what should we watch" group chat debate.

One person creates a room and shares the link. Friends join from their phones, add options, and vote yes or no on each one. The app picks the winner, breaking ties at random. No signup required.

## Tech

- **React + Vite** (JavaScript, functional components and hooks)
- **Supabase** for the database, realtime updates and anonymous auth
- **Vercel** for hosting
- Plain CSS, mobile-first, with the self-hosted Inter font and automatic light/dark mode

## How it works

- Every visitor gets an invisible anonymous Supabase account, so each device is a distinct user with no login.
- The app only reads from the database. All writes go through Postgres functions (`supabase/schema.sql`) that enforce the rules: only the host starts voting, one vote per person per option, and so on.
- The winner, including the random tie-break, is chosen inside the database, so every phone shows the same result.
- Options and votes are tagged with a round number; "Play again" starts a new round and carries the option list forward.

## Running locally

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run `supabase/schema.sql`.
3. In **Authentication → Sign In / Providers**, enable anonymous sign-ins.
4. Copy `.env.example` to `.env.local` and fill in the Project URL and anon key from **Project Settings → API**.
5. Run:

   ```bash
   npm install
   npm run dev
   ```

## Usage stats

`supabase/stats.sql` has queries for total users, daily signups, weekly active users, completion rate, and more.

## Status

- [x] Home screen and room creation
- [x] Live lobby
- [x] Voting
- [x] Results and play again
- [x] Join by room code
