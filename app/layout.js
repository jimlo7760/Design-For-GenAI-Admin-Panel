import './globals.css';
import { Barlow, Barlow_Condensed } from 'next/font/google';

// The same type as Mod Squad, so the two apps read as one family. Barlow was drawn from California
// highway signs and license plates; the condensed cut is for headings, plates and big numbers.
const text = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' });
const heading = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-barlow-condensed' });
const headingItalic = Barlow_Condensed({
    subsets: ['latin'],
    weight: '800',
    style: 'italic',
    variable: '--font-barlow-condensed-italic',
});

export const metadata = {
    title: {
        default: 'Mod Squad Admin',
        template: '%s · Mod Squad Admin',
    },
    description: 'Admin area for Mod Squad: statistics, users, AI-generated builds and votes.',
    robots: { index: false, follow: false },
};

// Tints the phone's browser bar to match the header.
export const viewport = { themeColor: '#0c0c0a' };

export default function RootLayout({ children }) {
    return (
        <html lang="en" className={`${text.variable} ${heading.variable} ${headingItalic.variable}`}>
            <body>
                <a href="#main" className="skip-link">Skip to content</a>
                {children}
            </body>
        </html>
    );
}
