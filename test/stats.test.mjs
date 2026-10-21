import test from 'node:test';
import assert from 'node:assert/strict';
import {
    computeDashboard, divisiveness, dayLabel, hourLabel, lastDays, localParts, median, spearman, verdictFor, vibeWords,
} from '../lib/stats.js';
import { brandOf, modelOf } from '../lib/brands.js';

const close = (actual, expected, tolerance = 1e-9) =>
    assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);


test('median handles odd, even, empty and junk values', () => {
    assert.equal(median([5, 1, 3]), 3);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([]), null);
    assert.equal(median([null, undefined, NaN, 7]), 7);
});

test('spearman: perfect, reversed, tied, and undefined cases', () => {
    close(spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]), 1);
    close(spearman([1, 2, 3, 4, 5], [50, 40, 30, 20, 10]), -1);
    // One huge outlier must not matter, only the order does.
    close(spearman([1, 2, 3, 4, 5], [1, 2, 3, 4, 1_000_000]), 1);
    // By hand: ranks x = [1,2,3,4], y = [1.5,1.5,3.5,3.5]; covariance sum 4, variance sums 5 and 4: 4 / sqrt(20).
    const rho = spearman([1, 2, 3, 4], [1, 1, 2, 2]);
    close(rho, 0.894427190999916, 1e-12);
    assert.equal(spearman([1, 2], [1, 2]), null, 'needs at least 3 pairs');
    assert.equal(spearman([1, 2, 3], [5, 5, 5]), null, 'a constant has no correlation');
    assert.equal(spearman([1, 2, 3], [1, 2]), null, 'mismatched lengths');
});

test('divisiveness rewards an even split, and a bigger crowd', () => {
    assert.equal(divisiveness(0, 9), 0);
    assert.equal(divisiveness(9, 0), 0);
    assert.ok(divisiveness(5, 5) > divisiveness(9, 1), 'a 50/50 split beats 90/10');
    assert.ok(divisiveness(10, 10) > divisiveness(2, 2), 'a split of 20 beats a split of 4');
    assert.equal(divisiveness(1, 1), (1 - 0) * Math.log(3));
});

test('verdictFor puts a correlation in words', () => {
    assert.equal(verdictFor(null), null);
    assert.match(verdictFor(0.05), /Barely any relationship/);
    assert.match(verdictFor(0.3), /weak tendency for pricier/);
    assert.match(verdictFor(-0.5), /moderate tendency for cheaper/);
    assert.match(verdictFor(0.9), /strong tendency for pricier/);
});


test('localParts reads the wall clock in the given time zone', () => {
    // 2026-10-21 is a Wednesday. 03:00 UTC is 23:00 the evening before in New York (EDT, UTC-4).
    const p = localParts(new Date('2026-10-21T03:00:00Z'), 'America/New_York');
    assert.deepEqual(p, { key: '2026-10-20', weekday: 1, hour: 23 });
    // After the clocks go back on 2026-11-01, New York is UTC-5.
    assert.deepEqual(localParts(new Date('2026-11-01T14:30:00Z'), 'America/New_York'), { key: '2026-11-01', weekday: 6, hour: 9 });
    // Midnight must be hour 0, never 24.
    assert.equal(localParts(new Date('2026-10-21T00:00:00Z'), 'UTC').hour, 0);
    assert.equal(localParts(new Date('2026-10-21T00:00:00Z'), 'UTC').key, '2026-10-21');
});

