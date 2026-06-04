import { z } from 'zod';
import { userRoleSchema } from './auth.schema';

// Update profile schema
export const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
});

// Update expert details schema
export const updateExpertDetailsSchema = z.object({
  expertise: z.array(z.string()).min(1, 'At least one expertise is required').optional(),
  linkedinUrl: z.string().url('Invalid LinkedIn URL').optional().nullable(),
  bio: z.string().max(1000, 'Bio must be less than 1000 characters').optional().nullable(),
  yearsOfExperience: z.number().int().min(0).max(50).optional().nullable(),
  clothingSizes: z.record(z.string()).optional(),
});

// Update brand details schema
export const updateBrandDetailsSchema = z.object({
  brandName: z.string().min(2, 'Brand name must be at least 2 characters').optional(),
  businessType: z.string().optional().nullable(),
  websiteUrl: z.string().url('Invalid website URL').optional().nullable(),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional().nullable(),
  logoUrl: z.string().url('Invalid logo URL').optional().nullable(),
});

// Query params for listing users
export const listUsersQuerySchema = z.object({
  role: userRoleSchema.optional(),
  verified: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Type exports
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateExpertDetailsInput = z.infer<typeof updateExpertDetailsSchema>;
export type UpdateBrandDetailsInput = z.infer<typeof updateBrandDetailsSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
