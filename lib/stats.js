// Everything the dashboard shows, computed from rows. Pure functions: no database, no React, no
// clock except the `now` you pass in, so each one is easy to test with a handful of fixtures.
//
// Inputs (all arrays of plain rows, any of them may be empty):
//   builds    id, user_id, car_name, vibe, model, title, est_cost_usd, mods, upvotes, downvotes, score,
//             created_at, render_url, render_model, mods_edited_at, photo_url
//   votes     build_id, user_id, value (1 or -1), created_at
//   users     id, email, first_name, last_name, avatar_url, created_at, builds_count, renders_count,
//             upvotes_received, downvotes_received, score_total   (from the admin_users() function)
//   searches  query, created_at

import { brandOf, modelOf } from './brands.js';
import { shareOfTotal } from './mods.js';

export const DEFAULT_TIME_ZONE = 'America/New_York';
export const PULSE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];


// Small helpers ----------------------------------------------------------------

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const sum = (values) => values.reduce((total, value) => total + value, 0);
const mean = (values) => (values.length ? sum(values) / values.length : null);
const share = (part, whole) => (whole > 0 ? part / whole : null);

export function median(values) {
    const sorted = values.filter(finite).sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Ranks from 1, with tied values sharing the average of the ranks they cover.
function ranks(values) {
    const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
    const result = new Array(values.length);
    for (let i = 0; i < order.length; ) {
        let j = i;
        while (j + 1 < order.length && order[j + 1].value === order[i].value) j++;
        const rank = (i + j) / 2 + 1;
        for (let k = i; k <= j; k++) result[order[k].index] = rank;
        i = j + 1;
    }
    return result;
}

// Spearman's rank correlation, from -1 to 1, or null when it is undefined (fewer than 3 pairs, or
// one side never varies). Ranks make it robust to the outliers that costs always have: one $90,000
// build cannot drag it the way it would drag a plain correlation.
export function spearman(xs, ys) {
    if (xs.length !== ys.length || xs.length < 3) return null;
    const rx = ranks(xs);
    const ry = ranks(ys);
    const mx = mean(rx);
    const my = mean(ry);
    let numerator = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < rx.length; i++) {
        numerator += (rx[i] - mx) * (ry[i] - my);
        dx += (rx[i] - mx) ** 2;
        dy += (ry[i] - my) ** 2;
    }
    return dx === 0 || dy === 0 ? null : numerator / Math.sqrt(dx * dy);
}

// How evenly a build's votes split, weighted by how many there were: 0 when everyone agrees, and
// highest for a big crowd that is split down the middle. Needs a vote each way.
export function divisiveness(up, down) {
    const total = up + down;
    if (up < 1 || down < 1) return 0;
    return (1 - Math.abs(up - down) / total) * Math.log(1 + total);
}


// Time ----------------------------------------------------------------------

const formatters = new Map();
function formatter(timeZone) {
    if (!formatters.has(timeZone)) {
        formatters.set(
            timeZone,
            new Intl.DateTimeFormat('en-US', {
                timeZone,
                hourCycle: 'h23',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                weekday: 'short',
            })
        );
    }
    return formatters.get(timeZone);
}

// A moment as the wall clock shows it in `timeZone`: { key: '2026-10-21', weekday: 0..6 (Mon=0), hour: 0..23 }.
export function localParts(date, timeZone = DEFAULT_TIME_ZONE) {
    const parts = Object.fromEntries(formatter(timeZone).formatToParts(date).map((part) => [part.type, part.value]));
    return {
        key: `${parts.year}-${parts.month}-${parts.day}`,
        weekday: WEEKDAYS.indexOf(parts.weekday),
        hour: Number(parts.hour) % 24,
    };
}

