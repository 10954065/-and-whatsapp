import { z } from "zod";
import { passwordSchema } from "@/lib/security/password";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80, "Name is too long."),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal("on", { error: "Please accept the Terms and Privacy Policy." }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(256),
  next: z.string().max(512).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(128),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const tokenSchema = z.object({ token: z.string().min(20).max(128) });

export const mfaCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, "Enter the 6-digit code.")
    .max(16, "Code is too long."),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const disableMfaSchema = z.object({ password: z.string().min(1, "Enter your password.") });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
