import { supabaseAdmin } from "../config";
import { ApiError } from "../utils";
import { logger } from "../utils/logger";
import { logisticsService, shiprocketClient } from "./logistics.service";

// Pitch status type
export type PitchStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "shipped"
  | "delivered"
  | "posted";

// Pitch interface (camelCase for TypeScript)
export interface Pitch {
  id: string;
  brandId: string;
  productId: string;
  communityId: string;
  expertId: string;
  status: PitchStatus;
  message: string | null;
  offerDetails: string | null;
  requirements: string | null;
  expertResponse: string | null;
  respondedAt: string | null;
  shippingAddress: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  postId: string | null;
  postingDeadline: string | null;
  postedAt: string | null;
  expiresAt: string | null;
  sampleType: "KEEP_SAMPLE" | "RETURN_SAMPLE";
  createdAt: string;
  updatedAt: string;
}

// Database row interface (snake_case from Supabase)
export interface PitchRow {
  id: string;
  brand_id: string;
  product_id: string;
  community_id: string;
  expert_id: string;
  status: PitchStatus;
  message: string | null;
  offer_details: string | null;
  requirements: string | null;
  expert_response: string | null;
  responded_at: string | null;
  shipping_address: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  post_id: string | null;
  posting_deadline: string | null;
  posted_at: string | null;
  expires_at: string | null;
  sample_type: "KEEP_SAMPLE" | "RETURN_SAMPLE";
  created_at: string;
  updated_at: string;
}

// Extended pitch with related data
export interface PitchWithDetails extends Pitch {
  brand?: {
    id: string;
    brandName: string;
    logoUrl: string | null;
  };
  product?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice: number | null;
    description: string | null;
    shortDescription: string | null;
    sku: string | null;
    metadata: Record<string, any>;
    images: Array<{
      id: string;
      imageUrl: string;
      altText: string | null;
      isPrimary: boolean;
      displayOrder: number;
    }>;
    category: {
      id: string;
      name: string;
      slug: string;
    } | null;
  };
  community?: {
    id: string;
    name: string;
    slug: string;
  };
  expert?: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
}

