export type CheckoutFormState = {
  message?: string;
  success?: boolean;
  redirectTo?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};
