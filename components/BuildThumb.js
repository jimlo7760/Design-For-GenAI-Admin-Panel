// The small picture in a list: the AI render if there is one, else the car photo, else a placeholder.
export default function BuildThumb({ build, alt }) {
    const src = build.render_url || build.photo_url || build.image_url;
    if (!src) return <div className="thumb thumb--empty" aria-hidden="true">no image</div>;
    return <img className="thumb" src={src} alt={alt ?? ''} loading="lazy" />;
}
