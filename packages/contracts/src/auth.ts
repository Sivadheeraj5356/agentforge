import { z } from "zod";

import { DisplayNameSchema } from "./organization";

export const SignUpInputSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(72),
  displayName: DisplayNameSchema.optional(),
});

export const SignInInputSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(72),
});

export const ForgotPasswordInputSchema = z.object({
  email: z.string().trim().email().max(320),
});

export const ResetPasswordInputSchema = z.object({
  password: z.string().min(8).max(72),
});

export type SignUpInput = z.infer<typeof SignUpInputSchema>;
export type SignInInput = z.infer<typeof SignInInputSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
