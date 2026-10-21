// ▲ 5 ▼ 1, with the triangles so the colours are never the only clue.
export default function VoteCounts({ up, down }) {
    return (
        <span className="votes-inline">
            <span className="up">▲ {up}</span>
            <span className="down">▼ {down}</span>
        </span>
    );
}
