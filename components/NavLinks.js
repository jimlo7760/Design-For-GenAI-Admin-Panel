'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
    { href: '/', label: 'Dashboard' },
    { href: '/users', label: 'Users' },
    { href: '/media', label: 'Media' },
    { href: '/votes', label: 'Votes' },
];

function isCurrent(pathname, href) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavLinks() {
    const pathname = usePathname();

    return (
        <nav className="nav" aria-label="Main">
            {LINKS.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    className="nav__link"
                    aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}
                >
                    {link.label}
                </Link>
            ))}
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
