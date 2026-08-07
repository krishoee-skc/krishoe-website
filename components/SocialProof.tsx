/**
 * SOCIAL PROOF COMPONENTS
 * Testimonials, trust badges, success stories
 */

"use client";

// ============= TESTIMONIAL CARD =============
export function TestimonialCard({
  name,
  rating,
  text,
  image,
}: {
  name: string;
  rating: number;
  text: string;
  image?: string;
}) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-brand-green-ink">{name}</p>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={star <= rating ? "text-brand-gold" : "text-gray-300"}
              >
                ★
              </span>
            ))}
          </div>
        </div>
        {image && (
          <img
            src={image}
            alt={name}
            className="h-12 w-12 rounded-full object-cover"
          />
        )}
      </div>
      <p className="mt-3 text-sm text-gray-600">"{text}"</p>
    </div>
  );
}

// ============= TESTIMONIAL SLIDER =============
export function TestimonialSlider({
  testimonials,
}: {
  testimonials: any[];
}) {
  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  return (
    <div className="relative">
      <div className="overflow-hidden">
        <div
          className="transition-transform duration-500"
          style={{
            transform: `translateX(-${current * 100}%)`,
          }}
        >
          <div className="flex">
            {testimonials.map((t, i) => (
              <div key={i} className="w-full flex-shrink-0">
                <TestimonialCard {...t} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={() => setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
          className="rounded-full p-2 hover:bg-gray-100"
        >
          ←
        </button>
        <div className="flex gap-2">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 w-2 rounded-full transition ${
                i === current ? "bg-brand-gold" : "bg-gray-300"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrent((prev) => (prev + 1) % testimonials.length)}
          className="rounded-full p-2 hover:bg-gray-100"
        >
          →
        </button>
      </div>
    </div>
  );
}

// ============= TRUST BADGES =============
export function TrustBadges() {
  const badges = [
    { icon: "🔒", label: "SSL Secure", description: "256-bit encryption" },
    { icon: "✓", label: "Verified Seller", description: "Trusted by 10K+ customers" },
    { icon: "💰", label: "Money Back", description: "30-day guarantee" },
    { icon: "🚚", label: "Free Shipping", description: "On orders over Rs. 1000" },
    { icon: "📞", label: "24/7 Support", description: "Customer care team" },
    { icon: "⭐", label: "4.8/5 Rating", description: "1000+ reviews" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {badges.map((badge, i) => (
        <div key={i} className="rounded-lg bg-white p-4 text-center shadow-sm">
          <div className="text-3xl">{badge.icon}</div>
          <p className="mt-2 text-xs font-bold text-brand-green-ink">{badge.label}</p>
          <p className="text-xs text-gray-500">{badge.description}</p>
        </div>
      ))}
    </div>
  );
}

// ============= SUCCESS STATS =============
export function SuccessStats() {
  const stats = [
    { number: "10K+", label: "Happy Customers" },
    { number: "50K+", label: "Orders Delivered" },
    { number: "4.8★", label: "Average Rating" },
    { number: "100%", label: "Satisfaction Rate" },
  ];

  return (
    <div className="rounded-lg bg-brand-mist p-8">
      <h3 className="mb-8 text-center font-black text-brand-green-ink">Why Choose KRISHOE?</h3>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="text-center">
            <p className="text-3xl font-black text-brand-green">{stat.number}</p>
            <p className="mt-2 text-sm text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import React from "react";
