-- Agency self-service password reset via SMS OTP.
ALTER TYPE "TwoFactorPurpose" ADD VALUE IF NOT EXISTS 'AGENCY_PASSWORD_RESET';
