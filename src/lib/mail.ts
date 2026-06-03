export interface SMTPVerificationResult {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Returns null as SMTP is disabled/removed.
 */
export function getTransporter() {
  return null;
}

/**
 * Mock SMTP Verification (always returns disabled error).
 */
export async function verifyGmailSMTP(): Promise<SMTPVerificationResult> {
  return {
    success: false,
    message: "Gmail SMTP Gateway is currently disabled/removed.",
    error: "SMTP_DISABLED",
  };
}

/**
 * Simulates sending an email by printing to the server console.
 */
export async function sendTestVerificationEmail(toEmail: string): Promise<boolean> {
  const testSubject = "VividGallery - Mock Mail Gateway";
  
  console.log(`\n========================================`);
  console.log(`[SMTP MOCK] Test email sent to: ${toEmail}`);
  console.log(`Subject: ${testSubject}`);
  console.log(`Status: SMTP is disabled. This is a local console simulation.`);
  console.log(`========================================\n`);
  
  return true;
}
