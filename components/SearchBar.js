// A plain GET form: works without JavaScript, and the search lives in the URL so it can be shared and
// survives a reload. Other filters ride along as hidden fields.
export default function SearchBar({ action, q, hidden = {}, placeholder = 'Search', label = 'Search' }) {
    return (
        <form className="toolbar__search" action={action} method="get" role="search">
            {Object.entries(hidden).map(([name, value]) =>
                value ? <input key={name} type="hidden" name={name} value={value} /> : null
            )}
            <label className="sr-only" htmlFor={`search-${action}`}>{label}</label>
            <input id={`search-${action}`} className="input" type="search" name="q" defaultValue={q} placeholder={placeholder} maxLength={60} />
            <button type="submit" className="btn">Search</button>
        </form>
    );
}
