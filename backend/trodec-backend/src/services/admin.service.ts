import { supabaseAdmin } from '@/config/supabase';
import { ApiError } from '@/utils/errors';
import { logger } from '@/utils/logger';

export interface AdminStats {
  users: {
    total: number;
    consumers: number;
    experts: number;
    brands: number;
    admins: number;
    pendingExpertApprovals: number;
    pendingBrandApprovals: number;
  };
  products: {
    total: number;
    active: number;
    draft: number;
  };
  orders: {
    total: number;
    totalRevenue: number;
    pending: number;
    delivered: number;
  };
  communities: {
    total: number;
    active: number;
  };
  posts: {
    total: number;
    published: number;
  };
  pitches: {
    total: number;
    pending: number;
    accepted: number;
  };
}

class AdminService {
  async approveUser(userId: string, role: 'expert' | 'brand_admin'): Promise<void> {
    const table = role === 'expert' ? 'expert_details' : 'brand_details';
    const { data, error } = await supabaseAdmin
      .from(table)
      .update({
        is_verified: true,
        verification_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id');

    if (error) {
      logger.error(`Failed to approve ${role}`, { error: error.message, userId });
      throw ApiError.internal(`Failed to approve ${role}`);
    }

    if (!data || data.length === 0) {
      logger.error(`No ${role} details row found to approve`, { userId });
      throw ApiError.notFound(`${role === 'expert' ? 'Expert' : 'Brand'} details not found. The user may not have completed registration.`);
    }
  }

  async rejectUser(userId: string, role: 'expert' | 'brand_admin'): Promise<void> {
    const table = role === 'expert' ? 'expert_details' : 'brand_details';
    const { data, error } = await supabaseAdmin
      .from(table)
      .update({
        is_verified: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id');

    if (error) {
      logger.error(`Failed to reject ${role}`, { error: error.message, userId });
      throw ApiError.internal(`Failed to reject ${role}`);
    }

    if (!data || data.length === 0) {
      logger.error(`No ${role} details row found to reject`, { userId });
      throw ApiError.notFound(`${role === 'expert' ? 'Expert' : 'Brand'} details not found. The user may not have completed registration.`);
    }
  }

  async getStats(): Promise<AdminStats> {
    const [
      consumersRes,
      expertsRes,
      brandsRes,
      adminsRes,
      pendingExpertsRes,
      pendingBrandsRes,
      productsRes,
      activeProductsRes,
      draftProductsRes,
      ordersRes,
      pendingOrdersRes,
      deliveredOrdersRes,
      communitiesRes,
      activeCommunitiesRes,
      postsRes,
      publishedPostsRes,
      pitchesRes,
      pendingPitchesRes,
      acceptedPitchesRes,
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'consumer'),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'expert'),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'brand_admin'),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      supabaseAdmin.from('expert_details').select('*', { count: 'exact', head: true }).eq('is_verified', false),
      supabaseAdmin.from('brand_details').select('*', { count: 'exact', head: true }).eq('is_verified', false),
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
      supabaseAdmin.from('orders').select('total'),
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'delivered'),
      supabaseAdmin.from('communities').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('communities').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }).eq('is_published', true),
      supabaseAdmin.from('pitches').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('pitches').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('pitches').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
    ]);

    const totalRevenue = (ordersRes.data || []).reduce((sum: number, order: { total: number }) => sum + (order.total || 0), 0);

    return {
      users: {
        total: (consumersRes.count || 0) + (expertsRes.count || 0) + (brandsRes.count || 0) + (adminsRes.count || 0),
        consumers: consumersRes.count || 0,
        experts: expertsRes.count || 0,
        brands: brandsRes.count || 0,
        admins: adminsRes.count || 0,
        pendingExpertApprovals: pendingExpertsRes.count || 0,
        pendingBrandApprovals: pendingBrandsRes.count || 0,
      },
      products: {
        total: productsRes.count || 0,
        active: activeProductsRes.count || 0,
        draft: draftProductsRes.count || 0,
      },
      orders: {
        total: ordersRes.data?.length || 0,
        totalRevenue,
        pending: pendingOrdersRes.count || 0,
        delivered: deliveredOrdersRes.count || 0,
      },
      communities: {
        total: communitiesRes.count || 0,
        active: activeCommunitiesRes.count || 0,
      },
      posts: {
        total: postsRes.count || 0,
        published: publishedPostsRes.count || 0,
      },
      pitches: {
        total: pitchesRes.count || 0,
        pending: pendingPitchesRes.count || 0,
        accepted: acceptedPitchesRes.count || 0,
      },
    };
  }

  async listAllUsers(options: { role?: string; page?: number; limit?: number; search?: string } = {}) {
    const { role, page = 1, limit = 20, search } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (role) {
      query = query.eq('role', role);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to list all users', { error: error.message });
      throw ApiError.internal('Failed to fetch users');
    }

    return {
      data: data || [],
      pagination: { page, limit, total: count || 0 },
    };
  }

  async listPendingBrands(options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        brand_details (*)
      `, { count: 'exact' })
      .eq('role', 'brand_admin')
      .eq('brand_details.is_verified', false)
      .not('brand_details', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to list pending brands', { error: error.message });
      throw ApiError.internal('Failed to fetch pending brands');
    }

    // Filter to only those where brand_details.is_verified is false
    const pending = (data || []).filter((row: Record<string, unknown>) => {
      const bd = row.brand_details as Record<string, unknown> | null;
      return bd && bd.is_verified === false;
    });

    return {
      data: pending,
      pagination: { page, limit, total: count || 0 },
    };
  }

  async listPendingExperts(options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        expert_details (*)
      `, { count: 'exact' })
      .eq('role', 'expert')
      .eq('expert_details.is_verified', false)
      .not('expert_details', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to list pending experts', { error: error.message });
      throw ApiError.internal('Failed to fetch pending experts');
    }

    const pending = (data || []).filter((row: Record<string, unknown>) => {
      const ed = row.expert_details as Record<string, unknown> | null;
      return ed && ed.is_verified === false;
    });

    return {
      data: pending,
      pagination: { page, limit, total: count || 0 },
    };
  }

  async listAllBrands(options: { page?: number; limit?: number; verified?: boolean } = {}) {
    const { page = 1, limit = 20, verified } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('profiles')
      .select(`
        *,
        brand_details (*)
      `, { count: 'exact' })
      .eq('role', 'brand_admin')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to list all brands', { error: error.message });
      throw ApiError.internal('Failed to fetch brands');
    }

    let filtered = data || [];
    if (verified !== undefined) {
      filtered = filtered.filter((row: Record<string, unknown>) => {
        const bd = row.brand_details as Record<string, unknown> | null;
        return bd && bd.is_verified === verified;
      });
    }

    return {
      data: filtered,
      pagination: { page, limit, total: count || 0 },
    };
  }

  async listAllExperts(options: { page?: number; limit?: number; verified?: boolean } = {}) {
    const { page = 1, limit = 20, verified } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        expert_details (*)
      `, { count: 'exact' })
      .eq('role', 'expert')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to list all experts', { error: error.message });
      throw ApiError.internal('Failed to fetch experts');
    }

    let filtered = data || [];
    if (verified !== undefined) {
      filtered = filtered.filter((row: Record<string, unknown>) => {
        const ed = row.expert_details as Record<string, unknown> | null;
        return ed && ed.is_verified === verified;
      });
    }

    return {
      data: filtered,
      pagination: { page, limit, total: count || 0 },
    };
  }

  async listAllOrders(options: { page?: number; limit?: number; status?: string } = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        profiles:user_id (id, email, full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to list all orders', { error: error.message });
      throw ApiError.internal('Failed to fetch orders');
    }

    return {
      data: data || [],
      pagination: { page, limit, total: count || 0 },
    };
  }

  async listAllProducts(options: { page?: number; limit?: number; status?: string } = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('products')
      .select(`
        *,
        brand_details:brand_id (id, brand_name),
        categories:category_id (id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to list all products', { error: error.message });
      throw ApiError.internal('Failed to fetch products');
    }

    return {
      data: data || [],
      pagination: { page, limit, total: count || 0 },
    };
  }

  async listAllCommunities(options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('communities')
      .select(`
        *,
        categories:category_id (id, name),
        creator:created_by (id, full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to list all communities', { error: error.message });
      throw ApiError.internal('Failed to fetch communities');
    }

    return {
      data: data || [],
      pagination: { page, limit, total: count || 0 },
    };
  }

  async listAllPitches(options: { page?: number; limit?: number; status?: string } = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('pitches')
      .select(`
        *,
        brand:brand_id (id, brand_name, logo_url),
        expert:expert_id (id, full_name, email),
        product:product_id (id, name, slug),
        community:community_id (id, name, slug)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to list all pitches', { error: error.message });
      throw ApiError.internal('Failed to fetch pitches');
    }

    return {
      data: data || [],
      pagination: { page, limit, total: count || 0 },
    };
  }

  async listAllShipments(options: { page?: number; limit?: number; status?: string } = {}) {
    const { page = 1, limit = 20, status } = options;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('shipments')
      .select(`
        *,
        order:order_id (id, order_number, user_id),
        pitch:pitch_id (id, status)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to list all shipments', { error: error.message });
      throw ApiError.internal('Failed to fetch shipments');
    }

    return {
      data: data || [],
      pagination: { page, limit, total: count || 0 },
    };
  }

  async deleteProduct(productId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      logger.error('Failed to delete product', { error: error.message, productId });
      throw ApiError.internal('Failed to delete product');
    }
  }

  async deactivateUser(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      logger.error('Failed to deactivate user', { error: error.message, userId });
      throw ApiError.internal('Failed to deactivate user');
    }
  }

  async activateUser(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      logger.error('Failed to activate user', { error: error.message, userId });
      throw ApiError.internal('Failed to activate user');
    }
  }
}

export const adminService = new AdminService();