// Helper to convert snake_case to camelCase
export function toPitch(row: PitchRow): Pitch {
  return {
    id: row.id,
    brandId: row.brand_id,
    productId: row.product_id,
    communityId: row.community_id,
    expertId: row.expert_id,
    status: row.status,
    message: row.message,
    offerDetails: row.offer_details,
    requirements: row.requirements,
    expertResponse: row.expert_response,
    respondedAt: row.responded_at,
    shippingAddress: row.shipping_address,
    trackingNumber: row.tracking_number,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    postId: row.post_id,
    postingDeadline: row.posting_deadline,
    postedAt: row.posted_at,
    expiresAt: row.expires_at,
    sampleType: row.sample_type ?? "KEEP_SAMPLE",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Internal data interfaces
interface CreatePitchData {
  brandId: string;
  productId: string;
  communityId: string;
  expertId: string;
  message?: string | null;
  offerDetails?: string | null;
  requirements?: string | null;
  postingDeadline?: string | null;
  sampleType?: "KEEP_SAMPLE" | "RETURN_SAMPLE";
}

interface UpdatePitchData {
  message?: string | null;
  offerDetails?: string | null;
  requirements?: string | null;
  postingDeadline?: string | null;
}

interface RespondToPitchData {
  status: "accepted" | "declined";
  expertResponse?: string | null;
}

class PitchService {
  /**
   * Create a new pitch (brand sends to expert)
   */
  async createPitch(data: CreatePitchData): Promise<Pitch> {
    const {
      brandId,
      productId,
      communityId,
      expertId,
      message,
      offerDetails,
      requirements,
      postingDeadline,
      sampleType = "KEEP_SAMPLE",
    } = data;

    // Validate that the product belongs to the brand
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, brand_id")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      throw ApiError.badRequest("Product not found");
    }

    if (product.brand_id !== brandId) {
      throw ApiError.forbidden("You can only pitch your own products");
    }

    // Validate that expert exists
    const { data: expertProfile, error: expertError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", expertId)
      .single();

    if (expertError || !expertProfile) {
      throw ApiError.badRequest("Expert not found");
    }

    if (expertProfile.role !== "expert") {
      throw ApiError.badRequest("Selected user is not an expert");
    }

    if (!expertProfile.is_active) {
      throw ApiError.badRequest("This expert account is not active");
    }

    // Validate community exists
    const { data: community, error: communityError } = await supabaseAdmin
      .from("communities")
      .select("id")
      .eq("id", communityId)
      .eq("is_active", true)
      .single();

    if (communityError || !community) {
      throw ApiError.badRequest("Community not found");
    }

    // Expert must be a member of the community to receive pitches for it
    const { data: expertMembership } = await supabaseAdmin
      .from("community_members")
      .select("id")
      .eq("community_id", communityId)
      .eq("user_id", expertId)
      .eq("is_expert", true)
      .maybeSingle();

    if (!expertMembership) {
      throw ApiError.badRequest("This expert is not a member of the selected community");
    }

    // Check for existing pending pitch for same product/expert combination
    const { data: existingPitch } = await supabaseAdmin
      .from("pitches")
      .select("id")
      .eq("brand_id", brandId)
      .eq("product_id", productId)
      .eq("expert_id", expertId)
      .in("status", ["pending", "accepted"])
      .single();

    if (existingPitch) {
      throw ApiError.badRequest(
        "An active pitch already exists for this product and expert"
      );
    }

    // Create the pitch
    const { data: pitchRow, error } = await supabaseAdmin
      .from("pitches")
      .insert({
        brand_id: brandId,
        product_id: productId,
        community_id: communityId,
        expert_id: expertId,
        message,
        offer_details: offerDetails,
        requirements,
        posting_deadline: postingDeadline,
        sample_type: sampleType,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create pitch", { error: error.message, data });
      throw ApiError.internal("Failed to create pitch");
    }

    return toPitch(pitchRow as PitchRow);
  }

  /**
   * Get pitch by ID
   */
  async getPitch(pitchId: string): Promise<Pitch | null> {
    const { data: pitchRow, error } = await supabaseAdmin
      .from("pitches")
      .select("*")
      .eq("id", pitchId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to fetch pitch", { error: error.message, pitchId });
      throw ApiError.internal("Failed to fetch pitch");
    }

    return toPitch(pitchRow as PitchRow);
  }

  /**
   * Get pitch with related details
   */
  async getPitchWithDetails(pitchId: string): Promise<PitchWithDetails | null> {
    const { data: row, error } = await supabaseAdmin
      .from("pitches")
      .select(
        `
        *,
        brand_details!pitches_brand_id_fkey (
          id,
          brand_name,
          logo_url
        ),
        products!pitches_product_id_fkey (
          id,
          name,
          slug,
          price,
          compare_at_price,
          description,
          short_description,
          sku,
          metadata,
          product_images (
            id,
            image_url,
            alt_text,
            is_primary,
            display_order
          ),
          categories (
            id,
            name,
            slug
          )
        ),
        communities!pitches_community_id_fkey (
          id,
          name,
          slug
        ),
        profiles!pitches_expert_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `
      )
      .eq("id", pitchId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to fetch pitch with details", {
        error: error.message,
        pitchId,
      });
      throw ApiError.internal("Failed to fetch pitch");
    }

    const pitch = toPitch(row as PitchRow);

    return {
      ...pitch,
      brand: row.brand_details
        ? {
            id: row.brand_details.id,
            brandName: row.brand_details.brand_name,
            logoUrl: row.brand_details.logo_url,
          }
        : undefined,
      product: row.products
        ? {
            id: row.products.id,
            name: row.products.name,
            slug: row.products.slug,
            price: row.products.price,
            compareAtPrice: row.products.compare_at_price ?? null,
            description: row.products.description ?? null,
            shortDescription: row.products.short_description ?? null,
            sku: row.products.sku ?? null,
            metadata: row.products.metadata ?? {},
            images: (row.products.product_images ?? [])
              .sort((a: any, b: any) => a.display_order - b.display_order)
              .map((img: any) => ({
                id: img.id,
                imageUrl: img.image_url,
                altText: img.alt_text ?? null,
                isPrimary: img.is_primary,
                displayOrder: img.display_order,
              })),
            category: row.products.categories
              ? {
                  id: row.products.categories.id,
                  name: row.products.categories.name,
                  slug: row.products.categories.slug,
                }
              : null,
          }
        : undefined,
      community: row.communities
        ? {
            id: row.communities.id,
            name: row.communities.name,
            slug: row.communities.slug,
          }
        : undefined,
      expert: row.profiles
        ? {
            id: row.profiles.id,
            fullName: row.profiles.full_name,
            avatarUrl: row.profiles.avatar_url,
          }
        : undefined,
    };
  }

  /**
   * Update pitch (brand can update before expert responds)
   */
  async updatePitch(
    pitchId: string,
    brandId: string,
    data: UpdatePitchData
  ): Promise<Pitch> {
    // Get the pitch to verify ownership and status
    const pitch = await this.getPitch(pitchId);
    if (!pitch) {
      throw ApiError.notFound("Pitch not found");
    }

    if (pitch.brandId !== brandId) {
      throw ApiError.forbidden("You can only update your own pitches");
    }

    if (pitch.status !== "pending") {
      throw ApiError.badRequest("Can only update pending pitches");
    }

    const updateData: Record<string, unknown> = {};

    if (data.message !== undefined) {
      updateData.message = data.message;
    }
    if (data.offerDetails !== undefined) {
      updateData.offer_details = data.offerDetails;
    }
    if (data.requirements !== undefined) {
      updateData.requirements = data.requirements;
    }
    if (data.postingDeadline !== undefined) {
      updateData.posting_deadline = data.postingDeadline;
    }

    if (Object.keys(updateData).length === 0) {
      throw ApiError.badRequest("No fields to update");
    }

    const { data: pitchRow, error } = await supabaseAdmin
      .from("pitches")
      .update(updateData)
      .eq("id", pitchId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update pitch", {
        error: error.message,
        pitchId,
      });
      throw ApiError.internal("Failed to update pitch");
    }

    return toPitch(pitchRow as PitchRow);
  }

  /**
   * Expert responds to pitch (accept or decline)
   */
  async respondToPitch(
    pitchId: string,
    expertId: string,
    data: RespondToPitchData
  ): Promise<Pitch> {
    const pitch = await this.getPitch(pitchId);
    if (!pitch) {
      throw ApiError.notFound("Pitch not found");
    }

    if (pitch.expertId !== expertId) {
      throw ApiError.forbidden("You can only respond to pitches sent to you");
    }

    if (pitch.status !== "pending") {
      throw ApiError.badRequest("Can only respond to pending pitches");
    }

    // Check if pitch has expired
    if (pitch.expiresAt && new Date(pitch.expiresAt) < new Date()) {
      throw ApiError.badRequest("This pitch has expired");
    }

    const { data: pitchRow, error } = await supabaseAdmin
      .from("pitches")
      .update({
        status: data.status,
        expert_response: data.expertResponse,
        responded_at: new Date().toISOString(),
      })
      .eq("id", pitchId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to respond to pitch", {
        error: error.message,
        pitchId,
      });
      throw ApiError.internal("Failed to respond to pitch");
    }

    const updatedPitch = toPitch(pitchRow as PitchRow);

    // When expert accepts: auto-create sample shipment (BRAND → EXPERT)
    // Platform pays all sample logistics — stored internally, no external charge
    if (data.status === "accepted") {
      (async () => {
        const [{ data: brandAddrRow }, { data: expertAddrRow }] = await Promise.all([
          supabaseAdmin
            .from("addresses")
            .select("full_name, phone_number, address_line1, address_line2, city, state, postal_code, country")
            .eq("user_id", updatedPitch.brandId)
            .eq("is_default_shipping", true)
            .maybeSingle(),
          supabaseAdmin
            .from("addresses")
            .select("full_name, phone_number, address_line1, address_line2, city, state, postal_code, country")
            .eq("user_id", updatedPitch.expertId)
            .eq("is_default_shipping", true)
            .maybeSingle(),
        ]);

        const fromAddress = brandAddrRow
          ? {
              name: (brandAddrRow as any).full_name,
              phone: (brandAddrRow as any).phone_number,
              line1: (brandAddrRow as any).address_line1,
              line2: (brandAddrRow as any).address_line2 ?? "",
              city: (brandAddrRow as any).city,
              state: (brandAddrRow as any).state,
              postalCode: (brandAddrRow as any).postal_code,
              country: (brandAddrRow as any).country,
            }
          : { note: "Brand warehouse — to be filled by logistics" };

        const toAddress = expertAddrRow
          ? {
              name: (expertAddrRow as any).full_name,
              phone: (expertAddrRow as any).phone_number,
              line1: (expertAddrRow as any).address_line1,
              line2: (expertAddrRow as any).address_line2 ?? "",
              city: (expertAddrRow as any).city,
              state: (expertAddrRow as any).state,
              postalCode: (expertAddrRow as any).postal_code,
              country: (expertAddrRow as any).country,
            }
          : { address: updatedPitch.shippingAddress ?? "Expert address on file" };

        const pickupLocation = await shiprocketClient.getBrandPickupLocation(updatedPitch.brandId);

        logger.info("Sample shipment data", {
          pitchId,
          pickupLocation,
          hasBrandAddress: !!brandAddrRow,
          hasExpertAddress: !!expertAddrRow,
          fromAddress,
          toAddress,
        });

        return logisticsService.createSampleShipment({ pitchId, fromAddress, toAddress, pickupLocation });
      })()
        .then((shipment) => {
          logger.info("Sample shipment created on pitch acceptance", {
            pitchId,
            trackingId: shipment.trackingId,
            sampleType: updatedPitch.sampleType,
          });

          // If RETURN_SAMPLE: mark shipment so return can be triggered after delivery
          // The actual return shipment is created when shipment status → DELIVERED
          // (handled via logistics.updateShipmentStatus in a future webhook/admin action)
        })
        .catch((err) =>
          logger.error("Sample shipment creation failed on pitch acceptance", { pitchId, err })
        );
    }

    return updatedPitch;
  }

  /**
   * Link a post to a pitch (called when expert creates post for a pitch)
   */
  async linkPostToPitch(
    pitchId: string,
    postId: string,
    expertId: string
  ): Promise<Pitch> {
    const pitch = await this.getPitch(pitchId);
    if (!pitch) {
      throw ApiError.notFound("Pitch not found");
    }

    if (pitch.expertId !== expertId) {
      throw ApiError.forbidden("You can only link posts to your own pitches");
    }

    if (pitch.status !== "accepted") {
      throw ApiError.badRequest("Can only link posts to accepted pitches");
    }

    const { data: pitchRow, error } = await supabaseAdmin
      .from("pitches")
      .update({
        post_id: postId,
        posted_at: new Date().toISOString(),
        status: "posted",
      })
      .eq("id", pitchId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to link post to pitch", {
        error: error.message,
        pitchId,
        postId,
      });
      throw ApiError.internal("Failed to link post to pitch");
    }

    return toPitch(pitchRow as PitchRow);
  }

  /**
   * Delete pitch (brand can delete pending pitches)
   */
  async deletePitch(pitchId: string, brandId: string): Promise<void> {
    const pitch = await this.getPitch(pitchId);
    if (!pitch) {
      throw ApiError.notFound("Pitch not found");
    }

    if (pitch.brandId !== brandId) {
      throw ApiError.forbidden("You can only delete your own pitches");
    }

    if (pitch.status !== "pending") {
      throw ApiError.badRequest("Can only delete pending pitches");
    }

    const { error } = await supabaseAdmin
      .from("pitches")
      .delete()
      .eq("id", pitchId);

    if (error) {
      logger.error("Failed to delete pitch", {
        error: error.message,
        pitchId,
      });
      throw ApiError.internal("Failed to delete pitch");
    }
  }

  /**
   * List pitches for a brand (sent pitches)
   */
  async listBrandPitches(
    brandId: string,
    options: {
      status?: PitchStatus;
      productId?: string;
      communityId?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {}
  ) {
    const {
      status,
      productId,
      communityId,
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "desc",
    } = options;

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("pitches")
      .select(
        `
        *,
        products!pitches_product_id_fkey (id, name, slug, price),
        communities!pitches_community_id_fkey (id, name, slug),
        profiles!pitches_expert_id_fkey (id, full_name, avatar_url)
      `,
        { count: "exact" }
      )
      .eq("brand_id", brandId)
      .range(offset, offset + limit - 1)
      .order(sortBy, { ascending: sortOrder === "asc" });

    if (status) {
      query = query.eq("status", status);
    }
    if (productId) {
      query = query.eq("product_id", productId);
    }
    if (communityId) {
      query = query.eq("community_id", communityId);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to list brand pitches", { error: error.message });
      throw ApiError.internal("Failed to fetch pitches");
    }

    const pitches = data?.map((row) => {
      const pitch = toPitch(row as PitchRow);
      return {
        ...pitch,
        product: row.products
          ? {
              id: row.products.id,
              name: row.products.name,
              slug: row.products.slug,
              price: row.products.price,
            }
          : undefined,
        community: row.communities
          ? {
              id: row.communities.id,
              name: row.communities.name,
              slug: row.communities.slug,
            }
          : undefined,
        expert: row.profiles
          ? {
              id: row.profiles.id,
              fullName: row.profiles.full_name,
              avatarUrl: row.profiles.avatar_url,
            }
          : undefined,
      };
    });

    return {
      data: pitches || [],
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    };
  }

  /**
   * List pitches for an expert (received pitches)
   */
  async listExpertPitches(
    expertId: string,
    options: {
      status?: PitchStatus;
      communityId?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {}
  ) {
    const {
      status,
      communityId,
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "desc",
    } = options;

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("pitches")
      .select(
        `
        *,
        brand_details!pitches_brand_id_fkey (id, brand_name, logo_url),
        products!pitches_product_id_fkey (id, name, slug, price),
        communities!pitches_community_id_fkey (id, name, slug)
      `,
        { count: "exact" }
      )
      .eq("expert_id", expertId)
      .range(offset, offset + limit - 1)
      .order(sortBy, { ascending: sortOrder === "asc" });

    if (status) {
      query = query.eq("status", status);
    }
    if (communityId) {
      query = query.eq("community_id", communityId);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to list expert pitches", { error: error.message });
      throw ApiError.internal("Failed to fetch pitches");
    }

    const pitches = data?.map((row) => {
      const pitch = toPitch(row as PitchRow);
      return {
        ...pitch,
        brand: row.brand_details
          ? {
              id: row.brand_details.id,
              brandName: row.brand_details.brand_name,
              logoUrl: row.brand_details.logo_url,
            }
          : undefined,
        product: row.products
          ? {
              id: row.products.id,
              name: row.products.name,
              slug: row.products.slug,
              price: row.products.price,
            }
          : undefined,
        community: row.communities
          ? {
              id: row.communities.id,
              name: row.communities.name,
              slug: row.communities.slug,
            }
          : undefined,
      };
    });

    return {
      data: pitches || [],
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    };
  }
}

export const pitchService = new PitchService();
