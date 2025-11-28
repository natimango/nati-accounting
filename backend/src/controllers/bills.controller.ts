import { Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { geminiService } from '../services/gemini.service';
import { cloudinaryService } from '../services/cloudinary.service';
import { BillStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const uploadBill = async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  try {
    // 1. Upload to Cloudinary
    let documentUrl: string | undefined;
    let documentId: string | undefined;

    try {
      const uploaded = await cloudinaryService.uploadDocument(
        req.file.buffer,
        req.file.originalname
      );
      documentUrl = uploaded.url;
      documentId = uploaded.public_id;
    } catch (error) {
      console.warn('Cloudinary upload failed, proceeding without it:', error);
    }

    // 2. Extract data using Gemini
    let extractedData;
    let confidenceScore = 0;

    try {
      extractedData = await geminiService.extractBillData(
        req.file.buffer,
        req.file.mimetype
      );
      confidenceScore = extractedData.confidence_score;
    } catch (error) {
      console.error('Gemini extraction failed:', error);
      // Continue without AI extraction
    }

    // 3. Create bill record
    const billResult = await pool.query(
      `INSERT INTO bills (
        document_url, document_id, bill_number, bill_date, due_date,
        total_amount, tax_amount, category, status, confidence_score, ai_extracted_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        documentUrl,
        documentId,
        extractedData?.bill_number,
        extractedData?.bill_date,
        extractedData?.due_date,
        extractedData?.total_amount || 0,
        extractedData?.tax_amount,
        extractedData?.category,
        BillStatus.PENDING,
        confidenceScore,
        JSON.stringify(extractedData || {})
      ]
    );

    const bill = billResult.rows[0];

    // 4. Create bill items if extracted
    if (extractedData?.line_items && extractedData.line_items.length > 0) {
      for (const item of extractedData.line_items) {
        await pool.query(
          `INSERT INTO bill_items (bill_id, description, quantity, rate, amount)
           VALUES ($1, $2, $3, $4, $5)`,
          [bill.bill_id, item.description, item.quantity, item.rate, item.amount]
        );
      }
    }

    // 5. Find or create vendor
    if (extractedData?.vendor_name) {
      const vendorResult = await pool.query(
        `INSERT INTO vendors (vendor_name, vendor_type, gstin)
         VALUES ($1, 'SUPPLIER', $2)
         ON CONFLICT DO NOTHING
         RETURNING vendor_id`,
        [extractedData.vendor_name, extractedData.vendor_gstin]
      );

      if (vendorResult.rows.length > 0) {
        await pool.query(
          'UPDATE bills SET vendor_id = $1 WHERE bill_id = $2',
          [vendorResult.rows[0].vendor_id, bill.bill_id]
        );
      }
    }

    res.status(201).json({
      success: true,
      data: {
        bill_id: bill.bill_id,
        status: bill.status,
        confidence_score: confidenceScore,
        needs_review: confidenceScore < 90,
        extracted_data: extractedData
      },
      message: confidenceScore >= 90
        ? 'Bill processed successfully'
        : 'Bill uploaded, please review extracted data'
    });
  } catch (error) {
    console.error('Bill upload error:', error);
    throw new AppError('Failed to process bill', 500);
  }
};

export const getBills = async (req: AuthRequest, res: Response) => {
  const { status, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT b.*, v.vendor_name, v.vendor_type
    FROM bills b
    LEFT JOIN vendors v ON b.vendor_id = v.vendor_id
  `;
  const params: any[] = [];

  if (status) {
    query += ' WHERE b.status = $1';
    params.push(status);
  }

  query += ' ORDER BY b.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
  params.push(parseInt(limit as string), parseInt(offset as string));

  const result = await pool.query(query, params);

  res.json({
    success: true,
    data: result.rows
  });
};

export const getBillById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const billResult = await pool.query(
    `SELECT b.*, v.vendor_name, v.vendor_type, v.gstin
     FROM bills b
     LEFT JOIN vendors v ON b.vendor_id = v.vendor_id
     WHERE b.bill_id = $1`,
    [id]
  );

  if (billResult.rows.length === 0) {
    throw new AppError('Bill not found', 404);
  }

  const itemsResult = await pool.query(
    'SELECT * FROM bill_items WHERE bill_id = $1',
    [id]
  );

  res.json({
    success: true,
    data: {
      ...billResult.rows[0],
      items: itemsResult.rows
    }
  });
};

export const approveBill = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get bill details
    const billResult = await client.query(
      'SELECT * FROM bills WHERE bill_id = $1',
      [id]
    );

    if (billResult.rows.length === 0) {
      throw new AppError('Bill not found', 404);
    }

    const bill = billResult.rows[0];

    // Get bill items
    const itemsResult = await client.query(
      'SELECT * FROM bill_items WHERE bill_id = $1',
      [id]
    );

    // Create journal entry
    const journalResult = await client.query(
      `INSERT INTO journal_entries (
        entry_date, reference_type, reference_id, description,
        total_debit, total_credit, status, created_by
      ) VALUES ($1, 'BILL', $2, $3, $4, $4, 'POSTED', $5)
      RETURNING journal_id`,
      [
        bill.bill_date || new Date(),
        bill.bill_id,
        `Bill: ${bill.bill_number || 'N/A'}`,
        bill.total_amount,
        req.user?.user_id
      ]
    );

    const journalId = journalResult.rows[0].journal_id;

    // Create journal lines
    // DR: Expense accounts (from bill items or default category account)
    for (const item of itemsResult.rows) {
      let accountId = item.account_id;

      // If no account assigned, use default based on category
      if (!accountId) {
        const accountResult = await client.query(
          `SELECT account_id FROM accounts WHERE account_code = $1`,
          [this.getCategoryAccountCode(bill.category)]
        );
        accountId = accountResult.rows[0]?.account_id;
      }

      await client.query(
        `INSERT INTO journal_entry_lines (journal_id, account_id, debit_amount, credit_amount, description)
         VALUES ($1, $2, $3, 0, $4)`,
        [journalId, accountId, item.amount, item.description]
      );
    }

    // CR: Accounts Payable
    const apResult = await client.query(
      `SELECT account_id FROM accounts WHERE account_code = '2000'`
    );

    await client.query(
      `INSERT INTO journal_entry_lines (journal_id, account_id, debit_amount, credit_amount, description)
       VALUES ($1, $2, 0, $3, $4)`,
      [journalId, apResult.rows[0].account_id, bill.total_amount, 'Accounts Payable']
    );

    // Update bill status
    await client.query(
      'UPDATE bills SET status = $1, journal_id = $2 WHERE bill_id = $3',
      [BillStatus.POSTED, journalId, id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Bill approved and posted to accounting',
      data: { journal_id: journalId }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

function getCategoryAccountCode(category: string): string {
  const mapping: { [key: string]: string } = {
    'RAW_MATERIALS': '5000',
    'ARTIST_ROYALTY': '5010',
    'MARKETING': '6020',
    'LOGISTICS': '6000',
    'RENT': '6400',
    'UTILITIES': '6500',
    'SALARY': '6300',
    'OTHER': '6900'
  };

  return mapping[category] || '6900';
}
