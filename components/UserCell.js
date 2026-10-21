import Link from 'next/link';
import Avatar from './Avatar';
import { displayName } from '../lib/auth';

// A person in a table: photo, name (a link to their page when we have an id), email underneath.
export default function UserCell({ id, first_name, last_name, email, avatar_url, size = 36, href = true }) {
    const name = displayName({ first_name, last_name, email, id });
    return (
        <div className="cell-user">
            <Avatar url={avatar_url} name={name} size={size} />
            <div className="cell-user__text">
                {id && href ? <Link className="cell-user__name" href={`/users/${id}`}>{name}</Link> : <span className="cell-user__name">{name}</span>}
                {email && <span className="cell-user__sub">{email}</span>}
            </div>
        </div>
    );
}
