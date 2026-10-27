'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { currentGroup, isCurrent } from '../lib/nav';

// The second row of the header: the pages in the group you are in (Prompts, Models, Access, Media).
export default function SubNav() {
    const pathname = usePathname();
    const group = currentGroup(pathname);
    if (!group) return null;

    return (
        <div className="container container--wide">
            <nav className="subnav" aria-label={`${group.label} pages`}>
                {group.items.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="subnav__link"
                        aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
