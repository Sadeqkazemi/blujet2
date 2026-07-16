export const TWO_FACTOR_PROVIDER = Symbol('TWO_FACTOR_PROVIDER');

export interface TwoFactorProvider {
  /** Delivers a 2FA code to the given staff user (SMS/email — provider decides). */
  sendCode(
    user: {
      id: string;
      fullName: string;
      email: string | null;
      phone: string | null;
    },
    code: string,
  ): Promise<void>;
}
