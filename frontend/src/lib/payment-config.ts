/** MVP: Shetab/IPG checkout is hidden until a real driver is wired.
 * Set VITE_GATEWAY_CHECKOUT_ENABLED=true only in dev/staging when testing sandbox. */
export const GATEWAY_CHECKOUT_ENABLED =
  import.meta.env.VITE_GATEWAY_CHECKOUT_ENABLED === 'true';
