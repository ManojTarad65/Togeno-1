import { supabaseAdmin } from "@/config/supabase";
import { ApiError } from "@/utils/errors";
import { logger } from "@/utils/logger";
import {
  Profile,
  ProfileRow,
  ExpertDetails,
  ExpertDetailsRow,
  BrandDetails,
  BrandDetailsRow,
  UserRole,
  toProfile,
  toExpertDetails,
  toBrandDetails,
  UserWithProfile,
  AuthUser,
} from "@/types";
import {
  UpdateProfileInput,
  UpdateExpertDetailsInput,
  UpdateBrandDetailsInput,
} from "@/schemas";

interface CreateProfileData {
  userId: string;
  email: string;
  role: UserRole;
  fullName?: string;
  // Expert fields
  expertise?: string[];
  linkedinUrl?: string;
  // Brand fields
  brandName?: string;
}

class UserService {
  /**
   * Create a new user profile after registration
   */
  async createProfile(data: CreateProfileData): Promise<Profile> {
    const { userId, email, role, fullName } = data;

    // Create base profile
    const { data: profileRow, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        email,
        role,
        full_name: fullName || null,
        is_active: true,
      })
      .select()
      .single();

    if (profileError) {
      logger.error("Failed to create profile", {
        error: profileError.message,
        userId,
      });
      throw ApiError.internal("Failed to create user profile");
    }

    // Create role-specific details
    if (role === "expert") {
      const { error: expertError } = await supabaseAdmin
        .from("expert_details")
        .insert({
          id: userId,
          expertise: data.expertise || [],
          linkedin_url: data.linkedinUrl || null,
        });

      if (expertError) {
        logger.error("Failed to create expert details", {
          error: expertError.message,
          userId,
        });
        // Rollback profile creation
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
        throw ApiError.internal("Failed to create expert profile");
      }
    } else if (role === "brand_admin") {
      const { error: brandError } = await supabaseAdmin
        .from("brand_details")
        .insert({
          id: userId,
          brand_name: data.brandName || "Unnamed Brand",
        });

      if (brandError) {
        logger.error("Failed to create brand details", {
          error: brandError.message,
          userId,
        });
        // Rollback profile creation
        await supabaseAdmin.from("profiles").delete().eq("id", userId);
        throw ApiError.internal("Failed to create brand profile");
      }
    }

