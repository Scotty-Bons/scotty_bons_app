-- Allow commissary to read product categories (needed for the Products page).

DROP POLICY "product_categories_select_admin_store" ON product_categories;

CREATE POLICY "product_categories_select_all_roles"
  ON product_categories FOR SELECT
  USING (auth_role() IN ('admin', 'commissary', 'store'));
