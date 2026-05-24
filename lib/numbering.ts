// Expands a user-defined invoice number format with simple tokens.
//   {YYYY} → 4-digit year
//   {YY}   → 2-digit year
//   {MM}   → 2-digit month
//   {###}  → counter padded to N digits (the count of # chars sets the width)
// Example: ("{YYYY}-{####}", 7, new Date('2026-05-01')) => "2026-0007"

export function formatInvoiceNumber(format: string, counter: number, when: Date = new Date()): string {
  const year = when.getFullYear();
  const month = when.getMonth() + 1;

  let out = format;
  out = out.replace(/\{YYYY\}/g, String(year));
  out = out.replace(/\{YY\}/g, String(year).slice(-2));
  out = out.replace(/\{MM\}/g, String(month).padStart(2, '0'));
  out = out.replace(/\{(#+)\}/g, (_, hashes: string) => {
    return String(counter).padStart(hashes.length, '0');
  });
  return out;
}
