'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV, groupHref, isCurrent } from '../lib/nav';

export default function NavLinks() {
    const pathname = usePathname();

    return (
        <nav className="nav" aria-label="Main">
            {NAV.map((entry) => {
                const current = entry.items ? entry.items.some((item) => isCurrent(pathname, item.href)) : isCurrent(pathname, entry.href);
                return (
                    <Link
                        key={entry.label}
                        href={groupHref(entry)}
                        className="nav__link"
                        aria-current={current ? 'page' : undefined}
                    >
                        {entry.label}
                    </Link>
                );
            })}
            <Link
                href="/media/new"
                className="nav__cta"
                aria-current={pathname === '/media/new' ? 'page' : undefined}
            >
                + New<span className="nav__cta-long"> media</span>
            </Link>
        </nav>
    );
}