    return toProfile(profileRow as ProfileRow);
  }

  /**
   * Get profile by user ID
   */
  async getProfile(userId: string): Promise<Profile | null> {
    const { data: profileRow, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to fetch profile", { error: error.message, userId });
      throw ApiError.internal("Failed to fetch profile");
    }

    return toProfile(profileRow as ProfileRow);
  }

  /**
   * Get user with profile and role-specific details
   */
  async getUserWithProfile(user: AuthUser): Promise<UserWithProfile> {
    const profile = await this.getProfile(user.id);

    const result: UserWithProfile = {
      ...user,
      profile,
    };

    if (profile?.role === "expert") {
      result.expertDetails = await this.getExpertDetails(user.id);
    } else if (profile?.role === "brand_admin") {
      result.brandDetails = await this.getBrandDetails(user.id);
    }

    return result;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: UpdateProfileInput,
  ): Promise<Profile> {
    const updateData: Record<string, unknown> = {};

    if (data.fullName !== undefined) {
      updateData.full_name = data.fullName;
    }
    if (data.avatarUrl !== undefined) {
      updateData.avatar_url = data.avatarUrl;
    }

    if (Object.keys(updateData).length === 0) {
      throw ApiError.badRequest("No fields to update");
    }

    const { data: profileRow, error } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw ApiError.notFound("Profile not found");
      }
      logger.error("Failed to update profile", {
        error: error.message,
        userId,
      });
      throw ApiError.internal("Failed to update profile");
    }

    return toProfile(profileRow as ProfileRow);
  }

  /**
   * Get expert details
   */
  async getExpertDetails(userId: string): Promise<ExpertDetails | null> {
    const { data: expertRow, error } = await supabaseAdmin
      .from("expert_details")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to fetch expert details", {
        error: error.message,
        userId,
      });
      throw ApiError.internal("Failed to fetch expert details");
    }

    return toExpertDetails(expertRow as ExpertDetailsRow);
  }

  /**
   * Update expert details
   */
  async updateExpertDetails(
    userId: string,
    data: UpdateExpertDetailsInput,
  ): Promise<ExpertDetails> {
    const updateData: Record<string, unknown> = {};

    if (data.expertise !== undefined) {
      updateData.expertise = data.expertise;
    }
    if (data.linkedinUrl !== undefined) {
      updateData.linkedin_url = data.linkedinUrl;
    }
    if (data.bio !== undefined) {
      updateData.bio = data.bio;
    }
    if (data.yearsOfExperience !== undefined) {
      updateData.years_of_experience = data.yearsOfExperience;
    }
    if (data.clothingSizes !== undefined) {
      updateData.clothing_sizes = data.clothingSizes;
    }

    if (Object.keys(updateData).length === 0) {
      throw ApiError.badRequest("No fields to update");
    }

    const { data: expertRow, error } = await supabaseAdmin
      .from("expert_details")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw ApiError.notFound("Expert details not found");
      }
      logger.error("Failed to update expert details", {
        error: error.message,
        userId,
      });
      throw ApiError.internal("Failed to update expert details");
    }

    return toExpertDetails(expertRow as ExpertDetailsRow);
  }

  /**
   * Get brand details
   */
  async getBrandDetails(userId: string): Promise<BrandDetails | null> {
    const { data: brandRow, error } = await supabaseAdmin
      .from("brand_details")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to fetch brand details", {
        error: error.message,
        userId,
      });
      throw ApiError.internal("Failed to fetch brand details");
    }

    return toBrandDetails(brandRow as BrandDetailsRow);
  }

  /**
   * Update brand details
   */
  async updateBrandDetails(
    userId: string,
    data: UpdateBrandDetailsInput,
  ): Promise<BrandDetails> {
    const updateData: Record<string, unknown> = {};

    if (data.brandName !== undefined) {
      updateData.brand_name = data.brandName;
    }
    if (data.businessType !== undefined) {
      updateData.business_type = data.businessType;
    }
    if (data.websiteUrl !== undefined) {
      updateData.website_url = data.websiteUrl;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.logoUrl !== undefined) {
      updateData.logo_url = data.logoUrl;
    }

    if (Object.keys(updateData).length === 0) {
      throw ApiError.badRequest("No fields to update");
    }

    const { data: brandRow, error } = await supabaseAdmin
      .from("brand_details")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw ApiError.notFound("Brand details not found");
      }
      logger.error("Failed to update brand details", {
        error: error.message,
        userId,
      });
      throw ApiError.internal("Failed to update brand details");
    }

    return toBrandDetails(brandRow as BrandDetailsRow);
  }

  /**
   * List experts (public endpoint)
   */
  async listExperts(
    options: { verified?: boolean; page?: number; limit?: number } = {},
  ) {
    const { verified, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("profiles")
      .select(
        `
        *,
        expert_details (*)
      `,
      )
      .eq("role", "expert")
      .eq("is_active", true)
      .range(offset, offset + limit - 1);

    if (verified !== undefined) {
      query = query.eq("expert_details.is_verified", verified);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to list experts", { error: error.message });
      throw ApiError.internal("Failed to fetch experts");
    }

    return {
      data:
        data?.map((row) => ({
          profile: toProfile(row as ProfileRow),
          expertDetails: row.expert_details
            ? toExpertDetails(row.expert_details as ExpertDetailsRow)
            : null,
        })) || [],
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    };
  }

  /**
   * List brands (public endpoint)
   */
  async listBrands(
    options: { verified?: boolean; page?: number; limit?: number } = {},
  ) {
    const { verified, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("profiles")
      .select(
        `
        *,
        brand_details (*)
      `,
      )
      .eq("role", "brand")
      .eq("is_active", true)
      .range(offset, offset + limit - 1);

    if (verified !== undefined) {
      query = query.eq("brand_details.is_verified", verified);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to list brands", { error: error.message });
      throw ApiError.internal("Failed to fetch brands");
    }

    return {
      data:
        data?.map((row) => ({
          profile: toProfile(row as ProfileRow),
          brandDetails: row.brand_details
            ? toBrandDetails(row.brand_details as BrandDetailsRow)
            : null,
        })) || [],
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    };
  }
}

export const userService = new UserService();