test('lastDays counts back across month and year ends', () => {
    assert.deepEqual(lastDays('2026-03-02', 4), ['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    assert.deepEqual(lastDays('2028-03-01', 3), ['2028-02-28', '2028-02-29', '2028-03-01']);
    assert.deepEqual(lastDays('2027-01-01', 2), ['2026-12-31', '2027-01-01']);
    assert.equal(lastDays('2026-10-21', 30).length, 30);
});

test('labels', () => {
    assert.equal(dayLabel('2026-10-05'), 'Oct 5');
    assert.equal(hourLabel(0), '12 AM');
    assert.equal(hourLabel(12), '12 PM');
    assert.equal(hourLabel(19), '7 PM');
});

test('brandOf finds the make, including two-word makes and aliases', () => {
    assert.equal(brandOf('BMW M3 (E46)'), 'BMW');
    assert.equal(brandOf('Alfa Romeo Giulia (952)'), 'Alfa Romeo');
    assert.equal(brandOf('Mercedes-Benz C-Class (W204)'), 'Mercedes-Benz');
    assert.equal(brandOf('Mercedes 190E'), 'Mercedes-Benz');
    assert.equal(brandOf('vw golf'), 'Volkswagen');
    assert.equal(brandOf('Land Rover Defender'), 'Land Rover');
    assert.equal(brandOf('Lancia Delta Integrale'), 'Lancia', 'an unknown make is trusted when it looks like a word');
    assert.equal(brandOf('240Z'), 'Other', 'a model code is not a make');
    assert.equal(brandOf(''), 'Unknown');
    assert.equal(brandOf(null), 'Unknown');
});

test('modelOf drops the chassis code', () => {
    assert.equal(modelOf('Mazda MX-5 Miata (NA)'), 'Mazda MX-5 Miata');
    assert.equal(modelOf('Toyota Supra'), 'Toyota Supra');
    assert.equal(modelOf('  '), 'Unknown');
});

test('vibeWords drops filler and counts a word once per vibe', () => {
    assert.deepEqual(vibeWords('Aggressive aggressive track-day weapon for the weekend'), ['aggressive', 'track-day', 'weapon', 'weekend']);
    assert.deepEqual(vibeWords('a car 2026 !!'), []);
    assert.deepEqual(vibeWords(null), []);
});


// A small, hand-checkable garage -------------------------------------------------------------
const NOW = new Date('2026-10-21T16:00:00Z'); // Wed 21 Oct 2026, noon in New York
const iso = (offsetHours) => new Date(NOW.getTime() - offsetHours * 3600_000).toISOString();

const users = [
    { id: 'u1', email: 'ana@x.com', first_name: 'Ana', last_name: 'Ng', created_at: iso(24 * 20), builds_count: 3, renders_count: 1, upvotes_received: 5, downvotes_received: 1, score_total: 4, votes_cast: 0 },
    { id: 'u2', email: 'ben@x.com', first_name: 'Ben', last_name: 'Ox', created_at: iso(24 * 3), builds_count: 1, renders_count: 0, upvotes_received: 0, downvotes_received: 0, score_total: 0, votes_cast: 6 },
    { id: 'u3', email: 'cy@x.com', first_name: 'Cy', last_name: null, created_at: iso(24 * 2), builds_count: 0, renders_count: 0, upvotes_received: 0, downvotes_received: 0, score_total: 0, votes_cast: 3 },
    { id: 'u4', email: 'di@x.com', first_name: null, last_name: null, created_at: iso(5), builds_count: 0, renders_count: 0, upvotes_received: 0, downvotes_received: 0, score_total: 0, votes_cast: 0 },
];

const mod = (category, part, cost) => ({ category, part, detail: '', ...(cost === undefined ? {} : { cost_usd: cost }) });
const builds = [
    { id: 'b1', user_id: 'u1', car_name: 'BMW M3 (E46)', vibe: 'aggressive track weapon', model: 'gemini-a', title: 'Track Day', est_cost_usd: 3000, mods: [mod('Wheels', 'Rays', 2000), mod('Suspension', 'Coilovers', 1000)], upvotes: 5, downvotes: 1, score: 4, created_at: iso(2), render_url: 'https://x/r.png', render_model: 'img-1', mods_edited_at: iso(1), photo_url: null },
    { id: 'b2', user_id: 'u1', car_name: 'BMW M3 (G80)', vibe: 'aggressive daily', model: 'gemini-a', title: 'Daily Menace', est_cost_usd: 900, mods: [mod('Wheels', 'Enkei', 900)], upvotes: 0, downvotes: 0, score: 0, created_at: iso(30), render_url: null, mods_edited_at: null, photo_url: 'https://x/p.png' },
    { id: 'b3', user_id: 'u1', car_name: 'Mazda MX-5 Miata (NA)', vibe: 'touge sunday', model: 'gemini-b', title: 'Sunday Special', est_cost_usd: 4000, mods: [mod('Exhaust', 'Header'), mod('Wheels', 'RPF1')], upvotes: 2, downvotes: 2, score: 0, created_at: iso(24 * 9), render_url: null, mods_edited_at: null, photo_url: null },
    { id: 'b4', user_id: 'u2', car_name: 'Toyota GR86', vibe: 'aggressive', model: 'gemini-a', title: 'Hachi', est_cost_usd: 500, mods: [mod('Intake', 'Cold air', 500)], upvotes: 1, downvotes: 3, score: -2, created_at: iso(24 * 40), render_url: null, mods_edited_at: null, photo_url: null },
];

// u2 casts 6 votes (5 up), u3 casts 3 (1 up), u1 casts none. Everything within the last 14 days.
const vote = (user, value, hoursAgo, build = 'b1') => ({ build_id: build, user_id: user, value, created_at: iso(hoursAgo) });
const votes = [
    vote('u2', 1, 3), vote('u2', 1, 4), vote('u2', 1, 5), vote('u2', 1, 6), vote('u2', 1, 7), vote('u2', -1, 8),
    vote('u3', 1, 24 * 9), vote('u3', -1, 24 * 9 + 1), vote('u3', -1, 24 * 9 + 2),
];

const searches = [
    { query: 'Coilovers ', created_at: iso(1) }, { query: 'coilovers', created_at: iso(2) }, { query: 'big   brake kit', created_at: iso(3) }, { query: '', created_at: iso(3) },
];

const d = computeDashboard({ builds, votes, users, searches, now: NOW, timeZone: 'America/New_York' });

test('totals, approval and week-over-week windows', () => {
    assert.equal(d.totals.users, 4);
    assert.equal(d.totals.builds, 4);
    assert.equal(d.totals.votes, 9);
    assert.equal(d.totals.renders, 1);
    assert.equal(d.totals.spend, 8400);
    assert.equal(d.totals.medianCost, 1950); // costs 500, 900, 3000, 4000: (900 + 3000) / 2
    assert.deepEqual(d.approval, { up: 6, down: 3, rate: 6 / 9 });
    // builds: b1 (2h ago) and b2 (30h ago) in the last 7 days; b3 (9 days ago) in the 7 before that.
    assert.deepEqual(d.windows.builds, { last7: 2, prev7: 1 });
    assert.deepEqual(d.windows.votes, { last7: 6, prev7: 3 });
    assert.deepEqual(d.windows.users, { last7: 3, prev7: 0 });
});

test('pulse buckets by the admin time zone, not UTC', () => {
    assert.equal(d.pulse.days.length, 30);
    assert.equal(d.pulse.days.at(-1).date, '2026-10-21');
    // b2 was made 30h before 16:00 UTC Oct 21 = 10:00 UTC Oct 20 = 06:00 EDT Oct 20; b1 at 14:00 UTC Oct 21.
    const byDate = Object.fromEntries(d.pulse.days.map((day) => [day.date, day]));
    assert.equal(byDate['2026-10-21'].builds, 1);
    assert.equal(byDate['2026-10-20'].builds, 1);
    assert.equal(sumOf(d.pulse.days, 'builds'), 3, 'b4 is older than 30 days and falls outside');
    assert.equal(sumOf(d.pulse.days, 'votes'), 9);
    assert.equal(d.sparks.builds.length, 14);
    assert.equal(d.sparks.builds.at(-1), 1);
});

function sumOf(rows, key) {
    return rows.reduce((total, row) => total + row[key], 0);
}

test('the same data in UTC lands on different days', () => {
    const utc = computeDashboard({ builds: [{ ...builds[0], created_at: '2026-10-21T03:00:00Z' }], now: NOW, timeZone: 'UTC' });
    const ny = computeDashboard({ builds: [{ ...builds[0], created_at: '2026-10-21T03:00:00Z' }], now: NOW, timeZone: 'America/New_York' });
    assert.equal(utc.pulse.days.find((day) => day.date === '2026-10-21').builds, 1);
    assert.equal(ny.pulse.days.find((day) => day.date === '2026-10-20').builds, 1);
    assert.equal(ny.pulse.days.find((day) => day.date === '2026-10-21').builds, 0);
});

test('heatmap counts builds and votes by weekday and hour', () => {
    assert.equal(d.heatmap.total, 13); // 4 builds + 9 votes
    assert.equal(d.heatmap.grid.length, 7);
    assert.ok(d.heatmap.grid.every((row) => row.length === 24));
    assert.equal(d.heatmap.max, Math.max(...d.heatmap.grid.flat()));
    assert.ok(d.heatmap.busiest.count === d.heatmap.max);
    // b1 at 14:00 UTC Wed = 10:00 EDT Wed (index 2), plus votes at 13:00 UTC (9:00), 12:00, ... on Wed.
    assert.ok(d.heatmap.grid[2][10] >= 1);
});

test('funnel steps are nested and report conversion', () => {
    const counts = d.funnel.steps.map((step) => step.count);
    assert.deepEqual(counts, [4, 2, 2, 1]); // signed in; named (Ana, Ben: Cy has no surname); built (Ana, Ben); got a vote (Ana)
    for (let i = 1; i < counts.length; i++) assert.ok(counts[i] <= counts[i - 1]);
    assert.equal(d.funnel.steps[0].pctOfPrev, null);
    assert.equal(d.funnel.steps[2].pctOfPrev, 1);
    assert.equal(d.funnel.steps[3].pctOfFirst, 0.25);
    assert.equal(d.funnel.renderers, 1);
    assert.equal(d.funnel.voters, 2);
});

test('brands and models', () => {
    assert.deepEqual(d.brands.top.map((row) => [row.brand, row.builds]), [['BMW', 2], ['Mazda', 1], ['Toyota', 1]]);
    const bmw = d.brands.top[0];
    assert.equal(bmw.avgScore, 2);
    assert.equal(bmw.avgCost, 1950);
    assert.equal(bmw.share, 0.5);
    assert.equal(d.brands.otherBrands, 0);
    assert.deepEqual(d.models[0], { name: 'BMW M3', count: 2 });
});

test('categories: spend per category, with an even share for unpriced parts', () => {
    const wheels = d.categories.top.find((row) => row.category === 'Wheels');
    // Rays 2000 + Enkei 900 + RPF1: build b3 has total 4000, two unpriced parts -> 2000 each.
    assert.equal(wheels.spend, 2000 + 900 + 2000);
    assert.equal(wheels.builds, 3);
    assert.equal(wheels.shareOfBuilds, 0.75); // 3 of the 4 builds with parts
    assert.equal(d.categories.top[0].category, 'Wheels');
    assert.equal(d.categories.totalSpend, 3000 + 900 + 4000 + 500);
});

test('cost vs score: no verdict without enough builds, a sign with enough', () => {
    assert.equal(d.costVsScore.n, 3, 'only builds that got votes are plotted');
    assert.equal(d.costVsScore.rho, null, 'fewer than 8 points: no verdict');
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, title: `T${i}`, car_name: 'Honda Civic', est_cost_usd: 1000 + i * 500, upvotes: i, downvotes: 0, score: i, created_at: iso(i + 1), mods: [] }));
    const up = computeDashboard({ builds: many, now: NOW });
    close(up.costVsScore.rho, 1);
    assert.match(up.costVsScore.verdict, /strong tendency for pricier/);
    const down = computeDashboard({ builds: many.map((b, i) => ({ ...b, score: 10 - i, upvotes: 10 - i })), now: NOW });
    close(down.costVsScore.rho, -1);
});

