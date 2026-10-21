// The numbers behind a chart, as a collapsed table. `rows` are arrays of cells; numbers align right.
export default function ChartTable({ caption = 'View as table', columns, rows }) {
    if (!rows || rows.length === 0) return null;
    return (
        <details className="chart-table">
            <summary>{caption}</summary>
            <div className="table-wrap">
                <table className="table">
                    <thead>
                        <tr>
                            {columns.map((column) => (
                                <th key={column} scope="col">{column}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i}>
                                {row.map((cell, j) => (
                                    <td key={j} className={typeof cell === 'number' ? 'num r' : undefined}>{cell}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </details>
    );
}
