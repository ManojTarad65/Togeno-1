import { z } from "zod";

// Pitch status enum matching database
export const pitchStatusEnum = z.enum([
  "pending",
  "accepted",
  "declined",
  "shipped",
  "delivered",
  "posted",
]);

// Create pitch schema (brand_admin creates a pitch to an expert)
export const createPitchSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  communityId: z.string().uuid("Invalid community ID"),
  expertId: z.string().uuid("Invalid expert ID"),
  message: z.string().max(2000, "Message must be at most 2000 characters").optional().nullable(),
  offerDetails: z.string().max(2000, "Offer details must be at most 2000 characters").optional().nullable(),
  requirements: z.string().max(2000, "Requirements must be at most 2000 characters").optional().nullable(),
  postingDeadline: z.string().optional().nullable(),
  selectedSize: z.string().max(50).optional().nullable(),
});

// Update pitch schema (for brand to update their pitch details)
export const updatePitchSchema = z.object({
  message: z.string().max(2000).optional().nullable(),
  offerDetails: z.string().max(2000).optional().nullable(),
  requirements: z.string().max(2000).optional().nullable(),
  postingDeadline: z.string().optional().nullable(),
});

// Expert response to pitch (accept or decline)
export const respondToPitchSchema = z.object({
  status: z.enum(["accepted", "declined"]),
  expertResponse: z.string().max(2000, "Response must be at most 2000 characters").optional().nullable(),
});

// Query params for listing pitches
export const listPitchesQuerySchema = z.object({
  status: pitchStatusEnum.optional(),
  productId: z.string().uuid().optional(),
  communityId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sortBy: z.enum(["created_at", "updated_at", "expires_at", "posting_deadline"]).optional().default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// Type exports
export type PitchStatus = z.infer<typeof pitchStatusEnum>;
export type CreatePitchInput = z.infer<typeof createPitchSchema>;
export type UpdatePitchInput = z.infer<typeof updatePitchSchema>;
export type RespondToPitchInput = z.infer<typeof respondToPitchSchema>;
export type ListPitchesQuery = z.infer<typeof listPitchesQuerySchema>;
