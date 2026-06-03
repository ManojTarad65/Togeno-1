"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Loader2,
  Plus,
  Receipt,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { InvoiceService, Invoice, InvoiceableOrder } from "@/services/invoice.service";

// ─── PDF print helper ─────────────────────────────────────────────────────────

function buildInvoiceHtml(invoice: Invoice): string {
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const addr = invoice.shippingAddress;
  const addrStr = addr
    ? [addr.name, addr.line1, addr.line2, `${addr.city}, ${addr.state} - ${addr.postal}`, addr.country]
        .filter(Boolean)
        .join("<br/>")
    : "—";

  const itemRows = (invoice.items ?? [])
    .map(
      (item) => `
      <tr>
        <td>${item.name}${item.selectedSize ? ` (${item.selectedSize})` : ""}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">₹${item.price.toFixed(2)}</td>
        <td style="text-align:right">₹${item.subtotal.toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #fff; color: #111; padding: 40px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .brand-logo { font-size: 22px; font-weight: 900; letter-spacing: 2px; color: #000; }
    .invoice-meta h2 { font-size: 20px; font-weight: 700; color: #111; }
    .invoice-meta p { color: #555; font-size: 12px; margin-top: 4px; }
    .divider { border: none; border-top: 2px solid #eee; margin: 20px 0; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
    .section-value { font-size: 13px; color: #111; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #f4f4f4; }
    th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    .totals { margin-left: auto; width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .totals-row.grand { font-weight: 700; font-size: 15px; border-top: 2px solid #111; padding-top: 10px; margin-top: 4px; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #aaa; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; background: #e8f5e9; color: #2e7d32; }
    @media print { button { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-logo">TRODEC</div>
      <p style="color:#555;font-size:12px;margin-top:4px">trust-first commerce</p>
    </div>
    <div class="invoice-meta" style="text-align:right">
      <h2>${invoice.invoiceNumber}</h2>
      <p>Date: ${formatDate(invoice.createdAt)}</p>
      <span class="badge">TAX INVOICE</span>
    </div>
  </div>

  <hr class="divider"/>

  <div class="two-col">
    <div>
      <div class="section-title">Bill From</div>
      <div class="section-value">
        <strong>${invoice.brandName ?? "—"}</strong><br/>
        ${invoice.gstNumber ? `GSTIN: ${invoice.gstNumber}<br/>` : ""}
        ${invoice.panNumber ? `PAN: ${invoice.panNumber}<br/>` : ""}
        ${invoice.registeredAddress ?? ""}${invoice.registeredAddress ? "<br/>" : ""}
        ${invoice.contactNumber ?? ""}${invoice.contactNumber ? "<br/>" : ""}
        ${invoice.billingEmail ?? ""}
      </div>
    </div>
    <div>
      <div class="section-title">Ship To</div>
      <div class="section-value">${addrStr}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Unit Price</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>₹${invoice.subtotal.toFixed(2)}</span></div>
    <div class="totals-row"><span>Shipping</span><span>${invoice.shippingAmount > 0 ? `₹${invoice.shippingAmount.toFixed(2)}` : "Free"}</span></div>
    ${invoice.taxAmount > 0 ? `<div class="totals-row"><span>Tax</span><span>₹${invoice.taxAmount.toFixed(2)}</span></div>` : ""}
    <div class="totals-row grand"><span>Total</span><span>₹${invoice.totalAmount.toFixed(2)}</span></div>
  </div>

  <div class="footer">
    <p>This is a computer-generated invoice. No signature required.</p>
    <p style="margin-top:4px">Trodec · trodec.com</p>
  </div>
</body>
</html>`;
}

function printInvoice(invoice: Invoice) {
  const html = buildInvoiceHtml(invoice);
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) { toast.error("Pop-up blocked. Allow pop-ups and try again."); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function statusBadge(status: Invoice["status"]) {
  const map: Record<Invoice["status"], { label: string; cls: string }> = {
    generated: { label: "Generated", cls: "text-blue-400 border-blue-500/30" },
    sent:      { label: "Sent",      cls: "text-purple-400 border-purple-500/30" },
    downloaded:{ label: "Downloaded",cls: "text-emerald-400 border-emerald-500/30" },
  };
  const { label, cls } = map[status] ?? map.generated;
  return <Badge variant="outline" className={cls}>{label}</Badge>;
}

function orderStatusBadge(status: string) {
  const colors: Record<string, string> = {
    confirmed:  "text-blue-400 border-blue-400/30",
    processing: "text-yellow-400 border-yellow-400/30",
    shipped:    "text-purple-400 border-purple-400/30",
    delivered:  "text-emerald-400 border-emerald-400/30",
  };
  return (
    <Badge variant="outline" className={colors[status] ?? "text-zinc-400 border-zinc-400/30"}>
      {status}
    </Badge>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrandInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<InvoiceableOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      const [inv, ord] = await Promise.all([
        InvoiceService.listInvoices(),
        InvoiceService.listInvoiceableOrders(),
      ]);
      setInvoices(inv);
      setOrders(ord);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load invoices");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedOrderId) { toast.error("Select an order first"); return; }
    try {
      setIsGenerating(true);
      const invoice = await InvoiceService.createInvoice(selectedOrderId);
      setInvoices((prev) => [invoice, ...prev.filter((i) => i.id !== invoice.id)]);
      setOrders((prev) =>
        prev.map((o) => o.orderId === selectedOrderId ? { ...o, hasInvoice: true } : o)
      );
      setSelectedOrderId("");
      toast.success(`Invoice ${invoice.invoiceNumber} generated`);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate invoice");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDownload(invoice: Invoice) {
    try {
      setIsDownloading(invoice.id);
      printInvoice(invoice);
      await InvoiceService.markDownloaded(invoice.id);
      setInvoices((prev) =>
        prev.map((i) => i.id === invoice.id ? { ...i, status: "downloaded" } : i)
      );
    } finally {
      setIsDownloading(null);
    }
  }

  const pendingOrders = orders.filter((o) => !o.hasInvoice);

  return (
    <div className="space-y-8 text-white">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-zinc-400 mt-1">Generate and download GST-compliant invoices for your orders.</p>
      </div>

      {/* Generate new invoice */}
      <Card className="bg-[#0b0b0b] border-[#1f1f1f]">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="text-white flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-500" /> Generate Invoice
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {pendingOrders.length === 0 ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              All eligible orders already have invoices.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger className="bg-[#111] border-[#1f1f1f] text-white sm:w-96">
                  <SelectValue placeholder="Select an order to invoice…" />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#1f1f1f]">
                  {pendingOrders.map((o) => (
                    <SelectItem key={o.orderId} value={o.orderId} className="text-zinc-300">
                      #{o.orderNumber} — ₹{o.total.toFixed(2)} — {o.customerName ?? "Customer"} ({o.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !selectedOrderId}
                className="bg-emerald-600 hover:bg-emerald-500 font-semibold"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
                Generate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice list */}
      <Card className="bg-[#0b0b0b] border-[#1f1f1f]">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-zinc-400" /> Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-zinc-500">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm">No invoices yet. Generate one from a fulfilled order above.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 px-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-white">{invoice.invoiceNumber}</p>
                      {statusBadge(invoice.status)}
                    </div>
                    <p className="text-xs text-zinc-500">
                      Order #{invoice.orderId.slice(0, 8)} ·{" "}
                      {new Date(invoice.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </p>
                    <p className="text-sm text-zinc-300 font-semibold">₹{invoice.totalAmount.toFixed(2)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(invoice)}
                    disabled={isDownloading === invoice.id}
                    className="border-[#1f1f1f] text-zinc-300 hover:bg-white/5 shrink-0"
                  >
                    {isDownloading === invoice.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download PDF
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
