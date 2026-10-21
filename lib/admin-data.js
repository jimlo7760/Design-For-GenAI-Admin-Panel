// The Data Access Layer: the only place the admin area reads from the database.
//
// Every function starts with requireAdmin(), so no page can forget the check, and every query runs
// as the signed-in person with the public anon key. The database then applies its own rules a
// second time (supabase/admin.sql): a caller who is not a superadmin gets nothing from the admin
// functions and no extra rows from the tables, whatever this code does.
import 'server-only';
import { notFound } from 'next/navigation';
import { requireAdmin } from './auth';
import { createClient } from './supabase/server';
import { computeDashboard, DEFAULT_TIME_ZONE, divisiveness } from './stats';
import { cleanSearch, oneOf, PAGE_SIZE } from './query';
import { isUuid } from './mods';

// The time zone the day-by-day charts and the rush-hour heatmap use.
export function adminTimeZone() {
    const wanted = process.env.ADMIN_TIME_ZONE || DEFAULT_TIME_ZONE;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: wanted });
        return wanted;
    } catch {
        return DEFAULT_TIME_ZONE;
    }
}

// Supabase returns at most 1000 rows per request, so anything bigger is read a page at a time.
// `fetchPage(from, size)` returns a Supabase query for that slice. Stops at `max` rows and says so.
async function fetchAll(fetchPage, { size = 1000, max = 20_000 } = {}) {
    const rows = [];
    for (let from = 0; from < max; from += size) {
        const { data, error } = await fetchPage(from, size);
        if (error) return { rows, error, truncated: false };
        rows.push(...data);
        if (data.length < size) return { rows, truncated: false };
    }
    return { rows, truncated: true };
}

function fail(what, error) {
    console.error(`Admin data: could not load ${what}:`, error.message);
    throw new Error(`Could not load ${what}.`);
}

// Tables that may not exist yet (part_searches comes from Mod Squad's last SQL file) are treated as empty.
const MISSING = new Set(['42P01', '42501', 'PGRST205']);


// Dashboard ------------------------------------------------------------------------

const DASH_BUILD_COLUMNS =
    'id, user_id, car_name, vibe, model, title, est_cost_usd, mods, upvotes, downvotes, score, created_at, render_url, render_model, mods_edited_at, photo_url';

export async function getDashboard() {
    await requireAdmin();
    const supabase = await createClient();

    const [builds, votes, users, searches] = await Promise.all([
        fetchAll((from, size) =>
            supabase.from('builds').select(DASH_BUILD_COLUMNS).order('created_at', { ascending: false }).order('id').range(from, from + size - 1)
        ),
        fetchAll((from, size) =>
            supabase.from('build_votes').select('build_id, user_id, value, created_at').order('id').range(from, from + size - 1)
        ),
        fetchAll((from, size) => supabase.rpc('admin_users', { p_limit: size, p_offset: from, p_sort: 'newest' })),
        fetchAll((from, size) =>
            supabase.from('part_searches').select('query, created_at').order('id').range(from, from + size - 1)
        ),
    ]);

    if (builds.error) fail('builds', builds.error);
    if (votes.error) fail('votes', votes.error);
    if (users.error) fail('users', users.error);
    if (searches.error && !MISSING.has(searches.error.code)) fail('part searches', searches.error);

    const timeZone = adminTimeZone();
    return {
        stats: computeDashboard({ builds: builds.rows, votes: votes.rows, users: users.rows, searches: searches.error ? [] : searches.rows, timeZone }),
        meta: {
            builds: builds.rows.length,
            votes: votes.rows.length,
            users: users.rows.length,
            searches: searches.error ? null : searches.rows.length,
            truncated: builds.truncated || votes.truncated || users.truncated || searches.truncated,
            timeZone,
        },
    };
}


// Users ---------------------------------------------------------------------------

export const USER_SORTS = {
    newest: 'Newest',
    active: 'Last seen',
    builds: 'Most builds',
    votes: 'Most votes cast',
    score: 'Highest score',
    name: 'Name',
};

export async function listUsers({ q, sort, page = 1 } = {}) {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('admin_users', {
        p_search: cleanSearch(q) || null,
        p_sort: oneOf(sort, Object.keys(USER_SORTS), 'newest'),
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
    });
    if (error) fail('users', error);
    return { rows: data, total: data[0]?.total_count ?? 0, page, pageSize: PAGE_SIZE };
}

