const pool = require('../config/database');

async function getQualitySummary(req, res) {
  try {
    const totalResult = await pool.query(
      `
      SELECT
        COUNT(*) AS total_docs,
        SUM(unposted_amount) AS total_unposted_amount,
        SUM(CASE WHEN unposted_count > 0 THEN 1 ELSE 0 END) AS docs_with_unposted
      FROM (
        SELECT d.document_id,
               COALESCE(b.bill_id, 0) AS bill_id,
               (
                 SELECT COUNT(*)
                 FROM bill_items bi
                 WHERE bi.bill_id = b.bill_id
                   AND bi.is_postable
                   AND bi.posting_status <> 'posted'
               ) AS unposted_count,
               (
                 SELECT COALESCE(SUM(bi.amount), 0)
                 FROM bill_items bi
                 WHERE bi.bill_id = b.bill_id
                   AND bi.is_postable
                   AND bi.posting_status <> 'posted'
               ) AS unposted_amount
        FROM documents d
        LEFT JOIN bills b ON b.document_id = d.document_id
      ) sub
      `
    );

    const missingResult = await pool.query(
      `
      SELECT
        COALESCE(SUM(bi.amount) FILTER (WHERE bi.coa_account_id IS NULL), 0) AS missing_coa_amount,
        COALESCE(SUM(bi.amount) FILTER (WHERE bi.department_id IS NULL), 0) AS missing_department_amount,
        COALESCE(SUM(bi.amount) FILTER (WHERE bi.drop_id IS NULL), 0) AS missing_drop_amount
      FROM bill_items bi
      WHERE bi.is_postable
        AND bi.posting_status <> 'posted'
      `
    );

    const summary = {
      total_documents: Number(totalResult.rows[0]?.total_docs || 0),
      documents_with_unposted: Number(totalResult.rows[0]?.docs_with_unposted || 0),
      unposted_amount: Number(totalResult.rows[0]?.total_unposted_amount || 0),
      missing_coa_amount: Number(missingResult.rows[0]?.missing_coa_amount || 0),
      missing_department_amount: Number(missingResult.rows[0]?.missing_department_amount || 0),
      missing_drop_amount: Number(missingResult.rows[0]?.missing_drop_amount || 0)
    };

    res.json({ success: true, summary });
  } catch (error) {
    console.error('Quality summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getQualityDocuments(req, res) {
  try {
    const { filter = 'all', limit = 100, offset = 0 } = req.query;

    let whereClause = '';
    if (filter === 'low_quality') whereClause = 'WHERE d.quality_score < 60 OR d.quality_score IS NULL';
    else if (filter === 'unverified') whereClause = "WHERE d.verification_status IN ('unverified','needs_review')";
    else if (filter === 'missing_bill') whereClause = 'WHERE b.bill_id IS NULL AND d.status NOT IN (\'pending\',\'rejected\')';
    else if (filter === 'unposted') whereClause = `WHERE EXISTS (
        SELECT 1 FROM bill_items bi WHERE bi.bill_id = b.bill_id AND bi.is_postable AND bi.posting_status <> 'posted'
      )`;

    const result = await pool.query(
      `SELECT d.document_id,
              COALESCE(v.vendor_name, b.vendor_id::text) AS vendor_name,
              d.file_name,
              d.status,
              d.extraction_state,
              d.quality_score,
              d.verification_status,
              d.verification_reason,
              d.created_at,
              b.bill_id,
              b.total_amount,
              b.bill_date,
              (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.bill_id AND bi.is_postable AND bi.posting_status <> 'posted') AS unposted_items,
              (SELECT COALESCE(SUM(bi.amount),0) FROM bill_items bi WHERE bi.bill_id = b.bill_id AND bi.is_postable AND bi.posting_status <> 'posted') AS unposted_amount,
              (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.bill_id AND bi.is_postable AND bi.coa_account_id IS NULL) AS missing_coa,
              (SELECT COUNT(*) FROM bill_items bi WHERE bi.bill_id = b.bill_id AND bi.is_postable AND bi.drop_id IS NULL) AS missing_drop
       FROM documents d
       LEFT JOIN bills b ON b.document_id = d.document_id
       LEFT JOIN vendors v ON v.vendor_id = b.vendor_id
       ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $1 OFFSET $2`,
      [Number(limit), Number(offset)]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM documents d
       LEFT JOIN bills b ON b.document_id = d.document_id
       ${whereClause}`
    );

    res.json({
      success: true,
      documents: result.rows,
      total: Number(countResult.rows[0]?.total || 0)
    });
  } catch (error) {
    console.error('Quality documents error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getQualityStats(req, res) {
  try {
    const [scoresBuckets, verificationCounts, postingGaps, recentIssues] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE quality_score >= 80) AS high,
          COUNT(*) FILTER (WHERE quality_score >= 60 AND quality_score < 80) AS medium,
          COUNT(*) FILTER (WHERE quality_score < 60) AS low,
          COUNT(*) FILTER (WHERE quality_score IS NULL) AS unknown,
          ROUND(AVG(quality_score)::numeric, 1) AS avg_score
        FROM documents
      `),
      pool.query(`
        SELECT verification_status, COUNT(*) AS cnt
        FROM documents
        GROUP BY verification_status
        ORDER BY cnt DESC
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE bi.coa_account_id IS NULL) AS missing_coa,
          COUNT(*) FILTER (WHERE bi.department_id IS NULL) AS missing_dept,
          COUNT(*) FILTER (WHERE bi.drop_id IS NULL) AS missing_drop,
          COUNT(*) FILTER (WHERE bi.posting_status <> 'posted' AND bi.is_postable) AS unposted
        FROM bill_items bi
        WHERE bi.is_postable
      `),
      pool.query(`
        SELECT d.document_id, COALESCE(v.vendor_name, d.file_name) AS vendor_name,
               d.quality_score, d.verification_status, d.created_at
        FROM documents d
        LEFT JOIN bills b ON b.document_id = d.document_id
        LEFT JOIN vendors v ON v.vendor_id = b.vendor_id
        WHERE d.quality_score < 60 OR d.verification_status IN ('unverified','needs_review')
        ORDER BY d.created_at DESC
        LIMIT 10
      `)
    ]);

    res.json({
      success: true,
      score_buckets: scoresBuckets.rows[0],
      verification: verificationCounts.rows,
      posting_gaps: postingGaps.rows[0],
      recent_issues: recentIssues.rows
    });
  } catch (error) {
    console.error('Quality stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { getQualitySummary, getQualityDocuments, getQualityStats };
