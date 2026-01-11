"use client";

import { useState, useRef } from 'react';
import { createWorker } from 'tesseract.js';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BillOCRProps {
  onExtractedData: (items: any[]) => void;
  onClose: () => void;
}

export default function BillOCR({ onExtractedData, onClose }: BillOCRProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedText, setExtractedText] = useState('');
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Process with OCR
    processImage(file);
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setExtractedText('');
    setParsedItems([]);

    try {
      // Initialize Tesseract worker
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      // Process image
      const { data: { text } } = await worker.recognize(file);
      
      setExtractedText(text);
      
      // Parse the extracted text
      parseExtractedText(text);

      await worker.terminate();
      setIsProcessing(false);
    } catch (error) {
      console.error('OCR Error:', error);
      toast.error('Failed to process image');
      setIsProcessing(false);
    }
  };

  const parseExtractedText = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const items: any[] = [];
    
    // Common patterns in pharmacy bills
    const patterns = {
      // Pattern for product lines: Name, Batch, Expiry, Qty, MRP
      productLine: /^(.+?)\s+([A-Z0-9]+)\s+(\d{2}[\/\-]\d{2}[\/\-]?\d{0,4})\s+(\d+)\s+(\d+\.?\d*)/i,
      
      // Individual patterns
      batch: /[A-Z0-9]{3,15}/,
      expiry: /\d{2}[\/\-]\d{2}[\/\-]?\d{0,4}/,
      quantity: /QTY[:\s]*(\d+)/i,
      mrp: /MRP[:\s]*(\d+\.?\d*)/i,
      rate: /RATE[:\s]*(\d+\.?\d*)/i,
      amount: /AMO?U?NT[:\s]*(\d+\.?\d*)/i,
      gst: /GST[:\s]*(\d+)%?/i,
      
      // Medicine name patterns
      medicine: /(TAB|CAP|SYR|INJ|CREAM|OINT|DROP|POWDER|SUSP)\.?\s+([A-Z][A-Za-z\s\-\.0-9]+)/i
    };

    // Smart parsing logic
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Try to match complete product line
      const productMatch = line.match(patterns.productLine);
      if (productMatch) {
        items.push({
          productName: cleanProductName(productMatch[1]),
          batchNo: productMatch[2],
          expiry: formatExpiry(productMatch[3]),
          qty: parseInt(productMatch[4]),
          mrp: parseFloat(productMatch[5]),
          pRate: 0,
          sRate: 0,
          gst: 12
        });
        continue;
      }

      // Try to identify medicine names
      const medicineMatch = line.match(patterns.medicine);
      if (medicineMatch) {
        const item: any = {
          productName: cleanProductName(line),
          batchNo: '',
          expiry: '',
          qty: 0,
          mrp: 0,
          pRate: 0,
          sRate: 0,
          gst: 12
        };

        // Look for details in next few lines
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const detailLine = lines[j];
          
          // Extract batch
          if (!item.batchNo) {
            const batchMatch = detailLine.match(patterns.batch);
            if (batchMatch) item.batchNo = batchMatch[0];
          }
          
          // Extract expiry
          if (!item.expiry) {
            const expiryMatch = detailLine.match(patterns.expiry);
            if (expiryMatch) item.expiry = formatExpiry(expiryMatch[0]);
          }
          
          // Extract quantity
          if (item.qty === 0) {
            const qtyMatch = detailLine.match(patterns.quantity) || detailLine.match(/(\d+)\s*(PCS|STRIP|BOTTLE|VIAL|TUBE)/i);
            if (qtyMatch) item.qty = parseInt(qtyMatch[1]);
          }
          
          // Extract MRP
          if (item.mrp === 0) {
            const mrpMatch = detailLine.match(patterns.mrp) || detailLine.match(/(\d+\.?\d*)\s*\/-/);
            if (mrpMatch) item.mrp = parseFloat(mrpMatch[1]);
          }
        }

        if (item.productName && (item.qty > 0 || item.mrp > 0)) {
          items.push(item);
        }
      }
    }

    // If no structured data found, try to extract key-value pairs
    if (items.length === 0) {
      const item: any = {
        productName: '',
        batchNo: '',
        expiry: '',
        qty: 0,
        mrp: 0,
        pRate: 0,
        sRate: 0,
        gst: 12
      };

      lines.forEach(line => {
        // Extract quantities
        const qtyMatch = line.match(/(\d+)\s*(PCS|STRIP|BOTTLE|NOS|QTY)/i);
        if (qtyMatch && item.qty === 0) {
          item.qty = parseInt(qtyMatch[1]);
        }

        // Extract prices
        const priceMatch = line.match(/(\d+\.?\d*)\s*(RS|INR|₹|\/-)/i);
        if (priceMatch && item.mrp === 0) {
          item.mrp = parseFloat(priceMatch[1]);
        }

        // Extract GST
        const gstMatch = line.match(/(\d+)\s*%/);
        if (gstMatch) {
          const gstValue = parseInt(gstMatch[1]);
          if ([5, 12, 18].includes(gstValue)) {
            item.gst = gstValue;
          }
        }
      });

      // Try to find product names (lines with alphabets and common medicine suffixes)
      const potentialProducts = lines.filter(line => 
        /[A-Za-z]{3,}/.test(line) && 
        !/(INVOICE|BILL|TOTAL|GST|CUSTOMER|DATE|PHARMA|MEDICAL)/i.test(line)
      );

      if (potentialProducts.length > 0) {
        potentialProducts.forEach(name => {
          items.push({
            ...item,
            productName: cleanProductName(name)
          });
        });
      }
    }

    setParsedItems(items.filter(item => item.productName));
  };

  const cleanProductName = (name: string): string => {
    return name
      .replace(/^\d+[\.\)]\s*/, '') // Remove leading numbers
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/[^\w\s\-\.]/g, '') // Remove special chars
      .trim()
      .toUpperCase();
  };

  const formatExpiry = (expiry: string): string => {
    // Convert MM/YY or MM-YY to YYYY-MM-DD format
    const parts = expiry.split(/[\/\-]/);
    if (parts.length === 2) {
      const month = parts[0].padStart(2, '0');
      let year = parts[1];
      
      // Convert 2-digit year to 4-digit
      if (year.length === 2) {
        year = parseInt(year) > 50 ? '19' + year : '20' + year;
      }
      
      // Return as YYYY-MM-01 (first day of month)
      return `${year}-${month}-01`;
    }
    return expiry;
  };

  const handleManualEdit = (index: number, field: string, value: any) => {
    const updated = [...parsedItems];
    updated[index] = { ...updated[index], [field]: value };
    setParsedItems(updated);
  };

  const handleAddToCart = () => {
    if (parsedItems.length === 0) {
      toast.error('No items to add');
      return;
    }

    // Calculate estimated rates if not provided
    const finalItems = parsedItems.map(item => ({
      ...item,
      batchNo: item.batchNo || 'BATCH001',
      expiry: item.expiry || '2025-12-31',
      qty: item.qty || 1,
      pRate: item.pRate || (item.mrp * 0.70), // 70% of MRP as purchase rate
      sRate: item.sRate || (item.mrp * 0.85), // 85% of MRP as sale rate
      mrp: item.mrp || 0,
      gst: item.gst || 12
    }));

    onExtractedData(finalItems);
    toast.success(`Added ${finalItems.length} items from bill`);
  };

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <div className="border-2 border-dashed border-purple-300 rounded-lg p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        {!imagePreview ? (
          <div className="text-center">
            <div className="text-4xl mb-3">📷</div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-purple-600"
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Upload Bill Image'}
            </Button>
            <p className="text-xs text-gray-500 mt-3">
              Supports: JPG, PNG, PDF (as image)
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Image Preview */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Bill Image:</p>
              <img 
                src={imagePreview} 
                alt="Bill" 
                className="w-full h-64 object-contain border rounded"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                variant="outline"
                className="mt-2 w-full"
              >
                Change Image
              </Button>
            </div>
            
            {/* OCR Result */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Extracted Text:</p>
              <textarea
                value={extractedText}
                onChange={(e) => {
                  setExtractedText(e.target.value);
                  parseExtractedText(e.target.value);
                }}
                className="w-full h-64 text-[10px] border rounded p-2 font-mono"
                placeholder="OCR will extract text here..."
              />
              {isProcessing && (
                <div className="mt-2">
                  <div className="bg-purple-100 rounded-full h-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-center mt-1">Processing... {progress}%</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Parsed Items */}
      {parsedItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">
            📋 Extracted {parsedItems.length} items (Edit if needed):
          </p>
          
          <div className="border rounded overflow-auto max-h-64">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Product Name</th>
                  <th className="p-2">Batch</th>
                  <th className="p-2">Expiry</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">MRP</th>
                  <th className="p-2">P.Rate</th>
                  <th className="p-2">GST%</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {parsedItems.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1">
                      <input
                        value={item.productName}
                        onChange={(e) => handleManualEdit(i, 'productName', e.target.value)}
                        className="w-full px-1 border rounded text-xs"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        value={item.batchNo}
                        onChange={(e) => handleManualEdit(i, 'batchNo', e.target.value)}
                        className="w-20 px-1 border rounded text-xs text-center"
                        placeholder="BATCH001"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="date"
                        value={item.expiry}
                        onChange={(e) => handleManualEdit(i, 'expiry', e.target.value)}
                        className="w-28 px-1 border rounded text-xs"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.qty || ''}
                        onChange={(e) => handleManualEdit(i, 'qty', parseInt(e.target.value))}
                        className="w-16 px-1 border rounded text-xs text-center"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.mrp || ''}
                        onChange={(e) => handleManualEdit(i, 'mrp', parseFloat(e.target.value))}
                        className="w-16 px-1 border rounded text-xs text-center"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.pRate || ''}
                        onChange={(e) => handleManualEdit(i, 'pRate', parseFloat(e.target.value))}
                        className="w-16 px-1 border rounded text-xs text-center"
                        placeholder="Auto"
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={item.gst}
                        onChange={(e) => handleManualEdit(i, 'gst', parseInt(e.target.value))}
                        className="w-16 px-1 border rounded text-xs"
                      >
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                      </select>
                    </td>
                    <td className="p-1">
                      <button
                        onClick={() => setParsedItems(parsedItems.filter((_, idx) => idx !== i))}
                        className="text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tips */}
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-[10px] text-blue-700">
              💡 <strong>Tips:</strong> 
              • Edit product names to match your inventory
              • Purchase rate auto-calculated as 70% of MRP if not found
              • Sale rate auto-calculated as 85% of MRP
              • Default expiry set to next year if not detected
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setExtractedText('');
                setParsedItems([]);
                setImagePreview(null);
              }}
              variant="outline"
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={handleAddToCart}
              className="bg-green-600 hover:bg-green-700"
            >
              Add {parsedItems.length} Items to Purchase
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
