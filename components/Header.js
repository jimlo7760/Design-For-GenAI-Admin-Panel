import Link from 'next/link';
import Avatar from './Avatar';
import NavLinks from './NavLinks';
import SubNav from './SubNav';
import WheelMark from './WheelMark';
import { displayName } from '../lib/auth';

export default function Header({ user, profile }) {
    const name = displayName({ first_name: profile?.first_name, last_name: profile?.last_name, email: user?.email });

    return (
        <header className="site-header">
            <div className="container container--wide site-header__inner">
                <Link href="/" className="brand">
                    <WheelMark className="brand__wheel" />
                    <span className="brand__word">Mod <span className="brand__accent">Squad</span></span>
                    <span className="plate plate--sm">Admin</span>
                </Link>

                <NavLinks />

                <div className="user-menu">
                    <span className="user-menu__profile" title={user?.email}>
                        <Avatar url={profile?.avatar_url} name={name} size={32} />
                        <span className="user-menu__name">{name}</span>
                    </span>
                    <form action="/auth/signout" method="post">
                        <button type="submit" className="btn btn--sm btn--header">Sign out</button>
                    </form>
                </div>
            </div>
            <SubNav />
        </header>
    );
}
