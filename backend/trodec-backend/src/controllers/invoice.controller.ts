import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "@/types";
import { invoiceService } from "@/services/invoice.service";
import { ApiError } from "@/utils/errors";

class InvoiceController {
  /** GET /api/invoices — list all invoices for the authenticated brand */
  listInvoices = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const brandId = req.user!.id;
      const invoices = await invoiceService.listInvoices(brandId);
      res.json({ data: invoices });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/invoices/orders — list invoiceable orders */
  listInvoiceableOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const brandId = req.user!.id;
      const orders = await invoiceService.listInvoiceableOrders(brandId);
      res.json({ data: orders });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/invoices — generate invoice for an order */
  createInvoice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const brandId = req.user!.id;
      const { orderId } = req.body as { orderId: string };
      if (!orderId) throw ApiError.badRequest("orderId is required");
      const invoice = await invoiceService.createInvoice(brandId, orderId);
      res.status(201).json({ data: invoice });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/invoices/:id — get a single invoice */
  getInvoice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const brandId = req.user!.id;
      const id = req.params.id as string;
      const invoice = await invoiceService.getInvoice(brandId, id);
      res.json({ data: invoice });
    } catch (err) {
      next(err);
    }
  };

  /** PATCH /api/invoices/:id/downloaded — mark as downloaded */
  markDownloaded = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const brandId = req.user!.id;
      const id = req.params.id as string;
      await invoiceService.markDownloaded(brandId, id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  };
}

export const invoiceController = new InvoiceController();
