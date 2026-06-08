import api, { ApiSuccessResponse, getErrorMessage } from './api';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productSlug: string;
  quantity: number;
  price: number;
  total: number;
  imageUrl?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderTrackingEvent {
  status: string;
  label: string;
  location: string;
  timestamp: string;
}

export interface OrderShipment {
  shipmentId: string;
  awbCode: string | null;
  trackingUrl: string | null;
  carrier: string;
  status: string;
  labelUrl: string | null;
  invoiceUrl: string | null;
  manifestUrl: string | null;
  estimatedDelivery: string | null;
  trackingEvents: OrderTrackingEvent[] | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export interface Order {
  id: string;
  orderNumber?: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discountAmount?: number;
  promoCode?: string | null;
  // Denormalized shipping address fields
  shippingName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  items: OrderItem[];
  shipment?: OrderShipment | null;
  /** @deprecated use shipment.awbCode */
  trackingNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderData {
  shippingAddressId: string;
  billingAddressId: string;
  notes?: string;
  items?: { productId: string; quantity: number; selectedSize?: string | null }[];
  sourcePostId?: string | null;
  promoCode?: string | null;
}

export interface OrdersFilter {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}

export interface PaginatedOrders {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface PaymentInitResponse {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  paymentRecordId: string;
}

export const OrderService = {
  async initiatePayment(orderId: string): Promise<PaymentInitResponse> {
    try {
      const response = await api.post<ApiSuccessResponse<PaymentInitResponse>>('/payments/initiate', { orderId });
      return response.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  async verifyPayment(data: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): Promise<void> {
    try {
      await api.post('/payments/verify', data);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  async createOrder(data: CreateOrderData): Promise<Order> {
    try {
      const response = await api.post<ApiSuccessResponse<Order>>('/orders', data);
      return response.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  async getOrderById(id: string): Promise<Order> {
    try {
      const response = await api.get<ApiSuccessResponse<Order>>(`/orders/${id}`);
      return response.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  async getMyOrders(params?: OrdersFilter): Promise<PaginatedOrders> {
    try {
      const response = await api.get<ApiSuccessResponse<PaginatedOrders>>('/orders', {
        params,
      });
      return response.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  async cancelOrder(id: string): Promise<Order> {
    try {
      const response = await api.post<ApiSuccessResponse<Order>>(`/orders/${id}/cancel`);
      return response.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  async confirmReceipt(id: string): Promise<Order> {
    try {
      const response = await api.post<ApiSuccessResponse<Order>>(`/orders/${id}/confirm-receipt`);
      return response.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  async brandCancelOrder(id: string): Promise<Order> {
    try {
      const response = await api.post<ApiSuccessResponse<Order>>(`/orders/${id}/brand-cancel`);
      return response.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  async validatePromo(code: string): Promise<{ code: string; discountPct: number; label: string }> {
    try {
      const response = await api.post<ApiSuccessResponse<{ code: string; discountPct: number; label: string }>>('/orders/validate-promo', { code });
      return response.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  async getExpertOrders(params?: { page?: number; limit?: number; status?: string }): Promise<{
    orders: Order[];
    total: number;
    stats: { totalOrders: number; totalRevenue: number; topProducts: Array<{ productId: string; productName: string; count: number }> };
  }> {
    try {
      const response = await api.get<ApiSuccessResponse<{
        orders: Order[];
        total: number;
        stats: { totalOrders: number; totalRevenue: number; topProducts: Array<{ productId: string; productName: string; count: number }> };
      }>>('/orders/expert/dashboard', { params });
      return response.data.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },
};

export default OrderService;