// The `count` calendar days ending on `todayKey`, oldest first, as 'YYYY-MM-DD'. Pure date arithmetic,
// so it never trips over a daylight-saving change.
export function lastDays(todayKey, count) {
    const [year, month, day] = todayKey.split('-').map(Number);
    return Array.from({ length: count }, (_, i) => {
        const d = new Date(Date.UTC(year, month - 1, day - (count - 1 - i)));
        return d.toISOString().slice(0, 10);
    });
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dayLabel(key) {
    const [, month, day] = key.split('-').map(Number);
    return `${SHORT_MONTHS[month - 1]} ${day}`;
}

export function hourLabel(hour) {
    const h = hour % 12 === 0 ? 12 : hour % 12;
    return `${h} ${hour < 12 ? 'AM' : 'PM'}`;
}

const time = (value) => {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? null : t;
};


// Text ----------------------------------------------------------------------

const STOPWORDS = new Set((
    'a about all also an and any are as at be been but by can car cars for from get got had has have her his ' +
    'how i if in into is it its just like make makes me more most my no not of on one or our out so some ' +
    'than that the their them then there these they this to too up us use very vibe vibes was we were what ' +
    'when which while who will with would you your build builds look looks style feel feeling something ' +
    'want wanted really kind sort type lot'
).split(' '));

// The words in a vibe worth counting: lower case, 3+ letters, no filler, each once per vibe.
export function vibeWords(vibe) {
    const words = String(vibe ?? '')
        .toLowerCase()
        .split(/[^a-z0-9'-]+/)
        .map((word) => word.replace(/^['-]+|['-]+$/g, ''))
        .filter((word) => word.length >= 3 && !STOPWORDS.has(word) && !/^\d+$/.test(word));
    return [...new Set(words)];
}

const normalizeQuery = (query) => String(query ?? '').toLowerCase().replace(/\s+/g, ' ').trim();


// The dashboard ----------------------------------------------------------------

function topWithOther(counts, limit) {
    const sorted = [...counts].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const top = sorted.slice(0, limit);
    const rest = sorted.slice(limit);
    return { top, other: sum(rest.map((item) => item.count)), otherKinds: rest.length };
}

function countBy(items, keyOf) {
    const map = new Map();
    for (const item of items) {
        const key = keyOf(item);
        if (key) map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map].map(([name, count]) => ({ name, count }));
}

export function computeDashboard({ builds = [], votes = [], users = [], searches = [], now = new Date(), timeZone = DEFAULT_TIME_ZONE } = {}) {
    const nowMs = now.getTime();
    const userById = new Map(users.map((user) => [user.id, user]));
    const nameOf = (id) => {
        const user = userById.get(id);
        return (
            [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
            user?.email?.split('@')[0] ||
            `User ${String(id ?? '').slice(0, 6)}`
        );
    };

    // Totals -------------------------------------------------------------------
    const ups = votes.filter((vote) => vote.value === 1).length;
    const downs = votes.filter((vote) => vote.value === -1).length;
    const costs = builds.map((build) => build.est_cost_usd).filter(finite);
    const partsPerBuild = builds.map((build) => (Array.isArray(build.mods) ? build.mods.length : 0));

    const totals = {
        users: users.length,
        builds: builds.length,
        votes: votes.length,
        renders: builds.filter((build) => build.render_url).length,
        spend: sum(costs),
        medianCost: median(costs),
    };
    const approval = { up: ups, down: downs, rate: share(ups, ups + downs) };

    // Last 7 days against the 7 before, for the delta under each gauge.
    const windows = {};
    for (const [key, rows] of [['builds', builds], ['votes', votes], ['users', users]]) {
        const stamps = rows.map((row) => time(row.created_at)).filter((t) => t !== null);
        windows[key] = {
            last7: stamps.filter((t) => t > nowMs - 7 * DAY_MS && t <= nowMs).length,
            prev7: stamps.filter((t) => t > nowMs - 14 * DAY_MS && t <= nowMs - 7 * DAY_MS).length,
        };
    }

    // Pulse: per calendar day (in the admin's time zone) for the last 30 days -------------
    const todayKey = localParts(now, timeZone).key;
    const dayKeys = lastDays(todayKey, PULSE_DAYS);
    const pulseByDay = new Map(dayKeys.map((key) => [key, { date: key, label: dayLabel(key), builds: 0, votes: 0, users: 0 }]));
    for (const [field, rows] of [['builds', builds], ['votes', votes], ['users', users]]) {
        for (const row of rows) {
            const t = time(row.created_at);
            if (t === null) continue;
            const bucket = pulseByDay.get(localParts(new Date(t), timeZone).key);
            if (bucket) bucket[field] += 1;
        }
    }
    const pulse = { days: dayKeys.map((key) => pulseByDay.get(key)) };
    const sparks = {
        builds: pulse.days.slice(-14).map((day) => day.builds),
        votes: pulse.days.slice(-14).map((day) => day.votes),
        users: pulse.days.slice(-14).map((day) => day.users),
    };

    // Rush hour: builds and votes together, by weekday and hour -----------------------------
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const row of [...builds, ...votes]) {
        const t = time(row.created_at);
        if (t === null) continue;
        const { weekday, hour } = localParts(new Date(t), timeZone);
        if (weekday >= 0) grid[weekday][hour] += 1;
    }
    const heatMax = Math.max(0, ...grid.flat());
    let busiest = null;
    grid.forEach((row, weekday) =>
        row.forEach((count, hour) => {
            if (count > (busiest?.count ?? 0)) busiest = { weekday, day: WEEKDAYS[weekday], hour, count };
        })
    );
    const heatmap = { grid, max: heatMax, busiest, total: sum(grid.flat()), weekdays: WEEKDAYS, timeZone };

    // Funnel: each step is a subset of the one above it ---------------------------------------
    const named = users.filter((user) => user.first_name?.trim() && user.last_name?.trim());
    const built = named.filter((user) => user.builds_count > 0);
    const gotVotes = built.filter((user) => user.upvotes_received + user.downvotes_received > 0);
    const steps = [
        { key: 'signed-up', label: 'Signed in with Google', count: users.length },
        { key: 'named', label: 'Added their name', count: named.length },
        { key: 'built', label: 'Generated a build', count: built.length },
        { key: 'voted-on', label: 'Got a vote on it', count: gotVotes.length },
    ];
    const funnel = {
        steps: steps.map((step, i) => ({
            ...step,
            pctOfFirst: share(step.count, steps[0].count),
            pctOfPrev: i === 0 ? null : share(step.count, steps[i - 1].count),
        })),
        // Side doors, not steps: they are not subsets of the funnel.
        renderers: users.filter((user) => user.renders_count > 0).length,
        voters: users.filter((user) => user.votes_cast > 0).length,
        builders: users.filter((user) => user.builds_count > 0).length,
    };

    // Makes and models ----------------------------------------------------------------------
    const byBrand = new Map();
    for (const build of builds) {
        const brand = brandOf(build.car_name);
        const row = byBrand.get(brand) ?? { brand, builds: 0, scores: [], costs: [] };
        row.builds += 1;
        if (finite(build.score)) row.scores.push(build.score);
        if (finite(build.est_cost_usd)) row.costs.push(build.est_cost_usd);
        byBrand.set(brand, row);
    }
    const brandRows = [...byBrand.values()]
        .map((row) => ({ brand: row.brand, builds: row.builds, avgScore: mean(row.scores), avgCost: mean(row.costs), share: share(row.builds, builds.length) }))
        .sort((a, b) => b.builds - a.builds || (b.avgScore ?? -Infinity) - (a.avgScore ?? -Infinity) || a.brand.localeCompare(b.brand));
    const brands = {
        top: brandRows.slice(0, 8),
        otherBrands: Math.max(0, brandRows.length - 8),
        otherBuilds: sum(brandRows.slice(8).map((row) => row.builds)),
        distinct: brandRows.length,
    };
    const models = countBy(builds, (build) => modelOf(build.car_name))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 6);

    // What the AI keeps recommending, and where the money goes ------------------------------
    const byCategory = new Map();
    let buildsWithParts = 0;
    for (const build of builds) {
        const mods = Array.isArray(build.mods) ? build.mods : [];
        if (mods.length === 0) continue;
        buildsWithParts += 1;
        const seen = new Set();
        mods.forEach((mod, index) => {
            const label = String(mod?.category ?? 'Other').trim() || 'Other';
            const key = label.toLowerCase();
            const row = byCategory.get(key) ?? { category: label, spend: 0, parts: 0, builds: 0 };
            row.spend += shareOfTotal(mods, build.est_cost_usd, index) ?? 0;
            row.parts += 1;
            if (!seen.has(key)) {
                row.builds += 1;
                seen.add(key);
            }
            byCategory.set(key, row);
        });
    }
    const categoryRows = [...byCategory.values()]
        .map((row) => ({ ...row, shareOfBuilds: share(row.builds, buildsWithParts) }))
        .sort((a, b) => b.spend - a.spend || b.builds - a.builds || a.category.localeCompare(b.category));
    const categories = {
        top: categoryRows.slice(0, 8),
        otherKinds: Math.max(0, categoryRows.length - 8),
        otherSpend: sum(categoryRows.slice(8).map((row) => row.spend)),
        totalSpend: sum(categoryRows.map((row) => row.spend)),
    };

    // Does money buy votes? -------------------------------------------------------------------
    const points = builds
        .filter((build) => finite(build.est_cost_usd) && build.est_cost_usd > 0 && build.upvotes + build.downvotes > 0)
        .map((build) => ({ id: build.id, title: build.title, cost: build.est_cost_usd, score: build.score ?? build.upvotes - build.downvotes }));
    const rho = points.length >= 8 ? spearman(points.map((p) => p.cost), points.map((p) => p.score)) : null;
    const costVsScore = { points, n: points.length, rho, verdict: verdictFor(rho) };

    // Crowd favourites and the most divisive ----------------------------------------------------
    const voted = builds.filter((build) => build.upvotes + build.downvotes > 0);
    const brief = (build) => ({
        id: build.id,
        title: build.title,
        car: build.car_name,
        up: build.upvotes,
        down: build.downvotes,
        score: build.score ?? build.upvotes - build.downvotes,
    });
    const favorites = [...voted]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.upvotes - a.upvotes || String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 5)
        .map(brief);
    const divisive = voted
        .filter((build) => build.upvotes >= 1 && build.downvotes >= 1 && build.upvotes + build.downvotes >= 3)
        .sort((a, b) => divisiveness(b.upvotes, b.downvotes) - divisiveness(a.upvotes, a.downvotes) || b.upvotes + b.downvotes - (a.upvotes + a.downvotes))
        .slice(0, 5)
        .map(brief);

    // Who is generous and who is tough ----------------------------------------------------------
    const byVoter = new Map();
    for (const vote of votes) {
        const row = byVoter.get(vote.user_id) ?? { id: vote.user_id, votes: 0, ups: 0 };
        row.votes += 1;
        if (vote.value === 1) row.ups += 1;
        byVoter.set(vote.user_id, row);
    }
    const judges = [...byVoter.values()]
        .filter((row) => row.votes >= 3)
        .map((row) => ({ id: row.id, name: nameOf(row.id), votes: row.votes, upRate: row.ups / row.votes }));
    const byRate = [...judges].sort((a, b) => b.upRate - a.upRate || b.votes - a.votes);
    const voters = {
        // The dots on the strip plot (the busiest 150 if there are more than that).
        judges: [...judges].sort((a, b) => b.votes - a.votes).slice(0, 150),
        average: approval.rate,
        generous: byRate[0] ?? null,
        toughest: byRate.length > 1 ? byRate[byRate.length - 1] : null,
        busiest: [...judges].sort((a, b) => b.votes - a.votes)[0] ?? null,
        everyone: byVoter.size,
        minVotes: 3,
    };

    // The AI report card -------------------------------------------------------------------------
    const modelCounts = topWithOther(countBy(builds, (build) => String(build.model ?? '').trim() || 'unknown'), 3);
    const renderCounts = topWithOther(countBy(builds.filter((build) => build.render_url), (build) => String(build.render_model ?? '').trim() || 'unknown'), 3);
    const ai = {
        models: modelCounts,
        renderModels: renderCounts,
        editedRate: share(builds.filter((build) => build.mods_edited_at).length, builds.length),
        renderRate: share(totals.renders, builds.length),
        withOwnPhotoRate: share(builds.filter((build) => build.photo_url).length, builds.length),
        avgParts: mean(partsPerBuild),
        avgCost: mean(costs),
    };

    // Vibes -----------------------------------------------------------------------------------------
    const byWord = new Map();
    for (const build of builds) {
        for (const word of vibeWords(build.vibe)) {
            const row = byWord.get(word) ?? { word, count: 0, scores: [] };
            row.count += 1;
            if (finite(build.score)) row.scores.push(build.score);
            byWord.set(word, row);
        }
    }
    const wordRows = [...byWord.values()].map((row) => ({ word: row.word, count: row.count, avgScore: mean(row.scores) }));
    const repeated = wordRows.filter((row) => row.count >= 2);
    const cloud = (repeated.length >= 8 ? repeated : wordRows)
        .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
        .slice(0, 24);
    const rated = wordRows.filter((row) => row.count >= 3 && row.avgScore !== null).sort((a, b) => b.avgScore - a.avgScore);
    const loved = rated.filter((row) => row.avgScore > 0).slice(0, 3);
    const lovedWords = new Set(loved.map((row) => row.word));
    const unloved = [...rated].reverse().filter((row) => row.avgScore < 0 && !lovedWords.has(row.word)).slice(0, 3);
    const vibes = { cloud, loved, unloved };

    // Part searches, creators --------------------------------------------------------------------------
    const wanted = countBy(searches, (row) => normalizeQuery(row.query))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 8)
        .map((row) => ({ query: row.name, count: row.count }));
    const creators = users
        .filter((user) => user.builds_count > 0)
        .map((user) => ({
            id: user.id,
            name: nameOf(user.id),
            avatar_url: user.avatar_url ?? null,
            builds: user.builds_count,
            score: user.score_total,
            approval: share(user.upvotes_received, user.upvotes_received + user.downvotes_received),
        }))
        .sort((a, b) => b.score - a.score || b.builds - a.builds || a.name.localeCompare(b.name))
        .slice(0, 5);

    return {
        generatedAt: now.toISOString(),
        timeZone,
        totals,
        approval,
        windows,
        sparks,
        pulse,
        heatmap,
        funnel,
        brands,
        models,
        categories,
        costVsScore,
        favorites,
        divisive,
        voters,
        ai,
        vibes,
        wanted,
        creators,
    };
}

// What a correlation means in plain words.
export function verdictFor(rho) {
    if (rho === null || rho === undefined) return null;
    const size = Math.abs(rho);
    if (size < 0.2) return 'Barely any relationship between what a build costs and how the squad scores it.';
    const strength = size < 0.4 ? 'A weak' : size < 0.6 ? 'A moderate' : 'A strong';
    return `${strength} tendency for ${rho > 0 ? 'pricier' : 'cheaper'} builds to score higher.`;
}
