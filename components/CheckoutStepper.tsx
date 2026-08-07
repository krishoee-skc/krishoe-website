"use client";

import type { ReactNode } from "react";

type Step = "cart" | "shipping" | "payment" | "confirmation";

interface CheckoutStepperProps {
  currentStep: Step;
  steps?: Record<Step, string>;
}

export default function CheckoutStepper({
  currentStep,
  steps = {
    cart: "Cart",
    shipping: "Shipping",
    payment: "Payment",
    confirmation: "Confirmation",
  },
}: CheckoutStepperProps) {
  const stepOrder: Step[] = ["cart", "shipping", "payment", "confirmation"];
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {stepOrder.map((step, index) => (
          <div key={step} className="flex flex-1 items-center">
            {/* Circle */}
            <div
              className={`
                relative z-10 flex h-12 w-12 items-center justify-center rounded-full font-black
                ${
                  index < currentIndex
                    ? "bg-emerald-500 text-white"
                    : index === currentIndex
                      ? "bg-brand-gold text-brand-green-ink ring-4 ring-brand-gold/30"
                      : "bg-gray-200 text-gray-400"
                }
              `}
            >
              {index < currentIndex ? "✓" : index + 1}
            </div>

            {/* Label */}
            <div className="ml-3">
              <p
                className={`text-xs font-black uppercase tracking-[0.08em] ${
                  index <= currentIndex ? "text-brand-green-ink" : "text-gray-400"
                }`}
              >
                {steps[step]}
              </p>
            </div>

            {/* Line */}
            {index < stepOrder.length - 1 && (
              <div className="ml-auto mr-2 flex-1 border-t-2 border-gray-200" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
