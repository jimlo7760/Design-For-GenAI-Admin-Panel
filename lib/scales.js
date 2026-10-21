// Axis maths for the hand-drawn charts. Plain functions, easy to test.

// "Nice" tick values covering [min, max]: round steps (1, 2, 5 x 10^n), about `target` of them.
export function niceTicks(min, max, target = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (min === max) {
        const pad = Math.abs(min) < 1 ? 1 : Math.abs(min) * 0.1;
        min -= pad;
        max += pad;
    }
    const rough = (max - min) / Math.max(1, target);
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const residual = rough / magnitude;
    // The smallest round step that is at least the rough one, so there are never more ticks than asked for.
    const step = (residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10) * magnitude;
    const first = Math.floor(min / step) * step;
    const ticks = [];
    // Keep going until a tick reaches the top of the data, so every point sits inside the axis.
    for (let i = 0; i < 100; i++) {
        const value = first + i * step;
        ticks.push(Number(value.toFixed(10)));
        if (value >= max) break;
    }
    return ticks;
}

// Powers of ten covering [min, max] for a log axis: 100, 1000, 10000...
export function logTicks(min, max) {
    const low = Math.floor(Math.log10(Math.max(min, 1)));
    const high = Math.ceil(Math.log10(Math.max(max, 1)));
    const ticks = [];
    for (let power = low; power <= high; power++) ticks.push(10 ** power);
    return ticks.length >= 2 ? ticks : [10 ** low, 10 ** (low + 1)];
}

// Places dots that must not overlap along one axis: each dot keeps its x and is moved up or down
// the least it needs to, so the picture reads as a beeswarm. `dots` are { x, r }; returns the same
// order with a `y` offset added (0 is the centre line).
export function swarm(dots, gap = 1.5) {
    const placed = [];
    for (const dot of dots) {
        let y = 0;
        let step = 0;
        // Try the centre line, then +1, -1, +2, -2 ... rows until nothing collides.
        for (;;) {
            const candidate = step === 0 ? 0 : (step % 2 === 1 ? 1 : -1) * Math.ceil(step / 2) * 0.5 * dot.r * 2 * 0.9;
            const clash = placed.some((other) => Math.hypot(other.x - dot.x, other.y - candidate) < other.r + dot.r + gap);
            if (!clash) {
                y = candidate;
                break;
            }
            step += 1;
            if (step > 400) {
                y = candidate;
                break;
            }
        }
        placed.push({ ...dot, y });
    }
    return placed;
}
