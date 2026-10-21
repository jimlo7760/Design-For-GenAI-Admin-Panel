// A round profile photo, or the person's initial when they haven't uploaded one.
export default function Avatar({ url, name, size = 40 }) {
    if (url) {
        return (
            <img
                src={url}
                alt={name ? `Photo of ${name}` : 'Profile photo'}
                width={size}
                height={size}
                className="avatar"
                loading="lazy"
            />
        );
    }

    return (
        <div
            aria-hidden="true"
            className="avatar avatar--fallback"
            style={{ width: size, height: size, fontSize: size * 0.42 }}
        >
            {(name?.trim()?.[0] ?? '?').toUpperCase()}
        </div>
    );
}
