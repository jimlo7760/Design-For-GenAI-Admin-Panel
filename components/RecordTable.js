import Link from 'next/link';
import RecordCell from './RecordCell';

// The table for a section's list page, and for the "related" tables on a detail page. Each row ends
// with Edit when the section can be edited, otherwise View.
export default function RecordTable({ resource, rows, ctx = {} }) {
    const editable = resource.ops.update;

    return (
        <div className="table-wrap">
            <table className="table">
                <thead>
                    <tr>
                        {resource.columns.map((column) => (
                            <th key={column.key} scope="col" className={column.align === 'r' ? 'r' : undefined}>{column.label}</th>
                        ))}
                        <th scope="col"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id}>
                            {resource.columns.map((column) => (
                                <td key={column.key} className={column.align === 'r' ? 'r' : undefined}>
                                    <RecordCell column={column} row={row} resource={resource} ctx={ctx} />
                                </td>
                            ))}
                            <td className="nowrap">
                                <Link className="btn btn--sm" href={`/${resource.key}/${row.id}${editable ? '/edit' : ''}`}>{editable ? 'Edit' : 'View'}</Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
