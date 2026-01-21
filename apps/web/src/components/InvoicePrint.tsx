"use client";

import { useEffect, useState } from 'react';
import { settingsAPI } from '@/lib/api';
import { formatExpiryDisplay } from "@/lib/expiryUtils";

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

  // Calculate totals
  const totalTaxableAmount = items.reduce((sum, item) => {
    const qty = Number(item.quantity);
    const rate = Number(item.unitRate);
    const discPct = Number(item.discountPct) || 0;
    return sum + (qty * rate * (1 - discPct / 100));
  }, 0);

  const totalGstAmount = items.reduce((sum, item) => {
    const qty = Number(item.quantity);
    const rate = Number(item.unitRate);
    const discPct = Number(item.discountPct) || 0;
    const gstPct = Number(item.gstPct) || 0;
    const taxable = qty * rate * (1 - discPct / 100);
    return sum + (taxable * gstPct / 100);
  }, 0);

  const totalDiscount = Number(invoice.totalDiscount) || items.reduce((sum, item) => {
    return sum + (Number(item.quantity) * Number(item.unitRate) * Number(item.discountPct) / 100);
  }, 0);

  const grandTotal = Number(invoice.grandTotal) || items.reduce((sum, item) => sum + Number(item.amount || item.totalAmount || 0), 0);
  const cgstAmount = totalGstAmount / 2;
  const sgstAmount = totalGstAmount / 2;

  // Payment details
  const payment = invoice.payment || {};
  const advanceUsed = Number(payment.advanceUsed || invoice.advanceUsed || 0);
  const previousDue = Number(payment.previousDue || invoice.previousDue || 0);
  const paidAmount = Number(payment.amount || invoice.paidAmount || 0);
  const paymentMode = payment.mode || invoice.paymentMode || 'CASH';
  const dueAmount = Number(invoice.dueAmount || 0);
  const netPayable = grandTotal + previousDue - advanceUsed;
  const balanceDue = netPayable - paidAmount;

  // Single Invoice Copy Component
  const InvoiceCopy = ({ copyType }: { copyType: 'ORIGINAL' | 'DUPLICATE' }) => (
    <div style={{
      width: '48%',
      border: '1px solid #000',
      padding: '8px',
      fontSize: '9px',
      fontFamily: 'Arial, sans-serif',
      boxSizing: 'border-box' as const,
      backgroundColor: '#fff',
    }}>
      {/* Copy Type Badge */}
      <div style={{
        textAlign: 'center',
        backgroundColor: '#000',
        color: '#fff',
        padding: '2px 8px',
        fontSize: '8px',
        fontWeight: 'bold',
        marginBottom: '5px',
      }}>
        {copyType} {copyType === 'ORIGINAL' ? '(For Buyer)' : '(For Seller)'}
      </div>

      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '1px solid #000', paddingBottom: '5px', marginBottom: '5px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase' }}>{settings.companyName}</div>
        <div style={{ fontSize: '8px' }}>{settings.address}, {settings.city} {settings.pincode}</div>
        <div style={{ fontSize: '8px' }}>Ph: {settings.phone} {settings.email && `| ${settings.email}`}</div>
        <div style={{ fontSize: '8px', fontWeight: 'bold' }}>GSTIN: {settings.gstin}</div>
        <div style={{ fontSize: '7px' }}>DL: {settings.dlNumber20b} | {settings.dlNumber21b}</div>
      </div>

      {/* Invoice Title */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', margin: '3px 0' }}>
        TAX INVOICE
      </div>

      {/* Invoice Info Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '4px' }}>
        <div style={{ width: '60%' }}>
          <div style={{ fontWeight: 'bold', fontSize: '8px' }}>Bill To:</div>
          <div style={{ fontWeight: 'bold', fontSize: '10px' }}>{customer.name}</div>
          {customer.address && <div style={{ fontSize: '8px' }}>{customer.address}</div>}
          {customer.city && <div style={{ fontSize: '8px' }}>{customer.city}{customer.state && `, ${customer.state}`}</div>}
          {customer.mobile && <div style={{ fontSize: '8px' }}>Mob: {customer.mobile}</div>}
          {customer.gstin && <div style={{ fontSize: '8px' }}>GSTIN: {customer.gstin}</div>}
          {customer.dlNumber && <div style={{ fontSize: '8px', fontWeight: 'bold' }}>DL No: {customer.dlNumber}</div>}
        </div>
        <div style={{ width: '38%', textAlign: 'right', fontSize: '8px' }}>
          <div><b>Inv No:</b> {invoice.invoiceNo}</div>
          <div><b>Date:</b> {new Date(invoice.invoiceDate || Date.now()).toLocaleDateString('en-IN')}</div>
          <div><b>Time:</b> {new Date(invoice.invoiceDate || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
          <div style={{ marginTop: '2px', padding: '2px 4px', border: '1px solid #000', display: 'inline-block' }}>
            {invoice.invoiceType || 'CASH'}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f0f0f0' }}>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '7px', width: '14px' }}>#</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '7px', textAlign: 'left' }}>Product</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '7px', width: '40px' }}>Batch</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '7px', width: '28px' }}>Exp</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '7px', width: '22px' }}>Qty</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '7px', width: '32px', textAlign: 'right' }}>MRP</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '7px', width: '32px', textAlign: 'right' }}>Rate</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '7px', width: '20px' }}>D%</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '7px', width: '20px' }}>G%</th>
            <th style={{ border: '1px solid #000', padding: '2px', fontSize: '7px', width: '38px', textAlign: 'right' }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px', textAlign: 'center' }}>{index + 1}</td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px', textAlign: 'left', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(item.productName || item.product?.name || '').substring(0, 25)}
              </td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '6px', textAlign: 'center' }}>{item.batchNo || item.batch?.batchNo}</td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '6px', textAlign: 'center' }}>{item.expiry || formatExpiryDisplay(item.batch?.expiryDate)}</td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px', textAlign: 'right' }}>{Number(item.mrp || item.batch?.mrp || item.unitRate).toFixed(0)}</td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px', textAlign: 'right' }}>{Number(item.unitRate).toFixed(2)}</td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '6px', textAlign: 'center' }}>{Number(item.discountPct) > 0 ? Number(item.discountPct) : '-'}</td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '6px', textAlign: 'center' }}>{Number(item.gstPct)}</td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px', textAlign: 'right', fontWeight: 'bold' }}>{Number(item.amount || item.totalAmount).toFixed(2)}</td>
            </tr>
          ))}
          {/* Empty rows to maintain consistent height for small bills */}
          {items.length < 8 && Array.from({ length: 8 - items.length }).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px', height: '12px' }}>&nbsp;</td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px' }}></td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px' }}></td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px' }}></td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px' }}></td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px' }}></td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px' }}></td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px' }}></td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px' }}></td>
              <td style={{ border: '1px solid #000', padding: '1px 2px', fontSize: '7px' }}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        {/* Amount in Words */}
        <div style={{ width: '55%', border: '1px solid #000', padding: '4px', fontSize: '7px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Amount in Words:</div>
          <div style={{ fontSize: '8px' }}>{numberToWords(Math.round(grandTotal))} Rupees Only</div>
          <div style={{ marginTop: '3px', fontSize: '6px', fontStyle: 'italic' }}>* Prices inclusive of GST</div>
        </div>

        {/* Totals */}
        <div style={{ width: '42%', fontSize: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
            <span>Taxable Amt:</span>
            <span>{totalTaxableAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
            <span>CGST:</span>
            <span>{cgstAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
            <span>SGST:</span>
            <span>{sgstAmount.toFixed(2)}</span>
          </div>
          {totalDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
              <span>Discount:</span>
              <span>-{totalDiscount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: 'bold', borderTop: '1px solid #000', marginTop: '2px', fontSize: '10px' }}>
            <span>TOTAL:</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
          
          {previousDue > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0', fontSize: '7px' }}>
              <span>+ Prev Due:</span>
              <span>{previousDue.toFixed(2)}</span>
            </div>
          )}
          {advanceUsed > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0', fontSize: '7px' }}>
              <span>- Advance:</span>
              <span>{advanceUsed.toFixed(2)}</span>
            </div>
          )}
          {paidAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0', fontSize: '7px' }}>
              <span>Received ({paymentMode}):</span>
              <span>{paidAmount.toFixed(2)}</span>
            </div>
          )}
          
          {/* Final Status */}
          {(dueAmount > 0 || balanceDue > 0) ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 4px', fontWeight: 'bold', backgroundColor: '#f0f0f0', border: '1px solid #000', marginTop: '2px', fontSize: '9px' }}>
              <span>BALANCE DUE:</span>
              <span>₹{(dueAmount || balanceDue).toFixed(2)}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 4px', fontWeight: 'bold', backgroundColor: '#e8f5e9', border: '1px solid #000', marginTop: '2px', fontSize: '9px' }}>
              <span>PAID</span>
              <span>✓</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', paddingTop: '4px', fontSize: '7px' }}>
        <div style={{ width: '55%' }}>
          <div style={{ fontWeight: 'bold' }}>Terms:</div>
          <div>1. Goods once sold will not be taken back</div>
          <div>2. Subject to local jurisdiction</div>
        </div>
        <div style={{ width: '40%', textAlign: 'right' }}>
          <div style={{ fontSize: '8px', fontWeight: 'bold' }}>For {settings.companyName}</div>
          <div style={{ marginTop: '18px', borderTop: '1px solid #000', paddingTop: '2px', fontSize: '7px' }}>
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      width: '100%',
      maxWidth: '297mm', // A4 Landscape width
      margin: '0 auto',
      padding: '5mm',
      boxSizing: 'border-box' as const,
      backgroundColor: '#fff',
    }}>
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 5mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      
      {/* Dual Copy Container */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '10px',
      }}>
        <InvoiceCopy copyType="ORIGINAL" />
        <InvoiceCopy copyType="DUPLICATE" />
      </div>
    </div>
  );
}

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
