import { Response, NextFunction } from 'express';
import { brandService } from '@/services/brand.service';
import { brandPayoutService } from '@/services/brand_payout.service';
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
          .select('order_id')
          .in('product_id', productIds);

        totalOrders = new Set(orderItems?.map(i => i.order_id)).size;
      }

      // Net profit = sum of brand_net from delivered orders (after shipping + platform commission)
      const { data: payoutRows } = await supabaseAdmin
        .from('brand_payouts')
        .select('brand_net')
        .eq('brand_id', brandId)
        .neq('status', 'reversed');

      totalRevenue = payoutRows?.reduce((sum, row) => sum + Number(row.brand_net || 0), 0) || 0;

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

      // Filter directly by brand_id on order_items (set at order-creation time from product.brand_id).
      // This avoids a fragile 2-step products sub-query that could silently return empty on error.
      let query = supabaseAdmin
        .from('order_items')
        .select(`
          id,
          order_id,
          product_id,
          product_name,
          product_image_url,
          product_price,
          quantity,
          subtotal,
          selected_size,
          orders!inner(id, order_number, status, total, actual_shipping_cost, created_at)
        `, { count: 'exact' })
        .eq('brand_id', brandId)
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
      let shipmentMap: Record<string, {
        id: string;
        awb_code: string | null;
        label_url: string | null;
        invoice_url: string | null;
        carrier: string | null;
        status: string | null;
        shiprocket_shipment_id: string | null;
      }> = {};
      if (orderIds.length > 0) {
        const { data: shipmentRows } = await supabaseAdmin
          .from('shipments')
          .select('id, order_id, awb_code, label_url, invoice_url, carrier, status, shiprocket_shipment_id')
          .in('order_id', orderIds)
          .eq('type', 'FORWARD')
          .order('created_at', { ascending: false });

        for (const s of shipmentRows ?? []) {
          if (shipmentMap[s.order_id]) continue;
          shipmentMap[s.order_id] = {
            id: s.id,
            awb_code: s.awb_code,
            label_url: s.label_url,
            invoice_url: s.invoice_url ?? null,
            carrier: s.carrier,
            status: s.status,
            shiprocket_shipment_id: s.shiprocket_shipment_id ?? null,
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
          productImage: item.product_image_url ?? null,
          productPrice: item.product_price,
          quantity: item.quantity,
          subtotal: item.subtotal,
          selectedSize: item.selected_size ?? null,
          shipmentId: shipment?.id ?? null,
          awbCode: shipment?.awb_code ?? null,
          labelUrl: shipment?.label_url ?? null,
          invoiceUrl: shipment?.invoice_url ?? null,
          courierName: shipment?.carrier ?? null,
          shipmentStatus: shipment?.status ?? null,
          hasShiprocketShipment: Boolean(shipment?.shiprocket_shipment_id),
          actualShippingCost: Number((item as any).orders?.actual_shipping_cost ?? 0),
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

  // ============================================================
  // EARNINGS / PAYOUTS
  // ============================================================

  /**
   * GET /brands/me/earnings
   * Payout stats + paginated list of brand_payouts.
   */
  async getEarnings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const brandId = req.user!.id;
      const { page = '1', limit = '20', status } = req.query as any;
      const result = await brandPayoutService.getBrandPayouts(brandId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status: status || undefined,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // BANK ACCOUNTS
  // ============================================================

  /** GET /brands/me/bank-accounts */
  async getBankAccounts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const accounts = await brandPayoutService.getBankAccounts(req.user!.id);
      sendSuccess(res, accounts);
    } catch (error) {
      next(error);
    }
  }

  /** POST /brands/me/bank-accounts */
  async saveBankAccount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { accountHolderName, accountNumber, ifscCode, bankName, upiId } = req.body;
      if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
        throw ApiError.badRequest("accountHolderName, accountNumber, ifscCode, bankName are required");
      }
      const account = await brandPayoutService.saveBankAccount(req.user!.id, {
        accountHolderName,
        accountNumber,
        ifscCode,
        bankName,
        upiId,
      });
      sendSuccess(res, account, 201, "Bank account saved");
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // WITHDRAWAL REQUESTS
  // ============================================================

  /** GET /brands/me/withdrawals */
  async getWithdrawals(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '20' } = req.query as any;
      const result = await brandPayoutService.getWithdrawalRequests(req.user!.id, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /** POST /brands/me/withdrawals */
  async requestWithdrawal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { amount, bankAccountId } = req.body;
      if (!amount || !bankAccountId) throw ApiError.badRequest("amount and bankAccountId are required");
      const withdrawal = await brandPayoutService.requestWithdrawal(req.user!.id, {
        amount: Number(amount),
        bankAccountId,
      });
      sendSuccess(res, withdrawal, 201, "Withdrawal request submitted");
    } catch (error) {
      next(error);
    }
  }

  // ============================================================
  // ADMIN — brand withdrawal management
  // ============================================================

  /** GET /brands/withdrawals (admin) */
  async adminGetWithdrawals(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '20', status } = req.query as any;
      const result = await brandPayoutService.getAllWithdrawalRequests({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        status: status || undefined,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /** POST /brands/withdrawals/:id/process (admin) */
  async adminProcessWithdrawal(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const withdrawalId = req.params['id'] as string;
      const { action, transactionRef, rejectionReason } = req.body;
      if (!['approved', 'paid', 'rejected'].includes(action)) {
        throw ApiError.badRequest("action must be approved | paid | rejected");
      }
      const result = await brandPayoutService.processWithdrawal(withdrawalId, action, {
        transactionRef,
        rejectionReason,
      });
      sendSuccess(res, result, 200, `Withdrawal ${action}`);
    } catch (error) {
      next(error);
    }
  }
}

export const brandController = new BrandController();
