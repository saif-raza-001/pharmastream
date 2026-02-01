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

  return (
    <div style={{
      width: '200mm',
      minHeight: '290mm',
      margin: '0 auto',
      padding: '2mm 5mm 2mm 3mm',
      boxSizing: 'border-box' as const,
      backgroundColor: '#fff',
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Print Styles - Adjusted margins */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 2mm 5mm 2mm 3mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      
      {/* Single Invoice - Full Width */}
      <div style={{
        width: '100%',
        border: '2px solid #000',
        padding: '10px',
        fontSize: '14px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
          <div style={{ fontSize: '26px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px' }}>{settings.companyName}</div>
          <div style={{ fontSize: '13px', marginTop: '4px', fontWeight: '500' }}>{settings.address}, {settings.city} - {settings.pincode}</div>
          <div style={{ fontSize: '13px', fontWeight: '500' }}>Ph: {settings.phone} {settings.email && `| Email: ${settings.email}`}</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '3px' }}>GSTIN: {settings.gstin}</div>
          <div style={{ fontSize: '12px', fontWeight: '500' }}>DL No: {settings.dlNumber20b} | {settings.dlNumber21b}</div>
        </div>

        {/* Invoice Title */}
        <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px', margin: '5px 0', textDecoration: 'underline' }}>
          TAX INVOICE
        </div>

        {/* Invoice Info Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
          <div style={{ width: '55%' }}>
            <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' }}>Bill To:</div>
            <div style={{ fontWeight: 'bold', fontSize: '17px' }}>{customer.name}</div>
            {customer.address && <div style={{ fontSize: '13px', fontWeight: '500' }}>{customer.address}</div>}
            {customer.city && <div style={{ fontSize: '13px', fontWeight: '500' }}>{customer.city}{customer.state && `, ${customer.state}`} {customer.pincode}</div>}
            {customer.mobile && <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Mobile: {customer.mobile}</div>}
            {customer.gstin && <div style={{ fontSize: '13px', fontWeight: 'bold' }}>GSTIN: {customer.gstin}</div>}
            {customer.dlNumber && <div style={{ fontSize: '13px', fontWeight: 'bold' }}>DL No: {customer.dlNumber}</div>}
          </div>
          <div style={{ width: '42%', textAlign: 'right', fontSize: '13px' }}>
            <div style={{ marginBottom: '3px' }}><b>Invoice No:</b> <span style={{ fontSize: '17px', fontWeight: 'bold' }}>{invoice.invoiceNo}</span></div>
            <div style={{ marginBottom: '3px', fontWeight: 'bold' }}>Date: {new Date(invoice.invoiceDate || Date.now()).toLocaleDateString('en-IN')}</div>
            <div style={{ marginBottom: '3px', fontWeight: 'bold' }}>Time: {new Date(invoice.invoiceDate || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            <div style={{ marginTop: '6px', padding: '4px 15px', border: '2px solid #000', display: 'inline-block', fontWeight: 'bold', fontSize: '14px', backgroundColor: '#f5f5f5' }}>
              {invoice.invoiceType || 'CASH'}
            </div>
          </div>
        </div>

        {/* Items Table - Bigger & Bolder */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#e0e0e0' }}>
              <th style={{ border: '2px solid #000', padding: '6px 2px', fontSize: '12px', fontWeight: 'bold', width: '22px' }}>#</th>
              <th style={{ border: '2px solid #000', padding: '6px 2px', fontSize: '12px', fontWeight: 'bold', textAlign: 'left' }}>Product Name</th>
              <th style={{ border: '2px solid #000', padding: '6px 2px', fontSize: '12px', fontWeight: 'bold', width: '65px' }}>Batch</th>
              <th style={{ border: '2px solid #000', padding: '6px 2px', fontSize: '12px', fontWeight: 'bold', width: '50px' }}>Expiry</th>
              <th style={{ border: '2px solid #000', padding: '6px 2px', fontSize: '12px', fontWeight: 'bold', width: '35px' }}>Qty</th>
              <th style={{ border: '2px solid #000', padding: '6px 2px', fontSize: '12px', fontWeight: 'bold', width: '55px', textAlign: 'right' }}>MRP</th>
              <th style={{ border: '2px solid #000', padding: '6px 2px', fontSize: '12px', fontWeight: 'bold', width: '55px', textAlign: 'right' }}>Rate</th>
              <th style={{ border: '2px solid #000', padding: '6px 2px', fontSize: '12px', fontWeight: 'bold', width: '32px' }}>D%</th>
              <th style={{ border: '2px solid #000', padding: '6px 2px', fontSize: '12px', fontWeight: 'bold', width: '32px' }}>GST</th>
              <th style={{ border: '2px solid #000', padding: '6px 2px', fontSize: '12px', fontWeight: 'bold', width: '70px', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                <td style={{ border: '1px solid #000', padding: '5px 3px', fontSize: '13px', textAlign: 'left', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.productName || item.product?.name || ''}
                </td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' }}>{item.batchNo || item.batch?.batchNo}</td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' }}>{item.expiry || formatExpiryDisplay(item.batch?.expiryDate)}</td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '14px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px', textAlign: 'right', fontWeight: 'bold' }}>{Number(item.mrp || item.batch?.mrp || item.unitRate).toFixed(2)}</td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px', textAlign: 'right', fontWeight: 'bold' }}>{Number(item.unitRate).toFixed(2)}</td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' }}>{Number(item.discountPct) > 0 ? Number(item.discountPct).toFixed(0) : '-'}</td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' }}>{Number(item.gstPct)}</td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '13px', textAlign: 'right', fontWeight: 'bold' }}>₹{Number(item.amount || item.totalAmount).toFixed(2)}</td>
              </tr>
            ))}
            {/* Empty rows for consistent look */}
            {items.length < 12 && Array.from({ length: Math.max(0, 12 - items.length) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px', height: '24px' }}>&nbsp;</td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px' }}></td>
                <td style={{ border: '1px solid #000', padding: '5px 2px', fontSize: '12px' }}></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Summary Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          {/* Amount in Words */}
          <div style={{ width: '53%', border: '2px solid #000', padding: '8px', fontSize: '12px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' }}>Amount in Words:</div>
            <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{numberToWords(Math.round(grandTotal))} Rupees Only</div>
            <div style={{ marginTop: '8px', fontSize: '11px', fontStyle: 'italic', color: '#555' }}>* Prices are inclusive of GST</div>
          </div>

          {/* Totals */}
          <div style={{ width: '45%', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>
              <span>Taxable Amount:</span>
              <span>₹{totalTaxableAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>
              <span>CGST:</span>
              <span>₹{cgstAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>
              <span>SGST:</span>
              <span>₹{sgstAmount.toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderBottom: '1px solid #ccc', fontWeight: 'bold' }}>
                <span>Discount:</span>
                <span>-₹{totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 6px', fontWeight: 'bold', borderTop: '3px solid #000', marginTop: '4px', fontSize: '17px', backgroundColor: '#f5f5f5' }}>
              <span>GRAND TOTAL:</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
            
            {previousDue > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '12px', fontWeight: 'bold' }}>
                <span>+ Previous Due:</span>
                <span>₹{previousDue.toFixed(2)}</span>
              </div>
            )}
            {advanceUsed > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '12px', fontWeight: 'bold' }}>
                <span>- Advance Used:</span>
                <span>₹{advanceUsed.toFixed(2)}</span>
              </div>
            )}
            {paidAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '12px', fontWeight: 'bold' }}>
                <span>Received ({paymentMode}):</span>
                <span>₹{paidAmount.toFixed(2)}</span>
              </div>
            )}
            
            {/* Final Status */}
            {(dueAmount > 0 || balanceDue > 0) ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', fontWeight: 'bold', backgroundColor: '#fff3cd', border: '3px solid #000', marginTop: '6px', fontSize: '16px' }}>
                <span>BALANCE DUE:</span>
                <span>₹{(dueAmount || balanceDue).toFixed(2)}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', fontWeight: 'bold', backgroundColor: '#d4edda', border: '3px solid #28a745', marginTop: '6px', fontSize: '16px', color: '#155724' }}>
                <span>FULLY PAID</span>
                <span>✓</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #000', paddingTop: '8px', fontSize: '11px' }}>
          <div style={{ width: '55%' }}>
            <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>Terms & Conditions:</div>
            <div style={{ fontWeight: '500' }}>1. Goods once sold will not be taken back or exchanged.</div>
            <div style={{ fontWeight: '500' }}>2. All disputes subject to local jurisdiction only.</div>
            <div style={{ fontWeight: '500' }}>3. E. & O.E. (Errors and Omissions Excepted)</div>
          </div>
          <div style={{ width: '40%', textAlign: 'right' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>For {settings.companyName}</div>
            <div style={{ marginTop: '30px', borderTop: '1px solid #000', paddingTop: '4px', fontSize: '12px', display: 'inline-block', paddingLeft: '25px', paddingRight: '25px', fontWeight: 'bold' }}>
              Authorized Signatory
            </div>
          </div>
        </div>
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
