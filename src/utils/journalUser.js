const DEFAULT_JOURNAL_USER_ID = parseInt(process.env.SYSTEM_USER_ID || '1', 10);
const resolveJournalUser = (preferred) => preferred || DEFAULT_JOURNAL_USER_ID;

module.exports = { DEFAULT_JOURNAL_USER_ID, resolveJournalUser };
