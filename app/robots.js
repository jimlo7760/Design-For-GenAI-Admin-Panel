// Nothing here should be indexed. (The login wall already hides it; this is belt and braces.)
export default function robots() {
    return { rules: { userAgent: '*', disallow: '/' } };
}
