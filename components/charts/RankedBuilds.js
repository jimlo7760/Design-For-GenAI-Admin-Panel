import Link from 'next/link';
import SplitBar from './SplitBar';

// A numbered list of builds, each with its up/down split. Used for crowd favourites and the most divisive.
export default function RankedBuilds({ builds, empty }) {
    if (builds.length === 0) return <p className="muted">{empty}</p>;
    return (
        <ol className="rank">
            {builds.map((build) => (
                <li className="rank__item" key={build.id}>
                    <div className="stack-sm" style={{ gap: '0.3rem' }}>
                        <div>
                            <Link className="rank__title" href={`/media/${build.id}`}>{build.title}</Link>
                            <div className="rank__sub">{build.car}</div>
                        </div>
                        <SplitBar up={build.up} down={build.down} />
                    </div>
                </li>
            ))}
        </ol>
    );
}
