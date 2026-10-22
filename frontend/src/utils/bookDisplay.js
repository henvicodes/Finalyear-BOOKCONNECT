// Books that BookConnect itself provides (public-domain classics, summary editions)
// belong to the "BookConnect Library" account but are credited to the real author.
export const authorOf = (book) => book?.originalAuthor || book?.author?.name;

// "Source: Project Gutenberg (Public domain)" style credit, or "" when there is none
export const sourceLine = (book) => {
  const s = book?.source;
  if (!s || !s.name) return "";
  return `Source: ${s.name}${s.license ? ` (${s.license})` : ""}`;
};
