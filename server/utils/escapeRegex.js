// Makes typed text safe to use inside a search pattern, so characters like + ( * in a
// phone number or name are searched for literally instead of breaking the search.
export const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
