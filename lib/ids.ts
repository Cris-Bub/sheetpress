import { nanoid } from 'nanoid';

// 12-char ids are short enough to be readable in URLs and big enough that
// collision risk is negligible at the scale of a single user's lifetime invoices.
export function id(): string {
  return nanoid(12);
}
