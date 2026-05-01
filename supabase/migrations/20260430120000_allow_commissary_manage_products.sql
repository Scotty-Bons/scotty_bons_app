-- Allow commissary users to add and edit products (mirrors admin permissions
-- for products, modifiers and images — but NOT for categories or hard deletes
-- of products, which remain admin-only).

-- 1. products INSERT — commissary can create products
CREATE POLICY "products_insert_commissary"
  ON products FOR INSERT
  WITH CHECK (auth_role() = 'commissary');

-- products UPDATE for commissary already exists
-- (products_update_commissary, added in 20260410200000_add_product_in_stock).

-- 2. product_modifiers — commissary needs full management because updateProduct
-- deletes existing modifier rows and re-inserts the new set on every save.
CREATE POLICY "product_modifiers_manage_commissary"
  ON product_modifiers FOR ALL
  TO authenticated
  USING (auth_role() = 'commissary')
  WITH CHECK (auth_role() = 'commissary');

-- 3. product_images table — commissary can attach, reorder and remove images
CREATE POLICY "product_images_insert_commissary"
  ON product_images FOR INSERT
  TO authenticated
  WITH CHECK (auth_role() = 'commissary');

CREATE POLICY "product_images_update_commissary"
  ON product_images FOR UPDATE
  TO authenticated
  USING (auth_role() = 'commissary');

CREATE POLICY "product_images_delete_commissary"
  ON product_images FOR DELETE
  TO authenticated
  USING (auth_role() = 'commissary');

-- 4. storage.objects in the product-images bucket — commissary can upload and
-- remove image files from storage.
CREATE POLICY "product_images_storage_insert_commissary"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth_role() = 'commissary'
  );

CREATE POLICY "product_images_storage_update_commissary"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND auth_role() = 'commissary'
  );

CREATE POLICY "product_images_storage_delete_commissary"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND auth_role() = 'commissary'
  );
