import { supabaseAdmin } from "../config";
import { ApiError } from "../utils";
import { logger } from "../utils/logger";

// Product types
export interface Product {
  id: string;
  brandId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  price: number;
  compareAtPrice: number | null;
  sku: string | null;
  stockQuantity: number;
  status: "draft" | "active" | "inactive";
  isFeatured: boolean;
  averageRating: number;
  reviewCount: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  brand?: { id: string; brandName: string; logoUrl: string | null };
  category?: { id: string; name: string; slug: string };
  images?: ProductImage[];
}

export interface ProductRow {
  id: string;
  brand_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  sku: string | null;
  stock_quantity: number;
  status: "draft" | "active" | "inactive";
  is_featured: boolean;
  average_rating: number;
  review_count: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  altText: string | null;
  isPrimary: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface ProductImageRow {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

export interface ProductWithImages extends Product {
  images: ProductImage[];
}

export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  selectedSize: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartItemRow {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  selected_size: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItemWithProduct extends CartItem {
  product?: Product;
}

// Helper functions to convert snake_case to camelCase
export function toProduct(row: ProductRow & {
  brand_details?: { id: string; brand_name: string; logo_url: string | null } | null;
  categories?: { id: string; name: string; slug: string } | null;
  product_images?: ProductImageRow[];
}): Product {
  return {
    id: row.id,
    brandId: row.brand_id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    shortDescription: row.short_description,
    price: row.price,
    compareAtPrice: row.compare_at_price,
    sku: row.sku,
    stockQuantity: row.stock_quantity,
    status: row.status,
    isFeatured: row.is_featured,
    averageRating: row.average_rating,
    reviewCount: row.review_count,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    brand: row.brand_details ? {
      id: row.brand_details.id,
      brandName: row.brand_details.brand_name,
      logoUrl: row.brand_details.logo_url,
    } : undefined,
    category: row.categories ? {
      id: row.categories.id,
      name: row.categories.name,
      slug: row.categories.slug,
    } : undefined,
    images: row.product_images?.map(toProductImage),
  };
}

export function toProductImage(row: ProductImageRow): ProductImage {
  return {
    id: row.id,
    productId: row.product_id,
    imageUrl: row.image_url,
    altText: row.alt_text,
    isPrimary: row.is_primary,
    displayOrder: row.display_order,
    createdAt: row.created_at,
  };
}

export function toCartItem(row: CartItemRow): CartItem {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    quantity: row.quantity,
    selectedSize: row.selected_size ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Internal data interfaces
interface CreateProductData {
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  price: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  stockQuantity?: number;
  status?: "draft" | "active" | "inactive";
  isFeatured?: boolean;
  brandId: string;
  categoryId: string;
  metadata?: Record<string, any>;
}

interface UpdateProductData {
  name?: string;
  slug?: string;
  description?: string | null;
  shortDescription?: string | null;
  price?: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  stockQuantity?: number;
  status?: "draft" | "active" | "inactive";
  isFeatured?: boolean;
  categoryId?: string;
  metadata?: Record<string, any>;
}

interface CreateProductImageData {
  productId: string;
  imageUrl: string;
  altText?: string | null;
  isPrimary?: boolean;
  displayOrder?: number;
}

class ProductService {
  /**
   * Create a new product
   */
  async createProduct(data: CreateProductData): Promise<Product> {
    const {
      name,
      slug,
      description,
      shortDescription,
      price,
      compareAtPrice,
      sku,
      stockQuantity = 0,
      status = "draft",
      isFeatured = false,
      brandId,
      categoryId,
      metadata = {},
    } = data;

    const { data: productRow, error } = await supabaseAdmin
      .from("products")
      .insert({
        name,
        slug,
        description,
        short_description: shortDescription,
        price,
        compare_at_price: compareAtPrice,
        sku,
        stock_quantity: stockQuantity,
        status,
        is_featured: isFeatured,
        brand_id: brandId,
        category_id: categoryId,
        metadata,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique violation
        throw ApiError.badRequest("Product with this slug already exists");
      }
      if (error.code === "23503") {
        // Foreign key violation
        if (error.message.includes("brand_id")) {
          throw ApiError.badRequest("Invalid brand ID");
        }
        if (error.message.includes("category_id")) {
          throw ApiError.badRequest("Invalid category ID");
        }
      }
      logger.error("Failed to create product", {
        error: error.message,
        data,
      });
      throw ApiError.internal("Failed to create product");
    }

    return toProduct(productRow as ProductRow);
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: string): Promise<Product | null> {
    const { data: productRow, error } = await supabaseAdmin
      .from("products")
      .select("*, brand_details (id, brand_name, logo_url), categories (id, name, slug), product_images (id, image_url, alt_text, is_primary, display_order)")
      .eq("id", productId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to fetch product", {
        error: error.message,
        productId,
      });
      throw ApiError.internal("Failed to fetch product");
    }

    return toProduct(productRow as ProductRow);
  }

  /**
   * Get product by slug
   */
  async getProductBySlug(slug: string): Promise<Product | null> {
    const { data: productRow, error } = await supabaseAdmin
      .from("products")
      .select("*, brand_details (id, brand_name, logo_url), categories (id, name, slug), product_images (id, image_url, alt_text, is_primary, display_order)")
      .eq("slug", slug)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to fetch product by slug", {
        error: error.message,
        slug,
      });
      throw ApiError.internal("Failed to fetch product");
    }

