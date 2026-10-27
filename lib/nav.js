// The admin menu. Top level is one link per group; a group with several pages shows them in a second
// row under the header while you are inside it. Plain data, safe to import from client components.
// (test/resources.test.mjs checks that every Week 7 section is reachable from here.)

export const NAV = [
    { label: 'Dashboard', href: '/' },
    { label: 'Users', href: '/users' },
    {
        label: 'Media',
        items: [
            { label: 'Media', href: '/media' },
            { label: 'Images', href: '/images' },
            { label: 'Votes', href: '/votes' },
        ],
    },
    {
        label: 'Prompts',
        items: [
            { label: 'Chains', href: '/prompt-chains' },
            { label: 'Steps', href: '/prompt-chain-steps' },
            { label: 'Mix', href: '/prompt-chain-mix' },
            { label: 'Examples', href: '/generation-examples' },
            { label: 'Requests', href: '/generation-requests' },
            { label: 'Responses', href: '/llm-responses' },
        ],
    },
    {
        label: 'Models',
        items: [
            { label: 'Models', href: '/llm-models' },
            { label: 'Providers', href: '/llm-providers' },
        ],
    },
    { label: 'Terms', href: '/terms' },
    {
        label: 'Access',
        items: [
            { label: 'Signup domains', href: '/allowed-signup-domains' },
            { label: 'Whitelisted emails', href: '/whitelisted-emails' },
        ],
    },
];

export function isCurrent(pathname, href) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
}

// The group with several pages that the current page belongs to, if any.
export function currentGroup(pathname) {
    return NAV.find((entry) => entry.items?.some((item) => isCurrent(pathname, item.href)));
}

export const groupHref = (entry) => entry.href ?? entry.items[0].href;
