import { z } from "zod";

/**
 * Schema for creating an order
 */
export const createOrderSchema = z.object({
  shippingAddressId: z.string().uuid("Invalid shipping address ID"),
  billingAddressId: z.string().uuid("Invalid billing address ID"),
  notes: z.string().optional().nullable(),
  promoCode: z.string().optional().nullable(),
  // Cart items from frontend localStorage cart
  items: z.array(z.object({
    productId: z.string().uuid("Invalid product ID"),
    quantity: z.number().int().min(1),
  })).optional(),
  // If ordering from a post review, track which post referred this order
  sourcePostId: z.string().uuid("Invalid post ID").optional().nullable(),
});

/**
 * Schema for updating order status
 */
export const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
});

/**
 * Schema for updating an order — consumers may only update notes.
 * Status transitions go through dedicated endpoints.
 */
export const updateOrderSchema = z.object({
  notes: z.string().optional().nullable(),
});

/**
 * Schema for listing orders query parameters
 */
export const listOrdersQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
