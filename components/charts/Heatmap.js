import ChartCard from './ChartCard';
import { hourLabel } from '../../lib/stats';

const levelOf = (count, max) => (count === 0 || max === 0 ? 0 : Math.max(1, Math.ceil((4 * count) / max)));
const hourTick = (hour) => (hour % 3 === 0 ? `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'a' : 'p'}` : '');

// When the garage is busy: builds and votes together, by weekday (rows) and hour (columns), in the
// admin's time zone. One hue, light to dark; empty cells stay neutral so "nothing" never looks like "a little".
export default function Heatmap({ heatmap }) {
    const { grid, max, busiest, weekdays, timeZone, total } = heatmap;
    const zone = timeZone.split('/').pop().replaceAll('_', ' ');

    return (
        <ChartCard
            id="heatmap"
            title="Rush hour"
            sub={
                busiest
                    ? `The garage is busiest on ${busiest.day} at ${hourLabel(busiest.hour)} (${busiest.count} actions). Builds and votes together, all time, in ${zone} time.`
                    : 'Builds and votes by weekday and hour. Nothing has happened yet.'
            }
            table={{
                columns: ['Day', ...Array.from({ length: 24 }, (_, h) => hourLabel(h))],
                rows: grid.map((row, i) => [weekdays[i], ...row]),
            }}
        >
            <div className="heat" role="img" aria-label={`Heatmap of ${total} actions by weekday and hour; the busiest slot is ${busiest ? `${busiest.day} ${hourLabel(busiest.hour)}` : 'none'}`}>
                <div className="heat__days" aria-hidden="true">
                    {weekdays.map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="heat__rows">
                    {grid.map((row, weekday) => (
                        <div className="heat__row" key={weekdays[weekday]}>
                            {row.map((count, hour) => (
                                <span
                                    key={hour}
                                    className="heat__cell"
                                    data-level={levelOf(count, max)}
                                    title={`${weekdays[weekday]} ${hourLabel(hour)}: ${count} action${count === 1 ? '' : 's'}`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
                <div className="heat__hours" aria-hidden="true">
                    {Array.from({ length: 24 }, (_, hour) => <span key={hour}>{hourTick(hour)}</span>)}
                </div>
                <div className="heat__scale" aria-hidden="true">
                    <span>fewer</span>
                    {[0, 1, 2, 3, 4].map((level) => <i key={level} data-level={level} />)}
                    <span>more</span>
                </div>
            </div>
        </ChartCard>
    );
}
