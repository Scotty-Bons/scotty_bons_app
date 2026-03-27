import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters.")
    .max(100, "Category name must be at most 100 characters."),
});

export type CreateCategoryValues = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema;

export type UpdateCategoryValues = CreateCategoryValues;

const modifierSchema = z.object({
  id: z.string().uuid().optional(),
  label: z
    .string()
    .trim()
    .min(1, "Modifier label is required.")
    .max(50, "Modifier must be at most 50 characters."),
  price: z
    .number({ error: "Price must be a number." })
    .positive("Price must be greater than zero.")
    .max(99999999.99, "Price must be at most 99,999,999.99."),
  sort_order: z.number().int().min(0).optional(),
});

export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Product name must be at least 2 characters.")
    .max(200, "Product name must be at most 200 characters."),
  category_id: z.string().uuid("Invalid category."),
  modifiers: z
    .array(modifierSchema)
    .min(1, "At least one modifier is required."),
});

export type CreateProductValues = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema;

export type UpdateProductValues = CreateProductValues;
