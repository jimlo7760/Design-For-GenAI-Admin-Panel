// Which make a free-text car name belongs to ("Alfa Romeo Giulia (952)" -> "Alfa Romeo"). Mod Squad
// stores only the combined name, so the dashboard has to work the make out again. The first block
// is Mod Squad's own catalogue; the rest catches cars people typed under "Other".

const MAKES = [
    'Acura', 'Alfa Romeo', 'Audi', 'BMW', 'Chevrolet', 'Dodge', 'Ford', 'Honda', 'Hyundai', 'Jeep', 'Kia',
    'Lexus', 'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Porsche', 'Subaru', 'Tesla', 'Toyota',
    'Volkswagen',
    'Aston Martin', 'Bentley', 'Buick', 'Cadillac', 'Chrysler', 'Citroen', 'Cupra', 'Datsun', 'Ferrari',
    'Fiat', 'Genesis', 'GMC', 'Infiniti', 'Jaguar', 'Lamborghini', 'Land Rover', 'Lincoln', 'Lotus',
    'Maserati', 'McLaren', 'Mercury', 'Mini', 'Oldsmobile', 'Peugeot', 'Plymouth', 'Polestar', 'Pontiac',
    'Ram', 'Renault', 'Rivian', 'Rolls-Royce', 'Saab', 'Scion', 'Seat', 'Skoda', 'Smart', 'Suzuki',
    'Volvo',
];

const ALIASES = { mercedes: 'Mercedes-Benz', benz: 'Mercedes-Benz', vw: 'Volkswagen', chevy: 'Chevrolet', mini: 'Mini' };

// Longest first, so "Alfa Romeo" wins over a hypothetical "Alfa".
const BY_LENGTH = [...MAKES].sort((a, b) => b.length - a.length);

export function brandOf(carName) {
    const name = String(carName ?? '').trim();
    if (!name) return 'Unknown';
    const lower = name.toLowerCase();

    for (const make of BY_LENGTH) {
        const m = make.toLowerCase();
        if (lower === m || lower.startsWith(`${m} `)) return make;
    }
    const first = lower.split(/\s+/)[0];
    if (ALIASES[first]) return ALIASES[first];

    // An unknown make: trust the first word if it looks like a name rather than a model code.
    return /^[a-z][a-z-]{2,}$/.test(first) ? first[0].toUpperCase() + first.slice(1) : 'Other';
}

// "Mazda MX-5 Miata (NA)" -> "Mazda MX-5 Miata": the model without its chassis code.
export function modelOf(carName) {
    return String(carName ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim() || 'Unknown';
}