test('favourites and divisive builds', () => {
    // b1 scores 4, b3 scores 0, b4 scores -2; b2 has no votes so it is not ranked at all.
    assert.deepEqual(d.favorites.map((b) => b.id), ['b1', 'b3', 'b4']);
    // b3 is 2-2 and b1 is 5-1; b4 is 1-3. The even split with the same crowd size as b4 wins.
    assert.equal(d.divisive[0].id, 'b3');
    assert.ok(d.divisive.every((b) => b.up >= 1 && b.down >= 1));
    assert.ok(!d.divisive.some((b) => b.id === 'b2'), 'a build with no votes is never divisive');
});

test('voter temperament needs a minimum number of votes', () => {
    assert.equal(d.voters.judges.length, 2); // Ben (6 votes) and Cy (3); Ana cast none
    assert.equal(d.voters.generous.name, 'Ben Ox');
    close(d.voters.generous.upRate, 5 / 6);
    assert.equal(d.voters.toughest.name, 'Cy');
    close(d.voters.toughest.upRate, 1 / 3);
    assert.equal(d.voters.busiest.votes, 6);
    const one = computeDashboard({ votes: [vote('u2', 1, 1), vote('u2', 1, 2)], users, now: NOW });
    assert.equal(one.voters.generous, null, 'two votes is not enough to call anyone generous');
});

