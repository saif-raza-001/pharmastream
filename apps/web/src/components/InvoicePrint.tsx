"use client";

import { useEffect, useState } from 'react';
import { settingsAPI } from '@/lib/api';

interface InvoicePrintProps {
  invoice: any;
  customer: any;
  items: any[];
}

export default function InvoicePrint({ invoice, customer, items }: InvoicePrintProps) {
  const [settings, setSettings] = useState<any>(null);
  
  useEffect(() => {
    settingsAPI.get().then(res => setSettings(res.data)).catch(console.error);
  }, []);

  if (!settings) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

  // Calculate totals from items if not provided
  const totals = invoice.totals || {
    grossAmount: Number(invoice.grossAmount) || items.reduce((sum, item) => sum + Number(item.amount || item.totalAmount || 0), 0),
    totalDiscount: Number(invoice.totalDiscount) || 0,
    taxableAmount: Number(invoice.taxableAmount) || 0,
    gstAmount: Number(invoice.cgstAmount || 0) + Number(invoice.sgstAmount || 0),
    grandTotal: Number(invoice.grandTotal) || 0
  };
  
  if (!totals.taxableAmount) totals.taxableAmount = totals.grossAmount - totals.totalDiscount;
  if (!totals.grandTotal) totals.grandTotal = totals.taxableAmount + totals.gstAmount;
  
  const cgst = totals.gstAmount / 2;
  const sgst = totals.gstAmount / 2;

  // Payment details - try from invoice.payment first, then from database fields
  const payment = invoice.payment || {};
  const advanceUsed = Number(payment.advanceUsed || invoice.advanceUsed || 0);
  const previousDue = Number(payment.previousDue || invoice.previousDue || 0);
  const paidAmount = Number(payment.amount || invoice.paidAmount || 0);
  const paymentMode = payment.mode || invoice.paymentMode || 'CASH';
  const dueAmount = Number(invoice.dueAmount || 0);
  
  // Calculate net payable
  const netPayable = totals.grandTotal + previousDue - advanceUsed;
  const balanceDue = netPayable - paidAmount;

  // Inline styles for print compatibility
  const styles = {
    container: {
      backgroundColor: '#ffffff',
      padding: '30px',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#000000',
    },
    header: {
      textAlign: 'center' as const,
      borderBottom: '2px solid #000',
      paddingBottom: '15px',
      marginBottom: '15px',
    },
    companyName: {
      fontSize: '20px',
      fontWeight: 'bold',
      textTransform: 'uppercase' as const,
      margin: '0',
    },
    headerText: {
      fontSize: '11px',
      margin: '3px 0',
    },
    invoiceTitle: {
      textAlign: 'center' as const,
      marginBottom: '15px',
    },
    titleText: {
      fontSize: '16px',
      fontWeight: 'bold',
      margin: '0',
    },
    subtitleText: {
      fontSize: '11px',
      margin: '5px 0 0 0',
    },
    infoRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '20px',
    },
    billTo: {
      width: '50%',
    },
    invoiceInfo: {
      width: '50%',
      textAlign: 'right' as const,
    },
    labelBold: {
      fontWeight: 'bold',
      fontSize: '11px',
      marginBottom: '5px',
    },
    infoText: {
      fontSize: '11px',
      margin: '2px 0',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
      marginBottom: '15px',
    },
    tableHeader: {
      backgroundColor: '#f0f0f0',
    },
    th: {
      border: '1px solid #000',
      padding: '6px 4px',
      fontSize: '9px',
      fontWeight: 'bold',
      textAlign: 'center' as const,
    },
    thLeft: {
      border: '1px solid #000',
      padding: '6px 4px',
      fontSize: '9px',
      fontWeight: 'bold',
      textAlign: 'left' as const,
    },
    thRight: {
      border: '1px solid #000',
      padding: '6px 4px',
      fontSize: '9px',
      fontWeight: 'bold',
      textAlign: 'right' as const,
    },
    td: {
      border: '1px solid #000',
      padding: '5px 4px',
      fontSize: '9px',
      textAlign: 'center' as const,
    },
    tdLeft: {
      border: '1px solid #000',
      padding: '5px 4px',
      fontSize: '9px',
      textAlign: 'left' as const,
    },
    tdRight: {
      border: '1px solid #000',
      padding: '5px 4px',
      fontSize: '9px',
      textAlign: 'right' as const,
    },
    summaryRow: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '15px',
    },
    amountWords: {
      width: '50%',
      border: '1px solid #000',
      padding: '8px',
    },
    totalsBox: {
      width: '45%',
    },
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '3px 0',
      fontSize: '10px',
    },
    grandTotalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '6px 0',
      fontSize: '12px',
      fontWeight: 'bold',
      borderTop: '2px solid #000',
      marginTop: '5px',
    },
    footer: {
      marginTop: '20px',
      paddingTop: '10px',
      borderTop: '1px solid #ccc',
      display: 'flex',
      justifyContent: 'space-between',
    },
    terms: {
      width: '50%',
      fontSize: '8px',
      color: '#666',
    },
    signature: {
      width: '40%',
      textAlign: 'right' as const,
    },
    signatureLine: {
      marginTop: '30px',
      borderTop: '1px solid #000',
      paddingTop: '5px',
      fontSize: '9px',
    },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.companyName}>{settings.companyName}</h1>
        <p style={styles.headerText}>{settings.address}</p>
        <p style={styles.headerText}>{settings.city} {settings.state} {settings.pincode}</p>
        <p style={styles.headerText}>Phone: {settings.phone} {settings.email && `| Email: ${settings.email}`}</p>
        {settings.gstin && <p style={{...styles.headerText, fontWeight: 'bold'}}>GSTIN: {settings.gstin}</p>}
        <p style={styles.headerText}>Drug License: {settings.dlNumber20b} | {settings.dlNumber21b}</p>
      </div>

      {/* Invoice Title */}
      <div style={styles.invoiceTitle}>
        <h2 style={styles.titleText}>TAX INVOICE</h2>
        <p style={styles.subtitleText}>({invoice.invoiceType || 'CASH'} SALE)</p>
      </div>

      {/* Invoice Details & Customer Info */}
      <div style={styles.infoRow}>
        <div style={styles.billTo}>
          <p style={styles.labelBold}>Bill To:</p>
          <p style={{...styles.infoText, fontWeight: 'bold'}}>{customer.name}</p>
          {customer.address && <p style={styles.infoText}>{customer.address}</p>}
          {customer.city && <p style={styles.infoText}>{customer.city}, {customer.state}</p>}
          {customer.mobile && <p style={styles.infoText}>Mobile: {customer.mobile}</p>}
          {customer.gstin && <p style={styles.infoText}>GSTIN: {customer.gstin}</p>}
        </div>
        <div style={styles.invoiceInfo}>
          <p style={styles.infoText}><span style={{fontWeight: 'bold'}}>Invoice No:</span> {invoice.invoiceNo}</p>
          <p style={styles.infoText}><span style={{fontWeight: 'bold'}}>Date:</span> {new Date(invoice.invoiceDate || Date.now()).toLocaleDateString('en-IN')}</p>
          <p style={styles.infoText}><span style={{fontWeight: 'bold'}}>Time:</span> {new Date(invoice.invoiceDate || Date.now()).toLocaleTimeString('en-IN')}</p>
        </div>
      </div>

      {/* Items Table */}
      <table style={styles.table}>
        <thead>
          <tr style={styles.tableHeader}>
            <th style={{...styles.th, width: '25px'}}>#</th>
            <th style={{...styles.thLeft, width: '160px'}}>Product</th>
            <th style={{...styles.th, width: '60px'}}>Batch</th>
            <th style={{...styles.th, width: '45px'}}>Exp</th>
            <th style={{...styles.th, width: '35px'}}>Qty</th>
            <th style={{...styles.thRight, width: '50px'}}>MRP</th>
            <th style={{...styles.thRight, width: '50px'}}>Rate</th>
            <th style={{...styles.th, width: '35px'}}>D%</th>
            <th style={{...styles.th, width: '35px'}}>GST%</th>
            <th style={{...styles.thRight, width: '60px'}}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td style={styles.td}>{index + 1}</td>
              <td style={styles.tdLeft}>{item.productName || item.product?.name}</td>
              <td style={styles.td}>{item.batchNo || item.batch?.batchNo}</td>
              <td style={styles.td}>{item.expiry || (item.batch?.expiryDate ? new Date(item.batch.expiryDate).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }) : '')}</td>
              <td style={{...styles.td, fontWeight: 'bold'}}>
                {item.quantity}
                {(item.freeQuantity > 0) && <span style={{fontSize: '7px'}}>(+{item.freeQuantity})</span>}
              </td>
              <td style={styles.tdRight}>₹{Number(item.mrp || item.batch?.mrp || item.unitRate).toFixed(2)}</td>
              <td style={styles.tdRight}>₹{Number(item.unitRate).toFixed(2)}</td>
              <td style={styles.td}>{Number(item.discountPct)}%</td>
              <td style={styles.td}>{Number(item.gstPct)}%</td>
              <td style={{...styles.tdRight, fontWeight: 'bold'}}>₹{Number(item.amount || item.totalAmount).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary & Payment */}
      <div style={styles.summaryRow}>
        {/* Amount in Words */}
        <div style={styles.amountWords}>
          <p style={{fontWeight: 'bold', marginBottom: '5px', fontSize: '9px'}}>Amount in Words:</p>
          <p style={{fontSize: '10px'}}>{numberToWords(Math.round(netPayable > 0 ? netPayable : totals.grandTotal))} Rupees Only</p>
        </div>

        {/* Totals */}
        <div style={styles.totalsBox}>
          <div style={styles.totalRow}>
            <span>Gross Amount:</span>
            <span style={{fontWeight: 'bold'}}>₹{totals.grossAmount.toFixed(2)}</span>
          </div>
          {totals.totalDiscount > 0 && (
            <div style={styles.totalRow}>
              <span>Discount:</span>
              <span>-₹{totals.totalDiscount.toFixed(2)}</span>
            </div>
          )}
          <div style={styles.totalRow}>
            <span>CGST + SGST:</span>
            <span>₹{totals.gstAmount.toFixed(2)}</span>
          </div>
          <div style={{...styles.totalRow, fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '5px'}}>
            <span>Bill Amount:</span>
            <span>₹{totals.grandTotal.toFixed(2)}</span>
          </div>
          
          {/* Show Previous Due if added */}
          {previousDue > 0 && (
            <div style={{...styles.totalRow, color: '#dc3545'}}>
              <span>+ Previous Due:</span>
              <span>₹{previousDue.toFixed(2)}</span>
            </div>
          )}
          
          {/* Show Advance Used if any */}
          {advanceUsed > 0 && (
            <div style={{...styles.totalRow, color: '#28a745'}}>
              <span>- Advance Adjusted:</span>
              <span>₹{advanceUsed.toFixed(2)}</span>
            </div>
          )}
          
          {/* Net Payable (if different from bill amount) */}
          {(previousDue > 0 || advanceUsed > 0) && (
            <div style={{...styles.totalRow, fontWeight: 'bold', backgroundColor: '#e9ecef', padding: '4px'}}>
              <span>Net Payable:</span>
              <span>₹{netPayable.toFixed(2)}</span>
            </div>
          )}
          
          {/* Amount Received */}
          {paidAmount > 0 && (
            <div style={{...styles.totalRow, color: '#28a745'}}>
              <span>Received ({paymentMode}):</span>
              <span>₹{paidAmount.toFixed(2)}</span>
            </div>
          )}
          
          {/* Balance Due or Paid Status */}
          {dueAmount > 0 || balanceDue > 0 ? (
            <div style={styles.grandTotalRow}>
              <span style={{color: '#dc3545'}}>BALANCE DUE:</span>
              <span style={{color: '#dc3545'}}>₹{(dueAmount || balanceDue).toFixed(2)}</span>
            </div>
          ) : balanceDue < 0 ? (
            <div style={styles.grandTotalRow}>
              <span style={{color: '#28a745'}}>NEW ADVANCE:</span>
              <span style={{color: '#28a745'}}>₹{Math.abs(balanceDue).toFixed(2)}</span>
            </div>
          ) : (
            <div style={styles.grandTotalRow}>
              <span style={{color: '#28a745'}}>PAID</span>
              <span style={{color: '#28a745'}}>✓</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.terms}>
          <p style={{fontWeight: 'bold', marginBottom: '3px'}}>Terms & Conditions:</p>
          <p>1. Goods once sold will not be taken back</p>
          <p>2. Subject to local jurisdiction</p>
          <p>3. E. & O.E.</p>
        </div>
        <div style={styles.signature}>
          <p style={{fontSize: '10px', fontWeight: 'bold'}}>For {settings.companyName}</p>
          <div style={styles.signatureLine}>
            Authorized Signature
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to convert number to words
function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  if (num === 0) return 'Zero';
  
  function convertLessThanThousand(n: number): string {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanThousand(n % 100) : '');
  }
  
  if (num < 1000) return convertLessThanThousand(num);
  if (num < 100000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return convertLessThanThousand(thousands) + ' Thousand' + (remainder !== 0 ? ' ' + convertLessThanThousand(remainder) : '');
  }
  if (num < 10000000) {
    const lakhs = Math.floor(num / 100000);
    const remainder = num % 100000;
    return convertLessThanThousand(lakhs) + ' Lakh' + (remainder !== 0 ? ' ' + numberToWords(remainder) : '');
  }
  return 'Amount too large';
}
