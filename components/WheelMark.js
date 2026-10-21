// A six-spoke wheel: the logo in the header and the big outline behind the login page.
// Drawn in currentColor, so whatever sets `color` sets the wheel.
export default function WheelMark({ className }) {
    return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
            <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="5" />
            <circle cx="32" cy="32" r="22.5" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
            <g fill="currentColor">
                {[0, 60, 120, 180, 240, 300].map((angle) => (
                    <polygon key={angle} points="29.9,27 34.1,27 36.7,9.8 27.3,9.8" transform={`rotate(${angle} 32 32)`} />
                ))}
            </g>
            <circle cx="32" cy="32" r="7.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <g fill="currentColor">
                {[0, 72, 144, 216, 288].map((angle) => (
                    <circle key={angle} cx="32" cy="28" r="1.25" transform={`rotate(${angle} 32 32)`} />
                ))}
            </g>
        </svg>
    );
}
