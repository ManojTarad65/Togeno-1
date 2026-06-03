import { Response, NextFunction } from 'express';
import { brandService } from '@/services/brand.service';
import { productService } from '@/services/product.service';
import { supabaseAdmin } from '@/config/supabase';
import { sendSuccess } from '@/utils/response';
import { ApiError } from '@/utils/errors';
import { AuthenticatedRequest } from '@/types';
import {
  CreateBrandInput,
  UpdateBrandInput,
  ListBrandsQuery,
  VerifyBrandInput,
  UpdatePickupSettingsInput,
} from '@/schemas';

class BrandController {
  /**
   * GET /brands/me
   * Get current user's brand details (brand_admin only)
   */
  async getMyBrand(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const brandDetails = await brandService.getBrandByUserId(req.user!.id);
      if (!brandDetails) {
        throw ApiError.notFound('Brand details not found');
      }
      sendSuccess(res, brandDetails);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /brands/me
   * Create brand details for current user (brand_admin only)
   */
  async createMyBrand(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body as CreateBrandInput;
      const brandDetails = await brandService.createBrand(req.user!.id, data);
      sendSuccess(res, brandDetails, 201, 'Brand details created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /brands/me
   * Update current user's brand details (brand_admin only)
   */
  async updateMyBrand(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body as UpdateBrandInput;
      const brandDetails = await brandService.updateBrand(req.user!.id, data);
      sendSuccess(res, brandDetails, 200, 'Brand details updated successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /brands/me
   * Delete current user's brand details (brand_admin only)
   */
  async deleteMyBrand(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await brandService.deleteBrand(req.user!.id);
      sendSuccess(res, null, 200, 'Brand details deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /brands
   * List all brands (public, filterable)
   */
  async listBrands(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ListBrandsQuery;
      const result = await brandService.listBrands({
        verified: query.verified,
        businessType: query.businessType,
        search: query.search,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /brands/:id
   * Get brand details by ID (public)
   */
  async getBrandById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const brandDetails = await brandService.getBrandById(id as string);
      if (!brandDetails) {
        throw ApiError.notFound('Brand not found');
      }
      sendSuccess(res, brandDetails);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /brands/:id/verify
   * Verify/unverify a brand (admin only)
   */
  async verifyBrand(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body as VerifyBrandInput;
      const brandDetails = await brandService.verifyBrand(id as string, data);
      sendSuccess(
        res,
        brandDetails,
        200,
        `Brand ${data.isVerified ? 'verified' : 'unverified'} successfully`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /brands/:id
   * Delete brand by ID (admin only)
   */
  async deleteBrand(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await brandService.deleteBrand(id as string);
      sendSuccess(res, null, 200, 'Brand deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /brands/me/products
   * Get current brand's products (brand_admin only)
   */
  async getMyProducts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, status } = req.query as any;
      const result = await productService.listProducts({
        brandId: req.user!.id,
        status: status as any,
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /brands/me/stats
   * Get current brand's dashboard stats (brand_admin only)
   */
  async getMyStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const brandId = req.user!.id;

      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, status')
        .eq('brand_id', brandId);

      const totalProducts = products?.length || 0;
      const activeProducts = products?.filter(p => p.status === 'active').length || 0;

      const productIds = products?.map(p => p.id) || [];

      let totalOrders = 0;
      let totalRevenue = 0;

      if (productIds.length > 0) {
        const { data: orderItems } = await supabaseAdmin
          .from('order_items')
          .select('order_id, quantity, product_price, subtotal')
          .in('product_id', productIds);

        totalOrders = new Set(orderItems?.map(i => i.order_id)).size;
        totalRevenue = orderItems?.reduce((sum, item) => sum + (item.subtotal || 0), 0) || 0;
      }

      sendSuccess(res, { totalProducts, activeProducts, totalOrders, totalRevenue });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /brands/me/orders
   * Get orders containing current brand's products (brand_admin only)
   */
  async getMyOrders(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const brandId = req.user!.id;
      const { page = '1', limit = '20', status } = req.query as any;
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.max(1, parseInt(limit) || 20);
      const offset = (pageNum - 1) * limitNum;

      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('brand_id', brandId);

      const productIds = products?.map(p => p.id) || [];

      if (productIds.length === 0) {
        return sendSuccess(res, { data: [], pagination: { page: pageNum, limit: limitNum, total: 0 } });
      }

      let query = supabaseAdmin
        .from('order_items')
        .select(`
          id,
          order_id,
          product_id,
          product_name,
          product_price,
          quantity,
          subtotal,
          selected_size,
          orders!inner(id, order_number, status, total, created_at)
        `, { count: 'exact' })
        .in('product_id', productIds)
        .range(offset, offset + limitNum - 1)
        .order('created_at', { referencedTable: 'orders', ascending: false });

      if (status) {
        query = query.eq('orders.status', status);
      }

      const { data, error, count } = await query;

      if (error) {
        return next(error);
      }

      const orderIds = (data ?? []).map((item: any) => item.order_id).filter(Boolean);

      // Batch-fetch shipments for all returned orders in a single query
      let shipmentMap: Record<string, { awb_code: string | null; label_url: string | null; carrier: string | null; status: string | null }> = {};
      if (orderIds.length > 0) {
        const { data: shipmentRows } = await supabaseAdmin
          .from('shipments')
          .select('order_id, awb_code, label_url, carrier, status')
          .in('order_id', orderIds)
          .eq('type', 'FORWARD')
          .order('created_at', { ascending: false });

        for (const s of shipmentRows ?? []) {
          // Keep the latest shipment per order (results ordered newest-first, first write wins)
          if (shipmentMap[s.order_id]) continue;
          shipmentMap[s.order_id] = {
            awb_code: s.awb_code,
            label_url: s.label_url,
            carrier: s.carrier,
            status: s.status,
          };
        }
      }

      const orders = data?.map((item: any) => {
        const shipment = shipmentMap[item.order_id] ?? null;
        return {
          id: item.order_id,
          itemId: item.id,
          orderNumber: item.orders?.order_number,
          status: item.orders?.status,
          total: item.orders?.total,
          createdAt: item.orders?.created_at,
          productName: item.product_name,
          productPrice: item.product_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          selectedSize: item.selected_size ?? null,
          awbCode: shipment?.awb_code ?? null,
          labelUrl: shipment?.label_url ?? null,
          courierName: shipment?.carrier ?? null,
          shipmentStatus: shipment?.status ?? null,
        };
      }) || [];

      sendSuccess(res, {
        data: orders,
        pagination: { page: pageNum, limit: limitNum, total: count || 0 },
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * GET /brands/me/pickup-settings
   * Returns brand's Shiprocket pickup location name, default address, and available Shiprocket locations.
   */
  async getPickupSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await brandService.getPickupSettings(req.user!.id);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /brands/me/pickup-settings
   * Save the Shiprocket pickup location name for this brand.
   */
  async updatePickupSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = req.body as UpdatePickupSettingsInput;
      await brandService.updatePickupSettings(req.user!.id, data);
      sendSuccess(res, null, 200, "Pickup settings updated");
    } catch (error) {
      next(error);
    }
  }
}

export const brandController = new BrandController();
