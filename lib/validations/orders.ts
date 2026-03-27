import { z } from "zod";

export const createOrderSchema = z.object({
  store_id: z.string().uuid("Invalid store."),
  items: z
    .array(
      z.object({
        modifier_id: z.string().uuid("Invalid modifier."),
        product_name: z.string().min(1),
        modifier_label: z.string().min(1),
        unit_price: z.number().positive(),
        quantity: z.number().int().positive("Quantity must be at least 1."),
      })
    )
    .min(1, "At least one item is required."),
});

export type CreateOrderValues = z.infer<typeof createOrderSchema>;
