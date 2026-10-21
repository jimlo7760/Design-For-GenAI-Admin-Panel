# Mod Squad Pit Wall

The admin area for [Mod Squad](https://github.com/jimlo7760/Mod-Squad), the app where people describe a car and a vibe, an AI designs the build, and the community votes on it. It was built for the Columbia course *Design for GenAI* (Week 6: Admin Panel).

It talks to the **same Supabase project** as Mod Squad. Everything in it is behind a Google login, and only people whose profile has `is_superadmin = true` get past that.

## What you can do

| Assignment requirement | Where |
| --- | --- |
| Interesting statistics from the data | `/` the dashboard (see [The dashboard](#the-dashboard)) |
| **Read** users and profiles | `/users` (search, sort, page) and `/users/[id]` |
| **Create** AI-generated media | `/media/new` (a build for any user, parts editor, optional prompt) |
| **Read** AI-generated media | `/media` (search, filter, sort, page) and `/media/[id]` |
| **Update** AI-generated media | `/media/[id]/edit` (text, parts, price, and uploading, replacing or removing the AI render) |
| **Delete** AI-generated media | "Delete this build" on `/media/[id]` (its votes and render file go with it) |
| **Read** upvotes, downvotes and ratings | `/votes`: ratings by build, and the full vote log with who voted |
| Every route behind a Google login | `proxy.js`, `requireAdmin()` on every page and action, and the database itself |

Users and votes are read-only on purpose: people edit their own profiles in Mod Squad, and votes belong to the people who cast them.

## The lockout question

> *If this specific database field is required to use your own admin area, won't you be locked out? Given the tools and access you currently have, how could you solve this problem?*

Yes, you would be, and that is the point: nobody can promote themselves from inside the app, so nobody who breaks in can either. The way out is a tool only the project owner has. **The Supabase SQL editor runs as the database owner (`postgres`), not as a signed-in app user**, so it is not subject to the rules that protect the flag. Open **SQL Editor** in the Supabase dashboard and run:

```sql
update public.profiles set is_superadmin = true
 where id = (select id from auth.users where email = 'you@example.com');
```

Sign in once first (so your profile row exists), run it, then reload. If you sign in before you are an admin, the `/denied` page shows this exact statement with your own email filled in. The Table editor (flip the checkbox on your `profiles` row) works too, and so would a script using the service-role key, but the SQL editor needs nothing beyond the dashboard login you already have.

## How access is enforced

There are three locks, and the strongest is the last one, because it is the one a bug in this code cannot open.

1. **`proxy.js`** sends anyone without a valid Google session to `/login`. Only `/login`, `/auth/*` and `robots.txt` are public. This is a fast first redirect, not the security boundary.
2. **`requireAdmin()`** (`lib/auth.js`) is the first line of every page, every data function in `lib/admin-data.js`, and every Server Action. A layout alone would not be enough: layouts do not re-run when you navigate between pages, and Server Actions can be POSTed to without loading any page. It fails closed: if the lookup errors, you are not let in.
3. **The database** (`supabase/admin.sql`). The app uses only the public anon key and the signed-in person's own session. There is **no service-role key anywhere in this app**. What an admin can read or change beyond a normal user is granted by Row Level Security policies and `security definer` functions that each start by checking `is_superadmin()`. A request from a non-admin gets nothing, whatever the app code does.

### A hole that adding the column would have opened

Mod Squad lets every signed-in user update their own `profiles` row from the browser (the profile form does `upsert` with the public anon key). If you just add an `is_superadmin` column, any user can open the browser console and run

```js
supabase.from('profiles').update({ is_superadmin: true }).eq('id', myId)
```

and become an admin. `admin.sql` closes this with a trigger that refuses any change to `is_superadmin` made as `anon` or `authenticated`, which covers everything that arrives through the API (even by an existing admin). A trigger is used rather than column grants because Mod Squad's `profiles.sql` and `assignment4.sql` re-grant table-wide `update` on `profiles` whenever they are re-run, which would silently undo a grant-based fix. The trigger does not depend on grants. Mod Squad's own profile form still works: it only writes names and the avatar link.

One thing to know: `profiles` stays readable by every signed-in user (Mod Squad shows names and photos next to builds), so `is_superadmin` is visible too. It says who the admins are, not how to become one.

## Setup

### 1. Database

Run `supabase/admin.sql` once in the Supabase **SQL Editor**, *after* all of Mod Squad's own SQL files (`profiles.sql`, `assignment4.sql`, `assignment4_photos.sql`, `assignment4_render.sql`, `assignment4_edit.sql`). It checks for them first and tells you what is missing. It is safe to re-run. It adds:

- `profiles.is_superadmin` (default `false`) and the trigger that protects it
- `is_superadmin()`, the one question every other rule asks
- policies that let admins read every vote and part search, delete any build, and manage files in the `build-renders` bucket
- `admin_users()` (users with emails, last sign-in and activity counts), `admin_votes()` (the vote log), `admin_create_build()` and `admin_update_build()`

Then make yourself the first admin (see [the lockout question](#the-lockout-question)).

Mod Squad's per-user limits still apply when an admin acts for someone (10 builds and 5 renders per person per 24 hours), because they live in the database.

### 2. Environment

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | The Supabase project URL (the same one Mod Squad uses). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | The anon (public) key. Access is decided by the database, not by hiding this. |
| `ADMIN_TIME_ZONE` | No | IANA zone for the rush-hour heatmap and day-by-day charts. Default `America/New_York`. |

### 3. Google sign-in

Google sign-in is already set up for the project through Mod Squad, so nothing changes in Google Cloud. In Supabase, **Authentication > URL Configuration**, add this app's callback to the allowed redirect URLs: `http://localhost:3000/auth/callback` and your Vercel URL (see below). The app requests exactly `/auth/callback`, with no extra path or query.

### 4. Run it

```bash
npm install
npm run dev     # http://localhost:3000
```

## Deploying to Vercel

1. In Vercel, **Add New > Project** and import this repository. Add the two `NEXT_PUBLIC_SUPABASE_*` variables.
2. In Supabase **Authentication > URL Configuration**, add the production URL's `/auth/callback`. Each commit also gets its own URL (`https://<project>-<hash>-<team>.vercel.app`), and signing in on one of those only works if it is allowed too, so add a wildcard such as `https://*-<your-team>.vercel.app/**` (Supabase's allow-list supports `*` and `**`).
3. To open the site in a private window for the assignment, turn off **Deployment Protection** for the project (Settings > Deployment Protection). The site is still behind its own Google login.
4. Submit the latest commit-specific URL from the **Deployments** tab, next to your Mod Squad deployment.

## The dashboard

Everything is drawn as plain SVG and HTML on the server (no chart library, no client-side JavaScript for the charts), in Mod Squad's colours, and every chart has a "View as table" twin with the same numbers (the headline gauges are single numbers, so they need none). Colour follows the dataviz rules: one hue for one series, a one-hue ramp for ordered steps, green and red only for up and down votes (always with ▲ and ▼ and the number beside them), and the four chart colours were checked for colour-blind separation against both the light and dark surfaces.

| Chart | What it answers |
| --- | --- |
| **Tachometer** | What share of all votes are upvotes? The one number the squad lives by. |
| **Gauges** | Drivers, builds, votes, renders, total "dream spend" and the median price tag, with this week against last week. |
| **The last 30 days** | Builds, votes and new drivers per day; this week stands out. |
| **From sign-in to being judged** | Where drivers drop out: signed in, added a name, generated a build, got a vote. |
| **Rush hour** | A weekday-by-hour heatmap of when the garage is busy, in your time zone. |
| **Most-modded makes** | Which cars people dream about, with each make's average score and price. |
| **Where the money goes** | Spend per part category, and how many builds include it. |
| **Does money buy love?** | Estimated cost against net score, with a rank correlation in plain words. |
| **Crowd favorites / Most divisive** | Highest scores, and builds whose votes split closest to evenly from a real crowd. |
| **Who judges how?** | Every voter placed by the share of their votes that were upvotes: the generous and the tough. |
| **The AI's report card** | How often owners rewrite the AI's parts list, how many builds got a render, and which models wrote and drew them. |
| **The vibe vocabulary** | The words people use, and which vibes score well or badly. |
| **Hall of fame / Most wanted parts** | Top creators, and what owners search for when adding a part. |

The statistics live in `lib/stats.js` as pure functions with their own tests. The correlation is Spearman's (on ranks), so one very expensive build cannot skew it, and nothing claims a trend from fewer than 8 builds or a "toughest voter" from fewer than 3 votes. The dashboard reads up to 20,000 rows per table and says so if it hits that.

## Tests

```bash
npm test
```

runs the unit tests (statistics, parts-list validation, search sanitising, render paths, number and date formatting, chart geometry).

`test/db/` tests the database side against a throwaway local Postgres (developed against 16): it loads Mod Squad's real SQL files, applies `supabase/admin.sql` twice, then tries to break in as a normal user (promote themselves by `update`, by upsert, through an admin function, delete or edit someone else's build, read other people's votes), and checks that Mod Squad's own profile form still works afterwards.

```bash
MOD_SQUAD_DIR=/path/to/Mod-Squad PGHOST=/path/to/socket PGUSER=you test/db/run.sh
```

## Project structure

```
app/
  (admin)/               Every admin page, behind one layout (and a check in each page)
    page.js              Dashboard
    users/ media/ votes/ Lists, detail pages and forms; media/actions.js holds the Server Actions
  login/ denied/ auth/   The only public routes, and the "signed in but not an admin" page
components/              Header, tables' building blocks, forms, and charts/ (the SVG charts)
lib/
  auth.js                getAdmin() and requireAdmin()
  admin-data.js          The only place that reads the database (every function checks admin first)
  stats.js brands.js     Dashboard statistics
  media-form.js mods.js  Validation shared with Mod Squad's parts-list rules
  supabase/              Browser, server and session-refresh clients
proxy.js                 Redirects signed-out visitors and refreshes sessions
supabase/admin.sql       Everything the database needs
test/                    Unit tests, and db/ for the database tests
```

## Notes and limits

- Next.js 16 differs from earlier releases (`proxy.js` replaces `middleware.js`, `cookies()` and `searchParams` are async, error boundaries get `retry`). The docs for the installed version are in `node_modules/next/dist/docs/`.
- `@supabase/ssr` (0.12.0) and `@supabase/supabase-js` (2.109.0) are pinned to exactly what Mod Squad uses. `supabase-js` 2.110 and later require Node 22, so a loose version range would make `npm install` warn on Node 20 (and `package.json` allows Node 20.9 and up).
- "New media" creates a build by hand. It does not call the AI; Mod Squad's generator remains the place that does.
- Deleting a build also deletes its render file from Storage. It does not delete the owner's own uploaded car photo or the Wikimedia reference link.
- The owner picker on New media lists up to 1,000 users.