test('the AI report card', () => {
    assert.deepEqual(d.ai.models.top, [{ name: 'gemini-a', count: 3 }, { name: 'gemini-b', count: 1 }]);
    assert.equal(d.ai.editedRate, 0.25);
    assert.equal(d.ai.renderRate, 0.25);
    assert.equal(d.ai.withOwnPhotoRate, 0.25);
    assert.equal(d.ai.avgParts, 1.5);
    assert.equal(d.ai.avgCost, 2100);
    assert.deepEqual(d.ai.renderModels.top, [{ name: 'img-1', count: 1 }]);
});

test('vibes', () => {
    const aggressive = d.vibes.cloud.find((row) => row.word === 'aggressive');
    assert.equal(aggressive.count, 3);
    assert.equal(aggressive.avgScore, (4 + 0 - 2) / 3);
    assert.ok(!d.vibes.cloud.some((row) => row.word === 'for'));
    // "aggressive" is the only word with 3+ builds and its average (2/3) is positive.
    assert.deepEqual(d.vibes.loved.map((row) => row.word), ['aggressive']);
    assert.deepEqual(d.vibes.unloved, []);
});

test('most wanted parts are normalised and blanks dropped', () => {
    assert.deepEqual(d.wanted, [{ query: 'coilovers', count: 2 }, { query: 'big brake kit', count: 1 }]);
});

