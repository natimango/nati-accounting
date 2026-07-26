BEGIN;

-- Remove duplicate journal entries per bill — keep only the most recent one per bill_id
-- This fixes the inflated Accounts Payable caused by multiple reprocess runs

DELETE FROM journal_entry_lines
WHERE journal_id IN (
  SELECT journal_id FROM journal_entries je
  WHERE je.reference_type = 'BILL'
    AND je.journal_id NOT IN (
      -- keep the latest journal entry per bill
      SELECT MAX(journal_id)
      FROM journal_entries
      WHERE reference_type = 'BILL'
      GROUP BY reference_id
    )
);

DELETE FROM journal_entries
WHERE reference_type = 'BILL'
  AND journal_id NOT IN (
    SELECT MAX(journal_id)
    FROM journal_entries
    WHERE reference_type = 'BILL'
    GROUP BY reference_id
  );

COMMIT;