    return toProduct(productRow as ProductRow);
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    data: UpdateProductData,
  ): Promise<Product> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.slug !== undefined) {
      updateData.slug = data.slug;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.shortDescription !== undefined) {
      updateData.short_description = data.shortDescription;
    }
    if (data.price !== undefined) {
      updateData.price = data.price;
    }
    if (data.compareAtPrice !== undefined) {
      updateData.compare_at_price = data.compareAtPrice;
    }
    if (data.sku !== undefined) {
      updateData.sku = data.sku;
    }
    if (data.stockQuantity !== undefined) {
      updateData.stock_quantity = data.stockQuantity;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.isFeatured !== undefined) {
      updateData.is_featured = data.isFeatured;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata;
    }
    if (data.categoryId !== undefined) {
      updateData.category_id = data.categoryId;
    }

    if (Object.keys(updateData).length === 0) {
      throw ApiError.badRequest("No fields to update");
    }

    const { data: productRow, error } = await supabaseAdmin
      .from("products")
      .update(updateData)
      .eq("id", productId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw ApiError.notFound("Product not found");
      }
      if (error.code === "23505") {
        throw ApiError.badRequest("Product with this slug already exists");
      }
      logger.error("Failed to update product", {
        error: error.message,
        productId,
      });
      throw ApiError.internal("Failed to update product");
    }

    return toProduct(productRow as ProductRow);
  }

  /**
   * Delete product (soft delete by setting status to inactive)
   */
  async deleteProduct(productId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("products")
      .update({ status: "inactive" })
      .eq("id", productId);

    if (error) {
      if (error.code === "PGRST116") {
        throw ApiError.notFound("Product not found");
      }
      logger.error("Failed to delete product", {
        error: error.message,
        productId,
      });
      throw ApiError.internal("Failed to delete product");
    }
  }

  /**
   * List products with pagination and filtering
   */
  async listProducts(options: {
    brandId?: string;
    categoryId?: string;
    status?: "draft" | "active" | "inactive";
    isFeatured?: boolean;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    communityIds?: string[];
  } = {}) {
    const {
      brandId,
      categoryId,
      status,
      isFeatured,
      minPrice,
      maxPrice,
      inStock,
      page = 1,
      limit = 20,
      search,
      sortBy = "created_at",
      sortOrder = "desc",
      communityIds,
    } = options;
    const offset = (page - 1) * limit;

    // When filtering by communities, first resolve product IDs via pitches
    let communityProductIds: string[] | null = null;
    if (communityIds && communityIds.length > 0) {
      const { data: pitchRows, error: pitchError } = await supabaseAdmin
        .from("pitches")
        .select("product_id")
        .in("community_id", communityIds)
        .in("status", ["accepted", "shipped", "delivered", "posted"]);

      if (pitchError) {
        logger.error("Failed to fetch pitches for communities", { error: pitchError.message });
        throw ApiError.internal("Failed to fetch products");
      }

      communityProductIds = [...new Set(pitchRows?.map((r: any) => r.product_id) || [])];

      if (communityProductIds.length === 0) {
        return { data: [], pagination: { page, limit, total: 0 } };
      }
    }

    let query = supabaseAdmin
      .from("products")
      .select(
        `*, brand_details (id, brand_name, logo_url), categories (id, name, slug), product_images (id, image_url, alt_text, is_primary, display_order)`,
        { count: "exact" }
      )
      .range(offset, offset + limit - 1)
      .order(sortBy, { ascending: sortOrder === "asc" });

    if (communityProductIds !== null) {
      query = query.in("id", communityProductIds);
    }

    if (brandId) {
      query = query.eq("brand_id", brandId);
    }

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (isFeatured !== undefined) {
      query = query.eq("is_featured", isFeatured);
    }

    if (minPrice !== undefined) {
      query = query.gte("price", minPrice);
    }

    if (maxPrice !== undefined) {
      query = query.lte("price", maxPrice);
    }

    if (inStock !== undefined) {
      if (inStock) {
        query = query.gt("stock_quantity", 0);
      } else {
        query = query.eq("stock_quantity", 0);
      }
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,short_description.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to list products", { error: error.message });
      throw ApiError.internal("Failed to fetch products");
    }

    return {
      data: data?.map((row) => toProduct(row as any)) || [],
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    };
  }

  /**
   * Get product images
   */
  async getProductImages(productId: string): Promise<ProductImage[]> {
    const { data, error } = await supabaseAdmin
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("display_order", { ascending: true });

    if (error) {
      logger.error("Failed to fetch product images", {
        error: error.message,
        productId,
      });
      throw ApiError.internal("Failed to fetch product images");
    }

    return data?.map((row) => toProductImage(row as ProductImageRow)) || [];
  }

  /**
   * Get product with images
   */
  async getProductWithImages(productId: string): Promise<ProductWithImages | null> {
    const product = await this.getProduct(productId);
    if (!product) {
      return null;
    }

    const images = await this.getProductImages(productId);

    return {
      ...product,
      images,
    };
  }

  /**
   * Add product image
   */
  async addProductImage(data: CreateProductImageData): Promise<ProductImage> {
    const { productId, imageUrl, altText, isPrimary = false, displayOrder = 0 } = data;

    // If setting as primary, unset existing primary image
    if (isPrimary) {
      await supabaseAdmin
        .from("product_images")
        .update({ is_primary: false })
        .eq("product_id", productId);
    }

    const { data: imageRow, error } = await supabaseAdmin
      .from("product_images")
      .insert({
        product_id: productId,
        image_url: imageUrl,
        alt_text: altText,
        is_primary: isPrimary,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23503") {
        throw ApiError.badRequest("Invalid product ID");
      }
      logger.error("Failed to add product image", {
        error: error.message,
        data,
      });
      throw ApiError.internal("Failed to add product image");
    }

    return toProductImage(imageRow as ProductImageRow);
  }

  /**
   * Update product image
   */
  async updateProductImage(
    imageId: string,
    data: Partial<CreateProductImageData>,
  ): Promise<ProductImage> {
    const updateData: Record<string, unknown> = {};

    if (data.imageUrl !== undefined) {
      updateData.image_url = data.imageUrl;
    }
    if (data.altText !== undefined) {
      updateData.alt_text = data.altText;
    }
    if (data.isPrimary !== undefined) {
      updateData.is_primary = data.isPrimary;
    }
    if (data.displayOrder !== undefined) {
      updateData.display_order = data.displayOrder;
    }

    if (Object.keys(updateData).length === 0) {
      throw ApiError.badRequest("No fields to update");
    }

    const { data: imageRow, error } = await supabaseAdmin
      .from("product_images")
      .update(updateData)
      .eq("id", imageId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw ApiError.notFound("Product image not found");
      }
      logger.error("Failed to update product image", {
        error: error.message,
        imageId,
      });
      throw ApiError.internal("Failed to update product image");
    }

    return toProductImage(imageRow as ProductImageRow);
  }

  /**
   * Delete product image
   */
  async deleteProductImage(imageId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("product_images")
      .delete()
      .eq("id", imageId);

    if (error) {
      logger.error("Failed to delete product image", {
        error: error.message,
        imageId,
      });
      throw ApiError.internal("Failed to delete product image");
    }
  }

  /**
   * Add item to cart (upserts by user_id + product_id + selected_size)
   */
  async addToCart(
    userId: string,
    productId: string,
    quantity: number = 1,
    selectedSize?: string | null,
  ): Promise<CartItem> {
    const product = await this.getProduct(productId);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    if (product.status !== "active") {
      throw ApiError.badRequest("Product is not available");
    }
    // Only enforce stock when the product explicitly tracks it (> 0).
    // A value of 0 is treated as "not configured" to avoid blocking
    // brands that haven't set their stock yet.
    if (product.stockQuantity > 0 && product.stockQuantity < quantity) {
      throw ApiError.badRequest("Insufficient stock");
    }

    // The unique constraint is on (user_id, product_id) only — no size column.
    // Match the check to the constraint so we never race into a duplicate-key error.
    const { data: existingItem, error: existError } = await supabaseAdmin
      .from("cart_items")
      .select("*")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .maybeSingle();

    if (existError) {
      logger.error("cart_items existence check failed", { error: existError.message, userId, productId, selectedSize });
    }

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (product.stockQuantity > 0 && product.stockQuantity < newQuantity) {
        throw ApiError.badRequest("Insufficient stock");
      }

      const { data: updatedItem, error } = await supabaseAdmin
        .from("cart_items")
        .update({ quantity: newQuantity })
        .eq("id", existingItem.id)
        .select()
        .single();

      if (error) {
        logger.error("Failed to update cart item quantity", { error: error.message, code: error.code, id: existingItem.id });
        throw ApiError.internal(`Failed to update cart item: ${error.message}`);
      }

      return toCartItem(updatedItem as CartItemRow);
    }

    // Insert new row
    const { data: cartItemRow, error: insertError } = await supabaseAdmin
      .from("cart_items")
      .insert({
        user_id: userId,
        product_id: productId,
        quantity,
        selected_size: selectedSize ?? null,
      })
      .select()
      .single();

    if (insertError) {
      logger.error("Failed to insert cart item", {
        error: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        userId,
        productId,
        quantity,
        selectedSize,
      });
      throw ApiError.internal(`Failed to add to cart: ${insertError.message}`);
    }

    return toCartItem(cartItemRow as CartItemRow);
  }

  /**
   * Get user's cart items with product details
   */
  async getCartItems(userId: string): Promise<CartItemWithProduct[]> {
    // Use the column name hint (!product_id) instead of the FK constraint
    // name so this keeps working even if the constraint gets renamed in a
    // future migration.
    const { data, error } = await supabaseAdmin
      .from("cart_items")
      .select(
        `
        *,
        products!product_id (
          *,
          brand_details (id, brand_name, logo_url),
          categories (id, name, slug),
          product_images (id, image_url, alt_text, is_primary, display_order)
        )
        `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch cart items", { error: error.message, code: error.code, userId });
      throw ApiError.internal(`Failed to fetch cart items: ${error.message}`);
    }

    return (
      data?.map((row) => ({
        ...toCartItem(row as CartItemRow),
        product: row.products ? toProduct(row.products as ProductRow) : undefined,
      })).filter((item) => item.product !== undefined) || []
    );
  }

  /**
   * Update cart item quantity (matches by user + product + size)
   */
  async updateCartItemQuantity(
    userId: string,
    productId: string,
    quantity: number,
    selectedSize?: string | null,
  ): Promise<CartItem> {
    if (quantity <= 0) {
      throw ApiError.badRequest("Quantity must be greater than 0");
    }

    const product = await this.getProduct(productId);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    if (product.stockQuantity > 0 && product.stockQuantity < quantity) {
      throw ApiError.badRequest("Insufficient stock");
    }

    let query = supabaseAdmin
      .from("cart_items")
      .update({ quantity })
      .eq("user_id", userId)
      .eq("product_id", productId);

    if (selectedSize !== undefined) {
      if (selectedSize) {
        query = query.eq("selected_size", selectedSize);
      } else {
        query = query.is("selected_size", null);
      }
    }

    const { data: cartItemRow, error } = await (query as any).select().maybeSingle();

    if (error) {
      logger.error("Failed to update cart item", { error: error.message, code: error.code, userId, productId, quantity, selectedSize });
      throw ApiError.internal(`Failed to update cart item: ${error.message}`);
    }
    if (!cartItemRow) {
      throw ApiError.notFound("Cart item not found");
    }

    return toCartItem(cartItemRow as CartItemRow);
  }

  /**
   * Remove item from cart (matches by user + product, and size if provided)
   */
  async removeFromCart(userId: string, productId: string, selectedSize?: string | null): Promise<void> {
    let query = supabaseAdmin
      .from("cart_items")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);

    if (selectedSize !== undefined) {
      if (selectedSize) {
        query = query.eq("selected_size", selectedSize);
      } else {
        query = query.is("selected_size", null);
      }
    }

    const { error } = await query;

    if (error) {
      logger.error("Failed to remove from cart", { error: error.message, code: error.code, userId, productId, selectedSize });
      throw ApiError.internal(`Failed to remove from cart: ${error.message}`);
    }
  }

  /**
   * Clear user's cart
   */
  async clearCart(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("cart_items")
      .delete()
      .eq("user_id", userId);

    if (error) {
      logger.error("Failed to clear cart", {
        error: error.message,
        userId,
      });
      throw ApiError.internal("Failed to clear cart");
    }
  }
}

export const productService = new ProductService();