test('creators are ranked by score', () => {
    assert.equal(d.creators[0].name, 'Ana Ng');
    assert.equal(d.creators[0].score, 4);
    close(d.creators[0].approval, 5 / 6);
    assert.equal(d.creators[1].name, 'Ben Ox');
    assert.equal(d.creators[1].approval, null, 'no votes yet: no approval rate');
});

test('an empty garage gives zeros and nulls, never NaN or a crash', () => {
    const e = computeDashboard({ now: NOW });
    assert.equal(e.totals.builds, 0);
    assert.equal(e.totals.medianCost, null);
    assert.equal(e.approval.rate, null);
    assert.equal(e.heatmap.busiest, null);
    assert.equal(e.heatmap.max, 0);
    assert.equal(e.funnel.steps[0].pctOfFirst, null);
    assert.deepEqual(e.brands.top, []);
    assert.deepEqual(e.favorites, []);
    assert.equal(e.voters.generous, null);
    assert.equal(e.ai.editedRate, null);
    assert.equal(e.ai.avgParts, null);
    assert.equal(e.pulse.days.length, 30);
    assert.equal(JSON.stringify(e).includes('NaN'), false);
});

test('bad rows are tolerated', () => {
    const messy = computeDashboard({
        builds: [{ id: 'z', car_name: null, mods: 'not an array', created_at: 'not a date', upvotes: 0, downvotes: 0 }],
        votes: [{ build_id: 'z', user_id: 'ghost', value: 1, created_at: null }],
        users: [],
        now: NOW,
    });
    assert.equal(messy.totals.builds, 1);
    assert.equal(messy.pulse.days.reduce((n, day) => n + day.builds, 0), 0);
    assert.equal(messy.voters.everyone, 1);
});
