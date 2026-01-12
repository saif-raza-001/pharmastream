/**
 * Expiry Date Utilities
 * Format: MM/YY (e.g., "05/25" for May 2025)
 * Storage: ISO date string with last day of month (e.g., "2025-05-31")
 */

/**
 * Convert MM/YY input to ISO date string (last day of month)
 * "05/25" → "2025-05-31"
 * "12/26" → "2026-12-31"
 */
export function parseExpiryInput(mmyy: string): string {
  if (!mmyy || mmyy.length < 4) return '';
  
  const cleaned = mmyy.replace(/[^0-9/]/g, '');
  
  let month: string, year: string;
  
  if (cleaned.includes('/')) {
    [month, year] = cleaned.split('/');
  } else if (cleaned.length === 4) {
    month = cleaned.substring(0, 2);
    year = cleaned.substring(2, 4);
  } else {
    return '';
  }
  
  const monthNum = parseInt(month, 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return '';
  
  let fullYear = parseInt(year, 10);
  if (isNaN(fullYear)) return '';
  if (fullYear < 100) {
    fullYear = 2000 + fullYear;
  }
  
  const lastDay = new Date(fullYear, monthNum, 0).getDate();
  
  return `${fullYear}-${month.padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
}

/**
 * Convert ISO date string or Date to MM/YY display format
 * "2025-05-31" → "05/25"
 */
export function formatExpiryDisplay(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '';
    
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    
    return `${month}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Format input as user types (auto-insert slash)
 * "05" → "05/"
 * "0525" → "05/25"
 */
export function formatExpiryOnType(value: string, previousValue: string): string {
  let cleaned = value.replace(/[^0-9/]/g, '');
  
  const parts = cleaned.split('/');
  if (parts.length > 2) {
    cleaned = parts[0] + '/' + parts.slice(1).join('');
  }
  
  if (cleaned.length === 2 && !cleaned.includes('/') && value.length > previousValue.length) {
    cleaned = cleaned + '/';
  }
  
  if (cleaned.length > 5) {
    cleaned = cleaned.substring(0, 5);
  }
  
  return cleaned;
}

/**
 * Check if expiry is within next N days
 */
export function isExpiringSoon(dateInput: string | Date, days: number = 30): boolean {
  if (!dateInput) return false;
  
  try {
    const expiryDate = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    
    return expiryDate <= futureDate && expiryDate >= today;
  } catch {
    return false;
  }
}

/**
 * Check if already expired
 */
export function isExpired(dateInput: string | Date): boolean {
  if (!dateInput) return false;
  
  try {
    const expiryDate = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return expiryDate < today;
  } catch {
    return false;
  }
}
