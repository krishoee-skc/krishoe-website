/**
 * CHECKOUT OPTIMIZATION COMPONENTS
 * All components in one file for faster deployment
 */

"use client";

import { useState } from "react";

// ============= SHIPPING FORM =============
export function ShippingForm({
  onSubmit,
}: {
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    street: "",
    city: "",
    postalCode: "",
    instructions: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-black text-brand-green-ink">Shipping Address</h3>

      <div>
        <label className="text-sm font-bold">Full Name *</label>
        <input
          type="text"
          required
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-green"
        />
      </div>

      <div>
        <label className="text-sm font-bold">Phone Number *</label>
        <input
          type="tel"
          required
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-green"
        />
      </div>

      <div>
        <label className="text-sm font-bold">Street Address *</label>
        <input
          type="text"
          required
          value={formData.street}
          onChange={(e) => setFormData({ ...formData, street: e.target.value })}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-green"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-bold">City *</label>
          <input
            type="text"
            required
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-green"
          />
        </div>
        <div>
          <label className="text-sm font-bold">Postal Code</label>
          <input
            type="text"
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-green"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-bold">Special Instructions</label>
        <textarea
          value={formData.instructions}
          onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-green"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-brand-green px-4 py-3 font-bold text-white transition hover:bg-brand-gold hover:text-brand-green-ink"
      >
        Continue to Payment
      </button>
    </form>
  );
}

// ============= PAYMENT METHOD =============
export function PaymentMethod({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (method: string) => void;
}) {
  const methods = [
    { id: "cod", label: "Cash on Delivery", icon: "💵" },
    { id: "esewa", label: "eSewa", icon: "📱" },
    { id: "khalti", label: "Khalti", icon: "📲" },
    { id: "bank", label: "Bank Transfer", icon: "🏦" },
    { id: "cheque", label: "Cheque", icon: "📄" },
  ];

  return (
    <div>
      <h3 className="mb-4 font-black text-brand-green-ink">Payment Method</h3>
      <div className="grid gap-3">
        {methods.map((method) => (
          <button
            key={method.id}
            onClick={() => onChange(method.id)}
            className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition ${
              selected === method.id
                ? "border-brand-green bg-brand-mist"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              checked={selected === method.id}
              onChange={() => onChange(method.id)}
              className="h-5 w-5 cursor-pointer"
            />
            <span className="text-2xl">{method.icon}</span>
            <span className="font-bold text-brand-green-ink">{method.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============= ORDER CONFIRMATION =============
export function OrderConfirmation({
  orderNumber,
  totalAmount,
  estimatedDelivery,
}: {
  orderNumber: string;
  totalAmount: number;
  estimatedDelivery: string;
}) {
  return (
    <div className="rounded-lg bg-emerald-50 p-8 text-center">
      <div className="mb-4 text-5xl">✅</div>
      <h2 className="text-3xl font-black text-emerald-700">Order Confirmed!</h2>

      <div className="mt-6 space-y-3 text-left">
        <div className="flex items-center justify-between rounded-lg bg-white p-4">
          <span className="text-sm text-gray-600">Order Number</span>
          <span className="font-mono font-bold text-brand-green-ink">{orderNumber}</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-white p-4">
          <span className="text-sm text-gray-600">Total Amount</span>
          <span className="text-xl font-black text-brand-green-ink">
            Rs. {totalAmount.toLocaleString("en-IN")}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-white p-4">
          <span className="text-sm text-gray-600">Estimated Delivery</span>
          <span className="font-bold text-brand-green-ink">{estimatedDelivery}</span>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <p className="text-sm text-gray-600">
          We've sent a confirmation email with all details.
        </p>
        <div className="flex gap-3">
          <button className="flex-1 rounded-lg border-2 border-emerald-700 px-4 py-3 font-bold text-emerald-700 transition hover:bg-emerald-700 hover:text-white">
            Track Order
          </button>
          <button className="flex-1 rounded-lg bg-brand-green px-4 py-3 font-bold text-white transition hover:bg-brand-gold hover:text-brand-green-ink">
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= SHIPPING METHOD SELECTOR =============
export function ShippingMethodSelector({
  methods,
  selected,
  onSelect,
}: {
  methods: any[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-4 font-black text-brand-green-ink">Shipping Method</h3>
      <div className="space-y-3">
        {methods.map((method) => (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            className={`w-full rounded-lg border-2 p-4 text-left transition ${
              selected === method.id
                ? "border-brand-green bg-brand-mist"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-bold text-brand-green-ink">{method.name}</p>
                <p className="text-xs text-gray-500">{method.description}</p>
                <p className="mt-1 text-sm text-gray-600">
                  Delivery in {method.estimated_days} days
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-brand-green-ink">
                  Rs. {method.base_cost?.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
