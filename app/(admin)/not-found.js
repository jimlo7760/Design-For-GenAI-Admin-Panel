import Link from 'next/link';

export const metadata = { title: 'Not found' };

export default function NotFound() {
    return (
        <div className="page">
            <div className="container">
                <div className="empty">
                    <h2>We couldn&apos;t find that</h2>
                    <p>The user, build or page you&apos;re looking for doesn&apos;t exist, or it was deleted.</p>
                    <Link href="/" className="btn btn--primary">Back to the pit wall</Link>
                </div>
            </div>
        </div>
    );
}
