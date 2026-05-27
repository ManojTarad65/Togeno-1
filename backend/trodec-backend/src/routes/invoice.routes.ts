import { Router } from "express";
import { authenticate, requireRole } from "@/middleware";
import { invoiceController } from "@/controllers/invoice.controller";

const router = Router();

// All invoice routes require an authenticated brand_admin
router.use(authenticate, requireRole("brand_admin"));

router.get("/orders", invoiceController.listInvoiceableOrders);
router.get("/", invoiceController.listInvoices);
router.post("/", invoiceController.createInvoice);
router.get("/:id", invoiceController.getInvoice);
router.patch("/:id/downloaded", invoiceController.markDownloaded);

export default router;
