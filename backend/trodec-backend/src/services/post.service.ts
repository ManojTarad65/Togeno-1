import { supabaseAdmin } from "../config";
import { ApiError } from "../utils";
import { logger } from "../utils/logger";
import { pitchService } from "./pitch.service";

// Post interface (camelCase for TypeScript)
export interface Post {
  id: string;
  expertId: string;
  productId: string;
  communityId: string;
  pitchId: string | null;
  title: string | null;
  content: string;
  rating: number;
  likesCount: number;
  commentsCount: number;
  pros: string[] | null;
  cons: string[] | null;
  verdict: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Database row interface (snake_case from Supabase)
export interface PostRow {
  id: string;
  expert_id: string;
  product_id: string;
  community_id: string;
  pitch_id: string | null;
  title: string | null;
  content: string;
  rating: number;
  likes_count: number;
  comments_count: number;
  pros: string[] | null;
  cons: string[] | null;
  verdict: string | null;
  is_featured: boolean;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

// Post media interface
export interface PostMedia {
  id: string;
  postId: string;
  mediaUrl: string;
  mediaType: string;
  altText: string | null;
  displayOrder: number;
  createdAt: string;
}

export interface PostMediaRow {
  id: string;
  post_id: string;
  media_url: string;
  media_type: string;
  alt_text: string | null;
  display_order: number;
  created_at: string;
}

// Post like interface
export interface PostLike {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
}

export interface PostLikeRow {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

// Extended post with related data
export interface PostWithDetails extends Post {
  expert?: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  product?: {
    id: string;
    name: string;
    slug: string;
    price: number;
  };
  community?: {
    id: string;
    name: string;
    slug: string;
  };
  media?: PostMedia[];
  hasLiked?: boolean; // For authenticated users
}

// Helper to convert snake_case to camelCase
export function toPost(row: PostRow): Post {
  return {
    id: row.id,
    expertId: row.expert_id,
    productId: row.product_id,
    communityId: row.community_id,
    pitchId: row.pitch_id,
    title: row.title,
    content: row.content,
    rating: Number(row.rating),
    likesCount: row.likes_count,
    commentsCount: row.comments_count,
    pros: row.pros,
    cons: row.cons,
    verdict: row.verdict,
    isFeatured: row.is_featured,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPostMedia(row: PostMediaRow): PostMedia {
  return {
    id: row.id,
    postId: row.post_id,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    altText: row.alt_text,
    displayOrder: row.display_order,
    createdAt: row.created_at,
  };
}

export function toPostLike(row: PostLikeRow): PostLike {
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

// Internal data interfaces
interface CreatePostData {
  expertId: string;
  productId: string;
  communityId: string;
  pitchId?: string | null;
  title?: string | null;
  content: string;
  rating: number;
  pros?: string[] | null;
  cons?: string[] | null;
  verdict?: string | null;
  isPublished?: boolean;
}

interface UpdatePostData {
  title?: string | null;
  content?: string;
  rating?: number;
  pros?: string[] | null;
  cons?: string[] | null;
  verdict?: string | null;
  isPublished?: boolean;
}

interface CreatePostMediaData {
  postId: string;
  mediaUrl: string;
  mediaType?: string;
  altText?: string | null;
  displayOrder?: number;
}

class PostService {
  /**
   * Check if user is a verified expert
   */
  private async isVerifiedExpert(userId: string): Promise<boolean> {
    const { data: expertDetails, error } = await supabaseAdmin
      .from("expert_details")
      .select("id, is_verified")
      .eq("id", userId)
      .single();

    if (error || !expertDetails) {
      return false;
    }

    return expertDetails.is_verified === true;
  }

  /**
   * Create a new post (verified expert only)
   */
  async createPost(data: CreatePostData): Promise<Post> {
    const {
      expertId,
      productId,
      communityId,
      pitchId,
      title,
      content,
      rating,
      pros,
      cons,
      verdict,
      isPublished = true,
    } = data;

    // Verify expert is verified
    const isVerified = await this.isVerifiedExpert(expertId);
    if (!isVerified) {
      throw ApiError.forbidden("Only verified experts can create posts");
    }

    // Validate product exists
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      throw ApiError.badRequest("Product not found");
    }

    // Validate community exists AND expert is a member
    const { data: community, error: communityError } = await supabaseAdmin
      .from("communities")
      .select("id")
      .eq("id", communityId)
      .single();

    if (communityError || !community) {
      throw ApiError.badRequest("Community not found");
    }

    // Expert must be a member of the community to post in it
    const { data: membership } = await supabaseAdmin
      .from("community_members")
      .select("id")
      .eq("community_id", communityId)
      .eq("user_id", expertId)
      .maybeSingle();

    if (!membership) {
      throw ApiError.forbidden("You must be a member of this community to post in it");
    }

    // If pitchId is provided, validate it belongs to the expert and is accepted
    if (pitchId) {
      const pitch = await pitchService.getPitch(pitchId);
      if (!pitch) {
        throw ApiError.badRequest("Pitch not found");
      }
      if (pitch.expertId !== expertId) {
        throw ApiError.forbidden("This pitch was not sent to you");
      }
      if (pitch.status !== "delivered") {
        throw ApiError.badRequest("You can only publish a review after confirming product receipt");
      }
      if (pitch.postId) {
        throw ApiError.badRequest("A post already exists for this pitch");
      }
    }

    // Create the post
    const { data: postRow, error } = await supabaseAdmin
      .from("posts")
      .insert({
        expert_id: expertId,
        product_id: productId,
        community_id: communityId,
        pitch_id: pitchId,
        title,
        content,
        rating,
        pros,
        cons,
        verdict,
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create post", { error: error.message, data });
      throw ApiError.internal("Failed to create post");
    }

    const post = toPost(postRow as PostRow);

    // If post is linked to a pitch, update the pitch status to "posted"
    if (pitchId) {
      try {
        await pitchService.linkPostToPitch(pitchId, post.id, expertId);
      } catch (linkError) {
        logger.warn("Failed to link post to pitch", {
          error: linkError,
          pitchId,
          postId: post.id,
        });
        // Don't fail the post creation, just log the warning
      }
    }

    return post;
  }

  /**
   * Get post by ID
   */
  async getPost(postId: string): Promise<Post | null> {
    const { data: postRow, error } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to fetch post", { error: error.message, postId });
      throw ApiError.internal("Failed to fetch post");
    }

    return toPost(postRow as PostRow);
  }

  /**
   * Get post with related details
   */
  async getPostWithDetails(
    postId: string,
    currentUserId?: string
  ): Promise<PostWithDetails | null> {
    const { data: row, error } = await supabaseAdmin
      .from("posts")
      .select(
        `
        *,
        profiles!posts_expert_id_fkey (
          id,
          full_name,
          avatar_url
        ),
        products!posts_product_id_fkey (
          id,
          name,
          slug,
          price
        ),
        communities!posts_community_id_fkey (
          id,
          name,
          slug
        ),
        post_media (
          id,
          media_url,
          media_type,
          alt_text,
          display_order,
          created_at
        )
      `
      )
      .eq("id", postId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      logger.error("Failed to fetch post with details", {
        error: error.message,
        postId,
      });
      throw ApiError.internal("Failed to fetch post");
    }

    const post = toPost(row as PostRow);

    // Check if current user has liked this post
    let hasLiked = false;
    if (currentUserId) {
      const { data: like } = await supabaseAdmin
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", currentUserId)
        .single();
      hasLiked = !!like;
    }

    // Sort media by display order
    const media =
      row.post_media
        ?.sort(
          (a: PostMediaRow, b: PostMediaRow) => a.display_order - b.display_order
        )
        .map((m: PostMediaRow) => toPostMedia(m)) || [];

    return {
      ...post,
      expert: row.profiles
        ? {
            id: row.profiles.id,
            fullName: row.profiles.full_name,
            avatarUrl: row.profiles.avatar_url,
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
      media,
      hasLiked,
    };
  }

  /**
   * Update post (expert owner only)
   */
  async updatePost(
    postId: string,
    expertId: string,
    data: UpdatePostData
  ): Promise<Post> {
    const post = await this.getPost(postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    if (post.expertId !== expertId) {
      throw ApiError.forbidden("You can only update your own posts");
    }

    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.content !== undefined) {
      updateData.content = data.content;
    }
    if (data.rating !== undefined) {
      updateData.rating = data.rating;
    }
    if (data.pros !== undefined) {
      updateData.pros = data.pros;
    }
    if (data.cons !== undefined) {
      updateData.cons = data.cons;
    }
    if (data.verdict !== undefined) {
      updateData.verdict = data.verdict;
    }
    if (data.isPublished !== undefined) {
      updateData.is_published = data.isPublished;
      // Set published_at when first published
      if (data.isPublished && !post.publishedAt) {
        updateData.published_at = new Date().toISOString();
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw ApiError.badRequest("No fields to update");
    }

    const { data: postRow, error } = await supabaseAdmin
      .from("posts")
      .update(updateData)
      .eq("id", postId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update post", { error: error.message, postId });
      throw ApiError.internal("Failed to update post");
    }

    return toPost(postRow as PostRow);
  }

  /**
   * Delete post (expert owner only)
   */
  async deletePost(postId: string, expertId: string): Promise<void> {
    const post = await this.getPost(postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    if (post.expertId !== expertId) {
      throw ApiError.forbidden("You can only delete your own posts");
    }

    const { error } = await supabaseAdmin
      .from("posts")
      .delete()
      .eq("id", postId);

    if (error) {
      logger.error("Failed to delete post", { error: error.message, postId });
      throw ApiError.internal("Failed to delete post");
    }
  }

  /**
   * List posts with pagination and filtering
   */
  async listPosts(
    options: {
      expertId?: string;
      productId?: string;
      communityId?: string;
      isPublished?: boolean;
      isFeatured?: boolean;
      minRating?: number;
      maxRating?: number;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {},
    currentUserId?: string
  ) {
    const {
      expertId,
      productId,
      communityId,
      isPublished,
      isFeatured,
      minRating,
      maxRating,
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "desc",
    } = options;

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("posts")
      .select(
        `
        *,
        profiles!posts_expert_id_fkey (id, full_name, avatar_url),
        products!posts_product_id_fkey (id, name, slug, price),
        communities!posts_community_id_fkey (id, name, slug),
        post_media (id, media_url, media_type, alt_text, display_order, created_at)
      `,
        { count: "exact" }
      )
      .range(offset, offset + limit - 1)
      .order(sortBy, { ascending: sortOrder === "asc" });

    // Default to published posts only (unless specific filter applied)
    // Exception: when fetching a specific expert's own posts, allow all visibility states
    const isOwnerQuery = expertId && currentUserId && expertId === currentUserId;
    if (isPublished !== undefined) {
      query = query.eq("is_published", isPublished);
    } else if (!isOwnerQuery) {
      query = query.eq("is_published", true);
    }

    if (expertId) {
      query = query.eq("expert_id", expertId);
    }
    if (productId) {
      query = query.eq("product_id", productId);
    }
    if (communityId) {
      query = query.eq("community_id", communityId);
    }
    if (isFeatured !== undefined) {
      query = query.eq("is_featured", isFeatured);
    }
    if (minRating !== undefined) {
      query = query.gte("rating", minRating);
    }
    if (maxRating !== undefined) {
      query = query.lte("rating", maxRating);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error("Failed to list posts", { error: error.message });
      throw ApiError.internal("Failed to fetch posts");
    }

    // Get user's likes if authenticated
    let userLikes: Set<string> = new Set();
    if (currentUserId && data && data.length > 0) {
      const postIds = data.map((p) => p.id);
      const { data: likes } = await supabaseAdmin
        .from("post_likes")
        .select("post_id")
        .eq("user_id", currentUserId)
        .in("post_id", postIds);
      userLikes = new Set(likes?.map((l) => l.post_id) || []);
    }

    const posts = data?.map((row) => {
      const post = toPost(row as PostRow);
      const media =
        row.post_media
          ?.sort(
            (a: PostMediaRow, b: PostMediaRow) =>
              a.display_order - b.display_order
          )
          .map((m: PostMediaRow) => toPostMedia(m)) || [];

      return {
        ...post,
        expert: row.profiles
          ? {
              id: row.profiles.id,
              fullName: row.profiles.full_name,
              avatarUrl: row.profiles.avatar_url,
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
        media,
        hasLiked: userLikes.has(post.id),
      };
    });

    return {
      data: posts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    };
  }

  /**
   * List posts by expert (for expert's own dashboard)
   */
  async listExpertPosts(
    expertId: string,
    options: {
      isPublished?: boolean;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {}
  ) {
    return this.listPosts(
      {
        ...options,
        expertId,
        // Expert can see their own unpublished posts
        isPublished: options.isPublished,
      },
      expertId
    );
  }

  // ============================================
  // POST MEDIA OPERATIONS
  // ============================================

  /**
   * Get post media
   */
  async getPostMedia(postId: string): Promise<PostMedia[]> {
    const { data, error } = await supabaseAdmin
      .from("post_media")
      .select("*")
      .eq("post_id", postId)
      .order("display_order", { ascending: true });

    if (error) {
      logger.error("Failed to fetch post media", {
        error: error.message,
        postId,
      });
      throw ApiError.internal("Failed to fetch post media");
    }

    return data?.map((row) => toPostMedia(row as PostMediaRow)) || [];
  }

  /**
   * Add media to post (expert owner only)
   */
  async addPostMedia(
    data: CreatePostMediaData,
    expertId: string
  ): Promise<PostMedia> {
    const { postId, mediaUrl, mediaType = "image", altText, displayOrder = 0 } = data;

    // Verify post ownership
    const post = await this.getPost(postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }
    if (post.expertId !== expertId) {
      throw ApiError.forbidden("You can only add media to your own posts");
    }

    const { data: mediaRow, error } = await supabaseAdmin
      .from("post_media")
      .insert({
        post_id: postId,
        media_url: mediaUrl,
        media_type: mediaType,
        alt_text: altText,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to add post media", { error: error.message, data });
      throw ApiError.internal("Failed to add post media");
    }

    return toPostMedia(mediaRow as PostMediaRow);
  }

  /**
   * Update post media (expert owner only)
   */
  async updatePostMedia(
    mediaId: string,
    expertId: string,
    data: Partial<CreatePostMediaData>
  ): Promise<PostMedia> {
    // Get media and verify ownership
    const { data: existingMedia, error: fetchError } = await supabaseAdmin
      .from("post_media")
      .select("*, posts!post_media_post_id_fkey(expert_id)")
      .eq("id", mediaId)
      .single();

    if (fetchError || !existingMedia) {
      throw ApiError.notFound("Post media not found");
    }

    if (existingMedia.posts?.expert_id !== expertId) {
      throw ApiError.forbidden("You can only update media on your own posts");
    }

    const updateData: Record<string, unknown> = {};
    if (data.mediaUrl !== undefined) {
      updateData.media_url = data.mediaUrl;
    }
    if (data.mediaType !== undefined) {
      updateData.media_type = data.mediaType;
    }
    if (data.altText !== undefined) {
      updateData.alt_text = data.altText;
    }
    if (data.displayOrder !== undefined) {
      updateData.display_order = data.displayOrder;
    }

    if (Object.keys(updateData).length === 0) {
      throw ApiError.badRequest("No fields to update");
    }

    const { data: mediaRow, error } = await supabaseAdmin
      .from("post_media")
      .update(updateData)
      .eq("id", mediaId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update post media", {
        error: error.message,
        mediaId,
      });
      throw ApiError.internal("Failed to update post media");
    }

    return toPostMedia(mediaRow as PostMediaRow);
  }

  /**
   * Delete post media (expert owner only)
   */
  async deletePostMedia(mediaId: string, expertId: string): Promise<void> {
    // Get media and verify ownership
    const { data: existingMedia, error: fetchError } = await supabaseAdmin
      .from("post_media")
      .select("*, posts!post_media_post_id_fkey(expert_id)")
      .eq("id", mediaId)
      .single();

    if (fetchError || !existingMedia) {
      throw ApiError.notFound("Post media not found");
    }

    if (existingMedia.posts?.expert_id !== expertId) {
      throw ApiError.forbidden("You can only delete media on your own posts");
    }

    const { error } = await supabaseAdmin
      .from("post_media")
      .delete()
      .eq("id", mediaId);

    if (error) {
      logger.error("Failed to delete post media", {
        error: error.message,
        mediaId,
      });
      throw ApiError.internal("Failed to delete post media");
    }
  }

  // ============================================
  // LIKE OPERATIONS
  // ============================================

  /**
   * Like a post (authenticated users only)
   */
  async likePost(postId: string, userId: string): Promise<PostLike> {
    // Check if post exists and is published
    const post = await this.getPost(postId);
    if (!post) {
      throw ApiError.notFound("Post not found");
    }
    if (!post.isPublished) {
      throw ApiError.badRequest("Cannot like unpublished posts");
    }

    // Check if already liked
    const { data: existingLike } = await supabaseAdmin
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .single();

    if (existingLike) {
      throw ApiError.badRequest("You have already liked this post");
    }

    const { data: likeRow, error } = await supabaseAdmin
      .from("post_likes")
      .insert({
        post_id: postId,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // Unique violation - already liked
        throw ApiError.badRequest("You have already liked this post");
      }
      logger.error("Failed to like post", {
        error: error.message,
        postId,
        userId,
      });
      throw ApiError.internal("Failed to like post");
    }

    return toPostLike(likeRow as PostLikeRow);
  }

  /**
   * Unlike a post (authenticated users only)
   */
  async unlikePost(postId: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);

    if (error) {
      logger.error("Failed to unlike post", {
        error: error.message,
        postId,
        userId,
      });
      throw ApiError.internal("Failed to unlike post");
    }
  }

  /**
   * Check if user has liked a post
   */
  async hasUserLikedPost(postId: string, userId: string): Promise<boolean> {
    const { data: like } = await supabaseAdmin
      .from("post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .single();

    return !!like;
  }

  /**
   * Get post likes count
   */
  async getPostLikesCount(postId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from("post_likes")
      .select("id", { count: "exact", head: true })
      .eq("post_id", postId);

    if (error) {
      logger.error("Failed to get likes count", {
        error: error.message,
        postId,
      });
      return 0;
    }

    return count || 0;
  }
}

export const postService = new PostService();
