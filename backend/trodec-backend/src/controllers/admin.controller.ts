import { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service';
import { userService } from '../services/user.service';
import { orderService } from '../services/order.service';
import { logisticsService, shiprocketClient } from '../services/logistics.service';
import { notificationService } from '../services/notification.service';
import { supabaseAdmin } from '../config/supabase';
import { ApiError } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { logger } from '../utils/logger';

function parseIntParam(value: string | string[] | undefined, fallback: number): number {
  if (!value) return fallback;
  const str = Array.isArray(value) ? value[0] : value;
  return Number.parseInt(str, 10);
}

function stringParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

class AdminController {
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getStats();
      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async listAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.listAllUsers({
        role: stringParam(req.query.role as string | string[]),
        page: parseIntParam(req.query.page as string | string[], 1),
        limit: parseIntParam(req.query.limit as string | string[], 20),
        search: stringParam(req.query.search as string | string[]),
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async listPendingBrands(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.listPendingBrands({
        page: parseIntParam(req.query.page as string | string[], 1),
        limit: parseIntParam(req.query.limit as string | string[], 20),
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async listPendingExperts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.listPendingExperts({
        page: parseIntParam(req.query.page as string | string[], 1),
        limit: parseIntParam(req.query.limit as string | string[], 20),
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async listAllBrands(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const verifiedParam = stringParam(req.query.verified as string | string[]);
      const result = await adminService.listAllBrands({
        page: parseIntParam(req.query.page as string | string[], 1),
        limit: parseIntParam(req.query.limit as string | string[], 20),
        verified: verifiedParam === undefined ? undefined : verifiedParam === 'true',
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async listAllExperts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const verifiedParam = stringParam(req.query.verified as string | string[]);
      const result = await adminService.listAllExperts({
        page: parseIntParam(req.query.page as string | string[], 1),
        limit: parseIntParam(req.query.limit as string | string[], 20),
        verified: verifiedParam === undefined ? undefined : verifiedParam === 'true',
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async listAllOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.listAllOrders({
        page: parseIntParam(req.query.page as string | string[], 1),
        limit: parseIntParam(req.query.limit as string | string[], 20),
        status: stringParam(req.query.status as string | string[]),
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async listAllProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.listAllProducts({
        page: parseIntParam(req.query.page as string | string[], 1),
        limit: parseIntParam(req.query.limit as string | string[], 20),
        status: stringParam(req.query.status as string | string[]),
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async listAllCommunities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await adminService.listAllCommunities({
        page: parseIntParam(req.query.page as string | string[], 1),
        limit: parseIntParam(req.query.limit as string | string[], 20),
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async verifyUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params['id']);
      const { approved }: { approved: boolean } = req.body;
      const profile = await userService.getProfile(id);
      if (!profile) {
        throw ApiError.notFound('User not found');
      }
      if (profile.role !== 'expert' && profile.role !== 'brand_admin') {
        throw ApiError.badRequest('User is not an expert or brand');
      }
      const role = profile.role as 'expert' | 'brand_admin';
      if (approved) {
        await adminService.approveUser(id, role);
        const roleLabel = role === 'expert' ? 'Expert' : 'Brand';
        notificationService.create(
          id,
          'account.approved',
          `${roleLabel} Account Approved`,
          `Your ${roleLabel.toLowerCase()} account has been approved. You can now access all ${roleLabel.toLowerCase()} features.`,
        ).catch(() => {});
      } else {
        await adminService.rejectUser(id, role);
        const roleLabel = role === 'expert' ? 'Expert' : 'Brand';
        notificationService.create(
          id,
          'account.rejected',
          `${roleLabel} Account Not Approved`,
          `Your ${roleLabel.toLowerCase()} account application was not approved. Please contact support for more information.`,
        ).catch(() => {});
      }
      sendSuccess(res, { message: approved ? 'User approved' : 'User rejected' });
    } catch (error) {
      next(error);
    }
  }

  async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params['id']);
      await adminService.deleteProduct(id);
      sendSuccess(res, { message: 'Product deleted' });
    } catch (error) {
      next(error);
    }
  }

  async toggleUserActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params['id']);
      const { active }: { active: boolean } = req.body;
      if (active) {
        await adminService.activateUser(id);
      } else {
        await adminService.deactivateUser(id);
      }
      sendSuccess(res, { message: active ? 'User activated' : 'User deactivated' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /admin/orders/:id/status
   * Manually update order status (triggers shipment/commission hooks).
   */
  async updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params['id']);
      const { status } = req.body as { status: string };

      const allowed = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!allowed.includes(status)) {
        throw ApiError.badRequest(`Invalid status. Must be one of: ${allowed.join(', ')}`);
      }

      const order = await orderService.updateOrderStatus(
        id,
        status as 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
      );
      sendSuccess(res, order, 200, `Order status updated to ${status}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /admin/orders/:id/create-shipment
   * Manually trigger Shiprocket forward shipment creation for an order whose
   * shipment was never created (e.g. Shiprocket failed silently at confirmation).
   * Safe to call even if order is already delivered.
   */
  async createShipmentForOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = String(req.params['id']);

      // Check no FORWARD shipment already exists
      const { data: existing } = await supabaseAdmin
        .from('shipments')
        .select('id, awb_code')
        .eq('order_id', orderId)
        .eq('type', 'FORWARD')
        .maybeSingle();

      if (existing && (existing as any).awb_code) {
        throw ApiError.badRequest('A shipment with an AWB already exists for this order. Use Retry AWB/Docs from the Shipments page instead.');
      }

      // Fetch the order
      const { data: orderRow, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(brand_id, product_name, product_price, quantity)')
        .eq('id', orderId)
        .single();

      if (orderErr || !orderRow) throw ApiError.notFound('Order not found');

      const toAddress = {
        name:       (orderRow as any).shipping_name,
        phone:      (orderRow as any).shipping_phone,
        line1:      (orderRow as any).shipping_address_line1,
        city:       (orderRow as any).shipping_city,
        state:      (orderRow as any).shipping_state,
        postalCode: (orderRow as any).shipping_postal_code,
        country:    (orderRow as any).shipping_country,
      };

      const items = ((orderRow as any).order_items ?? []).map((i: any) => ({
        name:          i.product_name,
        sku:           'SKU-001',
        units:         i.quantity,
        selling_price: i.product_price,
      }));

      const brandId = ((orderRow as any).order_items?.[0] as any)?.brand_id ?? '';

      // Resolve brand pickup location
      let fromAddress: Record<string, unknown> = { name: 'Trodec Warehouse', city: 'Mumbai', country: 'India' };
      let pickupLocation = 'Primary';
      if (brandId) {
        const { data: addr } = await supabaseAdmin
          .from('addresses')
          .select('full_name, phone_number, address_line1, address_line2, city, state, postal_code, country')
          .eq('user_id', brandId)
          .eq('is_default_shipping', true)
          .maybeSingle();

        if (addr) {
          fromAddress = {
            name:       (addr as any).full_name,
            phone:      (addr as any).phone_number,
            line1:      (addr as any).address_line1,
            city:       (addr as any).city,
            state:      (addr as any).state,
            postalCode: (addr as any).postal_code,
            country:    (addr as any).country,
          };
        }
        pickupLocation = await shiprocketClient.getBrandPickupLocation(brandId);
      }

      const shipment = await logisticsService.createForwardShipment({
        orderId,
        fromAddress,
        toAddress,
        items,
        totalAmount: Number((orderRow as any).total ?? 0),
        pickupLocation,
      });

      logger.info('Admin manually created forward shipment', { orderId, shipmentId: shipment.id });
      sendSuccess(res, shipment, 201, 'Shipment created successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/pitches
   * List all pitches with brand/expert/product/community info.
   */
  async listAllPitches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query['page'] ? parseInt(req.query['page'] as string) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : 20;
      const status = req.query['status'] as string | undefined;

      const result = await adminService.listAllPitches({ page, limit, status });
      sendSuccess(res, result, 200, 'Pitches fetched');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /admin/shipments
   * List all shipments with order/pitch info.
   */
  async listAllShipments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query['page'] ? parseInt(req.query['page'] as string) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : 20;
      const status = req.query['status'] as string | undefined;

      const result = await adminService.listAllShipments({ page, limit, status });
      sendSuccess(res, result, 200, 'Shipments fetched');
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
