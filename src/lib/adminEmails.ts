/** Emails allowed to use the admin side. Override with NEXT_PUBLIC_ADMIN_EMAILS (comma-separated). */
const DEFAULT_ADMIN_EMAILS = ["manager@demo.local"];

export function adminEmails(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  const list = raw
    ? raw
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_ADMIN_EMAILS;
  return list;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}
