const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const {
  listCustomers, createCustomer, updateCustomer,
  listInvoices, getInvoice, createInvoice, updateInvoice,
  updateInvoiceStatus, recordInvoicePayment, deleteInvoice,
  getInvoiceSummary
} = require('../controllers/invoiceController');

// All routes require at least manager role
router.use(authorize('manager', 'admin'));

// Customers
router.get('/invoices/customers',          listCustomers);
router.post('/invoices/customers',         createCustomer);
router.patch('/invoices/customers/:customer_id', updateCustomer);

// Invoice summary stats
router.get('/invoices/summary',            getInvoiceSummary);

// Invoices CRUD
router.get('/invoices',                    listInvoices);
router.post('/invoices',                   createInvoice);
router.get('/invoices/:invoice_id',        getInvoice);
router.patch('/invoices/:invoice_id',      updateInvoice);
router.patch('/invoices/:invoice_id/status', updateInvoiceStatus);
router.post('/invoices/:invoice_id/payments', recordInvoicePayment);
router.delete('/invoices/:invoice_id',     authorize('admin'), deleteInvoice);

module.exports = router;