// Every user as { id, label }, for the owner picker on the New media form.
export async function listUserOptions() {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('admin_users', { p_limit: 1000, p_sort: 'name' });
    if (error) fail('users', error);
    return data.map((user) => ({
        id: user.id,
        label: [[user.first_name, user.last_name].filter(Boolean).join(' '), user.email].filter(Boolean).join(' · ') || user.id,
    }));
}

export async function getUserDetail(id) {
    await requireAdmin();
    if (!isUuid(id)) notFound();
    const supabase = await createClient();

    const [user, builds, votes, searches] = await Promise.all([
        supabase.rpc('admin_users', { p_id: id, p_limit: 1 }),
        supabase.from('builds').select(BUILD_ROW).eq('user_id', id).order('created_at', { ascending: false }).limit(50),
        supabase.rpc('admin_votes', { p_user_id: id, p_limit: 25 }),
        supabase.from('part_searches').select('query, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    ]);
    if (user.error) fail('that user', user.error);
    if (!user.data?.[0]) notFound();
    if (builds.error) fail('that user\'s builds', builds.error);
    if (votes.error) fail('that user\'s votes', votes.error);
    if (searches.error && !MISSING.has(searches.error.code)) fail('that user\'s searches', searches.error);

    return {
        user: user.data[0],
        builds: builds.data,
        votes: votes.data,
        votesTotal: votes.data[0]?.total_count ?? 0,
        searches: searches.error ? [] : searches.data,
    };
}


// Media (AI-generated builds) -----------------------------------------------------------

const BUILD_ROW =
    'id, user_id, car_name, vibe, title, tagline, est_cost_usd, upvotes, downvotes, score, created_at, render_url, image_url, photo_url, model, mods_edited_at, profiles ( first_name, last_name, avatar_url )';

export const BUILD_SORTS = {
    new: { label: 'Newest', column: 'created_at', ascending: false },
    old: { label: 'Oldest', column: 'created_at', ascending: true },
    top: { label: 'Top score', column: 'score', ascending: false },
    worst: { label: 'Lowest score', column: 'score', ascending: true },
    cost: { label: 'Most expensive', column: 'est_cost_usd', ascending: false },
};

export const BUILD_FILTERS = {
    all: 'All',
    rendered: 'Has a render',
    unrendered: 'No render',
    unvoted: 'No votes yet',
    edited: 'Parts edited by owner',
};

export async function listBuilds({ q, sort, filter, page = 1, userId } = {}) {
    await requireAdmin();
    const supabase = await createClient();

    let query = supabase.from('builds').select(BUILD_ROW, { count: 'exact' });
    if (userId && isUuid(userId)) query = query.eq('user_id', userId);

    const term = cleanSearch(q);
    if (term) {
        query = query.or(`title.ilike.*${term}*,car_name.ilike.*${term}*,vibe.ilike.*${term}*,tagline.ilike.*${term}*`);
    }

    switch (oneOf(filter, Object.keys(BUILD_FILTERS), 'all')) {
        case 'rendered': query = query.not('render_url', 'is', null); break;
        case 'unrendered': query = query.is('render_url', null); break;
        case 'unvoted': query = query.eq('upvotes', 0).eq('downvotes', 0); break;
        case 'edited': query = query.not('mods_edited_at', 'is', null); break;
        default: break;
    }

    const order = BUILD_SORTS[oneOf(sort, Object.keys(BUILD_SORTS), 'new')];
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query
        .order(order.column, { ascending: order.ascending, nullsFirst: false })
        .order('id')
        .range(from, from + PAGE_SIZE - 1);

    // PGRST103: the page asked for is past the end (someone deleted rows, or edited the URL).
    if (error?.code === 'PGRST103') return { rows: [], total: 0, page, pageSize: PAGE_SIZE };
    if (error) fail('media', error);
    return { rows: data, total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export async function getBuildDetail(id) {
    await requireAdmin();
    if (!isUuid(id)) notFound();
    const supabase = await createClient();

    const { data: build, error } = await supabase
        .from('builds')
        .select('*, profiles ( first_name, last_name, avatar_url )')
        .eq('id', id)
        .maybeSingle();
    if (error) fail('that build', error);
    if (!build) notFound();

    const [owner, votes] = await Promise.all([
        supabase.rpc('admin_users', { p_id: build.user_id, p_limit: 1 }),
        supabase.rpc('admin_votes', { p_build_id: id, p_limit: 100 }),
    ]);
    if (owner.error) fail('that build\'s owner', owner.error);
    if (votes.error) fail('that build\'s votes', votes.error);

    return { build, owner: owner.data?.[0] ?? null, votes: votes.data, votesTotal: votes.data[0]?.total_count ?? 0 };
}


// Votes and ratings -----------------------------------------------------------------------

export const VOTE_FILTERS = { all: 'All votes', up: 'Upvotes', down: 'Downvotes' };

export async function listVotes({ q, filter, page = 1, buildId, userId } = {}) {
    await requireAdmin();
    const supabase = await createClient();
    const which = oneOf(filter, Object.keys(VOTE_FILTERS), 'all');
    const { data, error } = await supabase.rpc('admin_votes', {
        p_build_id: buildId && isUuid(buildId) ? buildId : null,
        p_user_id: userId && isUuid(userId) ? userId : null,
        p_value: which === 'up' ? 1 : which === 'down' ? -1 : null,
        p_search: cleanSearch(q) || null,
        p_limit: PAGE_SIZE,
        p_offset: (page - 1) * PAGE_SIZE,
    });
    if (error) fail('votes', error);
    return { rows: data, total: data[0]?.total_count ?? 0, page, pageSize: PAGE_SIZE };
}

// Head-only count queries: the number comes back in a header, no rows are transferred.
export async function getVoteTotals() {
    await requireAdmin();
    const supabase = await createClient();
    const count = (value) => {
        const query = supabase.from('build_votes').select('id', { count: 'exact', head: true });
        return value === undefined ? query : query.eq('value', value);
    };
    const [all, up, down] = await Promise.all([count(), count(1), count(-1)]);
    for (const result of [all, up, down]) if (result.error) fail('vote totals', result.error);
    return { total: all.count ?? 0, up: up.count ?? 0, down: down.count ?? 0 };
}

export const RATING_SORTS = {
    top: 'Top score',
    worst: 'Lowest score',
    votes: 'Most votes',
    approval: 'Best approval',
    divisive: 'Most divisive',
    new: 'Newest',
};

// One row per build with its upvotes, downvotes, total votes, approval rate and score. Read in full
// and sorted here: "most votes" and "most divisive" are computed values the database does not store.
export async function listRatings({ q, sort, page = 1 } = {}) {
    await requireAdmin();
    const supabase = await createClient();
    const { rows, error, truncated } = await fetchAll((from, size) =>
        supabase
            .from('builds')
            .select('id, title, car_name, upvotes, downvotes, score, created_at, profiles ( first_name, last_name, avatar_url )')
            .order('created_at', { ascending: false })
            .order('id')
            .range(from, from + size - 1)
    );
    if (error) fail('ratings', error);

    const term = cleanSearch(q).toLowerCase();
    const withTotals = rows
        .map((row) => {
            const votes = row.upvotes + row.downvotes;
            return { ...row, votes, approval: votes > 0 ? row.upvotes / votes : null, split: divisiveness(row.upvotes, row.downvotes) };
        })
        .filter((row) => !term || `${row.title} ${row.car_name}`.toLowerCase().includes(term));

    const by = oneOf(sort, Object.keys(RATING_SORTS), 'top');
    const comparators = {
        top: (a, b) => b.score - a.score || b.upvotes - a.upvotes,
        worst: (a, b) => a.score - b.score || b.downvotes - a.downvotes,
        votes: (a, b) => b.votes - a.votes || b.score - a.score,
        approval: (a, b) => (b.approval ?? -1) - (a.approval ?? -1) || b.votes - a.votes,
        divisive: (a, b) => b.split - a.split || b.votes - a.votes,
        new: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    };
    withTotals.sort(comparators[by]);

    const start = (page - 1) * PAGE_SIZE;
    return { rows: withTotals.slice(start, start + PAGE_SIZE), total: withTotals.length, page, pageSize: PAGE_SIZE, truncated };
}
