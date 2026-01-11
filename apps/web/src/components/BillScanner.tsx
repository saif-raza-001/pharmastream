"use client";

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Extended item interface with all fields
interface ExtractedItem {
  productName: string;
  manufacturer: string;
  batchNo: string;
  expiry: string;
  hsn: string;
  pack: string;
  qty: number;
  freeQty: number;
  mrp: number;
  pRate: number;
  sRate: number;
  discount: number;
  gst: number;
  amount: number;
}

interface BillScannerProps {
  onExtractedData: (items: ExtractedItem[]) => void;
  onClose: () => void;
}

// Create empty item template
const createEmptyItem = (): ExtractedItem => ({
  productName: '',
  manufacturer: '',
  batchNo: '',
  expiry: '',
  hsn: '3004',
  pack: '',
  qty: 0,
  freeQty: 0,
  mrp: 0,
  pRate: 0,
  sRate: 0,
  discount: 0,
  gst: 12,
  amount: 0
});

export default function BillScanner({ onExtractedData, onClose }: BillScannerProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'paste' | 'scan'>('manual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteDelimiter, setPasteDelimiter] = useState<'tab' | 'comma' | 'pipe'>('tab');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Table items state - start with one empty row
  const [tableItems, setTableItems] = useState<ExtractedItem[]>([createEmptyItem()]);

  // Add new row
  const addRow = () => {
    setTableItems([...tableItems, createEmptyItem()]);
  };

  // Remove row
  const removeRow = (index: number) => {
    if (tableItems.length === 1) {
      setTableItems([createEmptyItem()]);
    } else {
      setTableItems(tableItems.filter((_, i) => i !== index));
    }
  };

  // Update cell with auto-calculations
  const updateCell = (index: number, field: keyof ExtractedItem, value: any) => {
    const updated = [...tableItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate purchase rate from MRP (70%)
    if (field === 'mrp' && !updated[index].pRate) {
      updated[index].pRate = Math.round(Number(value) * 0.70 * 100) / 100;
    }
    
    // Auto-calculate sale rate from MRP (85%)
    if (field === 'mrp' && !updated[index].sRate) {
      updated[index].sRate = Math.round(Number(value) * 0.85 * 100) / 100;
    }
    
    // Auto-calculate amount
    if (['qty', 'pRate', 'discount'].includes(field)) {
      const qty = Number(updated[index].qty) || 0;
      const pRate = Number(updated[index].pRate) || 0;
      const discount = Number(updated[index].discount) || 0;
      updated[index].amount = Math.round(qty * pRate * (1 - discount / 100) * 100) / 100;
    }
    
    setTableItems(updated);
  };

  // Image preprocessing for better OCR on dot matrix prints
  const preprocessImage = async (imageSrc: string): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Scale up for better OCR (2x)
        const scale = 2;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Draw scaled image
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Convert to grayscale and increase contrast
        for (let i = 0; i < data.length; i += 4) {
          // Grayscale
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          // Increase contrast (factor 1.5)
          const factor = 1.5;
          const contrast = factor * (gray - 128) + 128;
          
          // Threshold for binarization (makes dots more solid)
          const threshold = contrast > 140 ? 255 : 0;
          
          data[i] = threshold;     // R
          data[i + 1] = threshold; // G
          data[i + 2] = threshold; // B
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      };
      img.src = imageSrc;
    });
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPG, PNG)');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageSrc = e.target?.result as string;
      setImagePreview(imageSrc);
      await processImage(imageSrc);
    };
    reader.readAsDataURL(file);
  };

  // Process image with OCR
  const processImage = async (imageSrc: string) => {
    setIsProcessing(true);
    setProgress(0);
    setExtractedText('');

    try {
      // Preprocess image for dot matrix
      setProgress(10);
      toast.info('Preprocessing image for dot matrix...');
      const processedBlob = await preprocessImage(imageSrc);
      
      setProgress(20);
      toast.info('Loading OCR engine...');
      
      // Dynamic import Tesseract
      const Tesseract = await import('tesseract.js');
      
      const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(20 + Math.round(m.progress * 70));
          }
        },
      });

      // Set parameters for dot matrix
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-/.,%() ',
        preserve_interword_spaces: '1',
      });

      const { data: { text } } = await worker.recognize(processedBlob);
      
      setExtractedText(text);
      setProgress(95);
      
      // Parse the text
      parsePharmaBillText(text);
      
      await worker.terminate();
      setProgress(100);
      
    } catch (error) {
      console.error('OCR Error:', error);
      toast.error('OCR failed. Try manual entry or paste mode.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Parse pharmacy bill text - enhanced for Indian formats
  const parsePharmaBillText = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim().length > 3);
    const items: ExtractedItem[] = [];
    
    // Common pharma patterns
    const patterns = {
      // Medicine indicators
      medicine: /(TAB|CAP|SYR|INJ|CREAM|OINT|DROP|POWDER|SUSP|GEL|LOTION|SOAP)\b\.?\s*/i,
      
      // Batch patterns: B.NO, BATCH, B:, BN:
      batch: /(?:B\.?NO|BATCH|BN)[:\s]*([A-Z0-9\-]+)/i,
      
      // Expiry patterns: EXP, EXPIRY, E:
      expiry: /(?:EXP(?:IRY)?|E)[:\s]*(\d{1,2}[\/\-]\d{2,4})/i,
      
      // HSN code (4-8 digits)
      hsn: /(?:HSN)[:\s]*(\d{4,8})/i,
      
      // Pack formats: 10X10, 15x10, 100ML, 60ML, etc
      pack: /(\d+\s*[Xx*]\s*\d+|\d+\s*(?:ML|MG|GM|TAB|CAP|STRIP))/i,
      
      // Quantity patterns with free: 10+2, 10 + 2, QTY: 10
      qtyFree: /(\d+)\s*[+\+]\s*(\d+)/,
      qty: /(?:QTY|QUANTITY)[:\s]*(\d+)/i,
      
      // Price patterns
      mrp: /(?:MRP|M\.R\.P)[:\s]*[₹Rs\.]*\s*(\d+\.?\d*)/i,
      rate: /(?:RATE|PTR|P\.RATE|PUR)[:\s]*[₹Rs\.]*\s*(\d+\.?\d*)/i,
      
      // GST
      gst: /(?:GST|CGST|SGST)[:\s]*(\d+)\s*%?/i,
      
      // Manufacturer (all caps, often on separate line)
      mfr: /^([A-Z][A-Z\s&\.]{5,30})$/
    };
    
    let currentItem: ExtractedItem | null = null;
    let lastManufacturer = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip headers and totals
      if (/^(INVOICE|BILL|TOTAL|SUBTOTAL|CUSTOMER|ADDRESS|PHONE|DATE|S\.?NO|SR\.?NO|PARTICULARS)/i.test(line)) {
        continue;
      }
      
      // Check for manufacturer line (all caps, no numbers usually)
      const mfrMatch = line.match(patterns.mfr);
      if (mfrMatch && !/\d/.test(line) && line.length > 5 && line.length < 35) {
        lastManufacturer = mfrMatch[1].trim();
        continue;
      }
      
      // Check if line contains medicine indicator
      if (patterns.medicine.test(line)) {
        // Save previous item if exists
        if (currentItem && currentItem.productName) {
          items.push(currentItem);
        }
        
        // Start new item
        currentItem = createEmptyItem();
        currentItem.manufacturer = lastManufacturer;
        
        // Extract product name (remove common prefixes/suffixes)
        currentItem.productName = line
          .replace(/^\d+[\.\)]\s*/, '') // Remove serial numbers
          .replace(/\s+\d+\.?\d*\s*$/, '') // Remove trailing numbers
          .trim()
          .toUpperCase();
        
        // Extract pack from same line if present
        const packMatch = line.match(patterns.pack);
        if (packMatch) {
          currentItem.pack = packMatch[1].replace(/\s/g, '');
        }
        
        continue;
      }
      
      // If we have a current item, look for details
      if (currentItem) {
        // Batch
        const batchMatch = line.match(patterns.batch);
        if (batchMatch && !currentItem.batchNo) {
          currentItem.batchNo = batchMatch[1].toUpperCase();
        }
        
        // Expiry
        const expiryMatch = line.match(patterns.expiry);
        if (expiryMatch && !currentItem.expiry) {
          const exp = expiryMatch[1];
          // Convert MM/YY to YYYY-MM-DD
          const parts = exp.split(/[\/\-]/);
          if (parts.length === 2) {
            const month = parts[0].padStart(2, '0');
            let year = parts[1];
            if (year.length === 2) {
              year = parseInt(year) > 50 ? '19' + year : '20' + year;
            }
            currentItem.expiry = `${year}-${month}-01`;
          }
        }
        
        // HSN
        const hsnMatch = line.match(patterns.hsn);
        if (hsnMatch) {
          currentItem.hsn = hsnMatch[1];
        }
        
        // Pack (if not already found)
        if (!currentItem.pack) {
          const packMatch = line.match(patterns.pack);
          if (packMatch) {
            currentItem.pack = packMatch[1].replace(/\s/g, '');
          }
        }
        
        // Quantity with free
        const qtyFreeMatch = line.match(patterns.qtyFree);
        if (qtyFreeMatch) {
          currentItem.qty = parseInt(qtyFreeMatch[1]);
          currentItem.freeQty = parseInt(qtyFreeMatch[2]);
        } else {
          const qtyMatch = line.match(patterns.qty);
          if (qtyMatch && !currentItem.qty) {
            currentItem.qty = parseInt(qtyMatch[1]);
          }
        }
        
        // MRP
        const mrpMatch = line.match(patterns.mrp);
        if (mrpMatch && !currentItem.mrp) {
          currentItem.mrp = parseFloat(mrpMatch[1]);
          // Auto-calculate rates
          currentItem.pRate = Math.round(currentItem.mrp * 0.70 * 100) / 100;
          currentItem.sRate = Math.round(currentItem.mrp * 0.85 * 100) / 100;
        }
        
        // Purchase Rate
        const rateMatch = line.match(patterns.rate);
        if (rateMatch) {
          currentItem.pRate = parseFloat(rateMatch[1]);
        }
        
        // GST
        const gstMatch = line.match(patterns.gst);
        if (gstMatch) {
          const gstVal = parseInt(gstMatch[1]);
          if ([5, 12, 18, 28].includes(gstVal)) {
            currentItem.gst = gstVal;
          }
        }
        
        // Try to extract numbers from lines that look like data rows
        // Format often: Qty | Free | Rate | MRP | Amount
        const numbers = line.match(/\d+\.?\d*/g);
        if (numbers && numbers.length >= 3) {
          // Heuristic: if we have 3+ numbers and no specific matches yet
          if (!currentItem.qty && numbers[0]) {
            const possibleQty = parseInt(numbers[0]);
            if (possibleQty > 0 && possibleQty < 10000) {
              currentItem.qty = possibleQty;
            }
          }
          if (!currentItem.mrp && numbers.length >= 2) {
            const possibleMrp = parseFloat(numbers[numbers.length - 2]);
            if (possibleMrp > 0 && possibleMrp < 100000) {
              currentItem.mrp = possibleMrp;
              currentItem.pRate = Math.round(possibleMrp * 0.70 * 100) / 100;
              currentItem.sRate = Math.round(possibleMrp * 0.85 * 100) / 100;
            }
          }
        }
      }
    }
    
    // Don't forget last item
    if (currentItem && currentItem.productName) {
      items.push(currentItem);
    }
    
    // Calculate amounts for all items
    items.forEach(item => {
      if (!item.batchNo) item.batchNo = '';
      if (!item.expiry) item.expiry = '';
      item.amount = Math.round((item.qty || 0) * (item.pRate || 0) * (1 - (item.discount || 0) / 100) * 100) / 100;
    });
    
    if (items.length > 0) {
      setTableItems(items);
      toast.success(`Extracted ${items.length} items. Please verify and correct.`);
    } else {
      toast.warning('Could not extract structured data. Use manual entry.');
    }
  };

  // Parse pasted data from Excel/CSV
  const parsePastedData = () => {
    if (!pasteText.trim()) {
      toast.error('Paste data first');
      return;
    }
    
    const delimiter = pasteDelimiter === 'tab' ? '\t' : 
                      pasteDelimiter === 'comma' ? ',' : '|';
    
    const lines = pasteText.split('\n').filter(line => line.trim());
    const items: ExtractedItem[] = [];
    
    // Expected format (minimum 4 columns):
    // ProductName | Manufacturer | Batch | Expiry | HSN | Pack | Qty | Free | MRP | PRate | SRate | Disc | GST
    // Or simpler:
    // ProductName | Batch | Qty | MRP
    
    for (const line of lines) {
      const parts = line.split(delimiter).map(p => p.trim());
      
      if (parts.length >= 4) {
        const item = createEmptyItem();
        
        // Flexible parsing based on number of columns
        if (parts.length >= 13) {
          // Full format
          item.productName = parts[0]?.toUpperCase() || '';
          item.manufacturer = parts[1]?.toUpperCase() || '';
          item.batchNo = parts[2]?.toUpperCase() || '';
          item.expiry = parts[3] || '';
          item.hsn = parts[4] || '3004';
          item.pack = parts[5] || '';
          item.qty = parseInt(parts[6]) || 0;
          item.freeQty = parseInt(parts[7]) || 0;
          item.mrp = parseFloat(parts[8]) || 0;
          item.pRate = parseFloat(parts[9]) || 0;
          item.sRate = parseFloat(parts[10]) || 0;
          item.discount = parseFloat(parts[11]) || 0;
          item.gst = parseFloat(parts[12]) || 12;
        } else if (parts.length >= 8) {
          // Medium format: Name | Batch | Expiry | Qty | Free | MRP | PRate | GST
          item.productName = parts[0]?.toUpperCase() || '';
          item.batchNo = parts[1]?.toUpperCase() || '';
          item.expiry = parts[2] || '';
          item.qty = parseInt(parts[3]) || 0;
          item.freeQty = parseInt(parts[4]) || 0;
          item.mrp = parseFloat(parts[5]) || 0;
          item.pRate = parseFloat(parts[6]) || 0;
          item.gst = parseFloat(parts[7]) || 12;
        } else {
          // Minimal format: Name | Batch | Qty | MRP
          item.productName = parts[0]?.toUpperCase() || '';
          item.batchNo = parts[1]?.toUpperCase() || '';
          item.qty = parseInt(parts[2]) || 0;
          item.mrp = parseFloat(parts[3]) || 0;
        }
        
        // Auto-calculate missing rates
        if (item.mrp && !item.pRate) {
          item.pRate = Math.round(item.mrp * 0.70 * 100) / 100;
        }
        if (item.mrp && !item.sRate) {
          item.sRate = Math.round(item.mrp * 0.85 * 100) / 100;
        }
        
        // Calculate amount
        item.amount = Math.round(item.qty * item.pRate * (1 - item.discount / 100) * 100) / 100;
        
        if (item.productName) {
          items.push(item);
        }
      }
    }
    
    if (items.length > 0) {
      setTableItems(items);
      setPasteText('');
      toast.success(`Parsed ${items.length} items`);
    } else {
      toast.error('Could not parse data. Check format and delimiter.');
    }
  };

  // Submit items
  const handleSubmit = () => {
    const validItems = tableItems.filter(item => 
      item.productName && item.productName.trim() !== '' && item.qty > 0
    );
    
    if (validItems.length === 0) {
      toast.error('Add at least one item with product name and quantity');
      return;
    }
    
    // Ensure all calculations are done and defaults set
    validItems.forEach(item => {
      if (!item.pRate && item.mrp) item.pRate = Math.round(item.mrp * 0.70 * 100) / 100;
      if (!item.sRate && item.mrp) item.sRate = Math.round(item.mrp * 0.85 * 100) / 100;
      if (!item.batchNo) item.batchNo = 'BATCH001';
      if (!item.expiry) item.expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 1 year from now
      if (!item.hsn) item.hsn = '3004';
      item.amount = Math.round(item.qty * item.pRate * (1 - item.discount / 100) * 100) / 100;
    });
    
    onExtractedData(validItems);
  };

  // Calculate totals
  const totals = tableItems.reduce((acc, item) => ({
    qty: acc.qty + (item.qty || 0),
    freeQty: acc.freeQty + (item.freeQty || 0),
    amount: acc.amount + (item.amount || 0)
  }), { qty: 0, freeQty: 0, amount: 0 });

  return (
    <div className="space-y-4">
      {/* Tab Selection */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'manual' 
              ? 'border-b-2 border-purple-600 text-purple-700 bg-purple-50' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📝 Manual Entry
        </button>
        <button
          onClick={() => setActiveTab('paste')}
          className={`px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'paste' 
              ? 'border-b-2 border-green-600 text-green-700 bg-green-50' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📋 Paste from Excel
        </button>
        <button
          onClick={() => setActiveTab('scan')}
          className={`px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'scan' 
              ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📷 Scan Image
        </button>
      </div>

      {/* MANUAL ENTRY TAB */}
      {activeTab === 'manual' && (
        <div>
          <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-xs text-purple-700">
              <b>💡 Tips:</b> Enter MRP → P.Rate (70%) & S.Rate (85%) auto-calculate. 
              Press Tab to move between fields. Amount auto-calculates from Qty × P.Rate - Discount.
            </p>
          </div>
          
          {/* Table */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left font-semibold min-w-[180px] sticky left-0 bg-gray-100">Product Name *</th>
                  <th className="p-2 text-left font-semibold min-w-[100px]">Manufacturer</th>
                  <th className="p-2 text-center font-semibold min-w-[80px]">Batch *</th>
                  <th className="p-2 text-center font-semibold min-w-[100px]">Expiry</th>
                  <th className="p-2 text-center font-semibold min-w-[60px]">HSN</th>
                  <th className="p-2 text-center font-semibold min-w-[60px]">Pack</th>
                  <th className="p-2 text-center font-semibold min-w-[50px] bg-yellow-50">Qty *</th>
                  <th className="p-2 text-center font-semibold min-w-[50px] bg-green-50">Free</th>
                  <th className="p-2 text-center font-semibold min-w-[70px]">MRP *</th>
                  <th className="p-2 text-center font-semibold min-w-[70px]">P.Rate</th>
                  <th className="p-2 text-center font-semibold min-w-[70px]">S.Rate</th>
                  <th className="p-2 text-center font-semibold min-w-[50px]">Disc%</th>
                  <th className="p-2 text-center font-semibold min-w-[50px]">GST%</th>
                  <th className="p-2 text-right font-semibold min-w-[80px]">Amount</th>
                  <th className="p-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {tableItems.map((item, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-1 sticky left-0 bg-white">
                      <input
                        value={item.productName}
                        onChange={(e) => updateCell(i, 'productName', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1 border rounded text-xs focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="TAB PARACETAMOL 500MG"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        value={item.manufacturer}
                        onChange={(e) => updateCell(i, 'manufacturer', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1 border rounded text-xs"
                        placeholder="CIPLA"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        value={item.batchNo}
                        onChange={(e) => updateCell(i, 'batchNo', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1 border rounded text-xs text-center font-semibold"
                        placeholder="B001"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="date"
                        value={item.expiry}
                        onChange={(e) => updateCell(i, 'expiry', e.target.value)}
                        className="w-full px-1 py-1 border rounded text-xs"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        value={item.hsn}
                        onChange={(e) => updateCell(i, 'hsn', e.target.value)}
                        className="w-full px-2 py-1 border rounded text-xs text-center"
                        placeholder="3004"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        value={item.pack}
                        onChange={(e) => updateCell(i, 'pack', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1 border rounded text-xs text-center"
                        placeholder="10X10"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.qty || ''}
                        onChange={(e) => updateCell(i, 'qty', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs text-center font-bold bg-yellow-50"
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.freeQty || ''}
                        onChange={(e) => updateCell(i, 'freeQty', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs text-center text-green-600 bg-green-50"
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.mrp || ''}
                        onChange={(e) => updateCell(i, 'mrp', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs text-center font-semibold"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.pRate || ''}
                        onChange={(e) => updateCell(i, 'pRate', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs text-center"
                        placeholder="Auto"
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.sRate || ''}
                        onChange={(e) => updateCell(i, 'sRate', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs text-center"
                        placeholder="Auto"
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.discount || ''}
                        onChange={(e) => updateCell(i, 'discount', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs text-center text-orange-600"
                        placeholder="0"
                        step="0.01"
                        min="0"
                        max="100"
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={item.gst}
                        onChange={(e) => updateCell(i, 'gst', parseInt(e.target.value))}
                        className="w-full px-1 py-1 border rounded text-xs"
                      >
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </td>
                    <td className="p-1 text-right">
                      <span className="font-semibold text-purple-700">₹{item.amount.toFixed(2)}</span>
                    </td>
                    <td className="p-1">
                      <button
                        onClick={() => removeRow(i)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2">
                <tr>
                  <td colSpan={6} className="p-2 text-right font-semibold">Totals:</td>
                  <td className="p-2 text-center font-bold text-purple-700">{totals.qty}</td>
                  <td className="p-2 text-center font-bold text-green-600">{totals.freeQty}</td>
                  <td colSpan={5}></td>
                  <td className="p-2 text-right font-bold text-purple-700">₹{totals.amount.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div className="flex justify-between mt-3">
            <Button size="sm" variant="outline" onClick={addRow}>
              + Add Row
            </Button>
            <span className="text-xs text-gray-500">
              {tableItems.filter(i => i.productName && i.qty > 0).length} valid items
            </span>
          </div>
        </div>
      )}

      {/* PASTE FROM EXCEL TAB */}
      {activeTab === 'paste' && (
        <div>
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs text-green-700 mb-2">
              <b>📋 Copy from Excel/Google Sheets:</b>
            </p>
            <div className="bg-white p-2 rounded border border-green-300 font-mono text-[10px] overflow-x-auto">
              <div className="text-gray-500 mb-1"># Full format (13 columns):</div>
              <div>Name | Manufacturer | Batch | Expiry | HSN | Pack | Qty | Free | MRP | PRate | SRate | Disc% | GST%</div>
              <div className="text-gray-500 mt-2 mb-1"># Simple format (4 columns - rates auto-calculated):</div>
              <div>Name | Batch | Qty | MRP</div>
            </div>
            
            <div className="mt-3 flex items-center gap-4">
              <span className="text-xs font-semibold">Delimiter:</span>
              <label className="text-xs flex items-center gap-1">
                <input 
                  type="radio" 
                  name="delimiter" 
                  checked={pasteDelimiter === 'tab'}
                  onChange={() => setPasteDelimiter('tab')}
                  className="w-3 h-3"
                />
                Tab (Excel default)
              </label>
              <label className="text-xs flex items-center gap-1">
                <input 
                  type="radio" 
                  name="delimiter" 
                  checked={pasteDelimiter === 'comma'}
                  onChange={() => setPasteDelimiter('comma')}
                  className="w-3 h-3"
                />
                Comma (,)
              </label>
              <label className="text-xs flex items-center gap-1">
                <input 
                  type="radio" 
                  name="delimiter" 
                  checked={pasteDelimiter === 'pipe'}
                  onChange={() => setPasteDelimiter('pipe')}
                  className="w-3 h-3"
                />
                Pipe (|)
              </label>
            </div>
          </div>
          
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="w-full h-48 text-xs border rounded-lg p-3 font-mono focus:ring-2 focus:ring-green-500"
            placeholder="Paste your data here...

Example (tab-separated):
TAB DOLO 650	MICRO	B123	2025-12-01	3004	10X15	100	10	25.50	17.85	21.68	0	12
CAP OMEZ 20	DR REDDY	D456	2026-06-01	3004	10X10	50	5	85.00	59.50	72.25	0	12"
          />
          
          <div className="flex justify-end gap-2 mt-3">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setPasteText('')}
            >
              Clear
            </Button>
            <Button 
              size="sm"
              onClick={parsePastedData}
              className="bg-green-600 hover:bg-green-700"
            >
              Parse & Load to Table
            </Button>
          </div>
        </div>
      )}

      {/* SCAN IMAGE TAB */}
      {activeTab === 'scan' && (
        <div>
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">
              <b>📷 For best results with dot matrix prints:</b>
              <br/>• Use your scanner at <b>300-400 DPI</b>, grayscale mode
              <br/>• Place challan flat, no folds or wrinkles
              <br/>• Save as PNG or JPG
              <br/>• OCR will extract and you can correct in the table
            </p>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {!imagePreview ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
            >
              <div className="text-5xl mb-4">📄</div>
              <Button className="bg-blue-600 hover:bg-blue-700" disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'Upload Scanned Bill'}
              </Button>
              <p className="text-xs text-gray-500 mt-3">
                Click or drag & drop • JPG, PNG supported
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {/* Image Preview */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold text-gray-700">Scanned Image:</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-6 text-xs"
                  >
                    Change
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden bg-gray-100">
                  <img 
                    src={imagePreview} 
                    alt="Scanned Bill" 
                    className="w-full max-h-80 object-contain"
                  />
                </div>
                
                {isProcessing && (
                  <div className="mt-3">
                    <div className="bg-blue-100 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-3 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-center mt-1 text-blue-700 font-semibold">
                      Processing... {progress}%
                    </p>
                  </div>
                )}
              </div>
              
              {/* Extracted Text */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  Extracted Text (editable):
                </p>
                <textarea
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  className="w-full h-80 text-[10px] border rounded-lg p-2 font-mono bg-gray-50"
                  placeholder="OCR text will appear here..."
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => parsePharmaBillText(extractedText)}
                  className="mt-2 w-full"
                  disabled={!extractedText}
                >
                  Re-parse Text
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Show table for Scan tab too if we have items */}
      {activeTab === 'scan' && tableItems.some(i => i.productName) && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-semibold text-gray-700 mb-2">
            📋 Extracted Items ({tableItems.filter(i => i.productName).length}) - Verify & Edit:
          </p>
          <div className="border rounded-lg overflow-x-auto max-h-64">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2">Batch</th>
                  <th className="p-2">Expiry</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Free</th>
                  <th className="p-2">MRP</th>
                  <th className="p-2">P.Rate</th>
                  <th className="p-2">S.Rate</th>
                  <th className="p-2">GST</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {tableItems.filter(i => i.productName).map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1">
                      <input
                        value={item.productName}
                        onChange={(e) => updateCell(i, 'productName', e.target.value.toUpperCase())}
                        className="w-40 px-1 border rounded text-xs"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        value={item.batchNo}
                        onChange={(e) => updateCell(i, 'batchNo', e.target.value.toUpperCase())}
                        className="w-20 px-1 border rounded text-xs text-center"
                        placeholder="BATCH"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="date"
                        value={item.expiry}
                        onChange={(e) => updateCell(i, 'expiry', e.target.value)}
                        className="w-28 px-1 border rounded text-xs"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.qty || ''}
                        onChange={(e) => updateCell(i, 'qty', parseInt(e.target.value) || 0)}
                        className="w-14 px-1 border rounded text-xs text-center"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.freeQty || ''}
                        onChange={(e) => updateCell(i, 'freeQty', parseInt(e.target.value) || 0)}
                        className="w-12 px-1 border rounded text-xs text-center text-green-600"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.mrp || ''}
                        onChange={(e) => updateCell(i, 'mrp', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 border rounded text-xs text-center"
                        step="0.01"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.pRate || ''}
                        onChange={(e) => updateCell(i, 'pRate', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 border rounded text-xs text-center"
                        step="0.01"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        value={item.sRate || ''}
                        onChange={(e) => updateCell(i, 'sRate', parseFloat(e.target.value) || 0)}
                        className="w-16 px-1 border rounded text-xs text-center"
                        step="0.01"
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={item.gst}
                        onChange={(e) => updateCell(i, 'gst', parseInt(e.target.value))}
                        className="w-14 px-1 border rounded text-xs"
                      >
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                      </select>
                    </td>
                    <td className="p-1">
                      <button
                        onClick={() => removeRow(i)}
                        className="text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="text-xs text-gray-600">
          <span className="font-semibold text-purple-700">{tableItems.filter(i => i.productName && i.qty > 0).length}</span> valid items | 
          Total: <span className="font-semibold text-purple-700">₹{totals.amount.toFixed(2)}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            className="bg-purple-600 hover:bg-purple-700 px-6"
            disabled={tableItems.filter(i => i.productName && i.qty > 0).length === 0}
          >
            Add {tableItems.filter(i => i.productName && i.qty > 0).length} Items to Purchase
          </Button>
        </div>
      </div>
    </div>
  );
}
