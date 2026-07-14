export default function Testimonials() {
  const reviews = [
    {
      name: "Priya Sharma",
      comment:
        "The slippers feel comfortable for long use, and the finish looks better than expected.",
    },
    {
      name: "Sita Karki",
      comment:
        "The order confirmation was clear, and the product matched the photos well.",
    },
    {
      name: "Anisha Rai",
      comment:
        "Good value for the price. The design is easy to wear with daily outfits.",
    },
  ];

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center text-4xl font-bold text-[#0B4D3B]">
          What Our Customers Say
        </h2>

        <p className="mb-12 mt-3 text-center text-gray-500">
          Trusted by customers who want comfort and clean styling.
        </p>

        <div className="grid gap-8 md:grid-cols-3">
          {reviews.map((review) => (
            <div
              key={review.name}
              className="rounded-lg bg-[#F8F8F8] p-8 shadow-lg duration-300 hover:shadow-2xl"
            >
              <div className="text-sm font-black tracking-[0.2em] text-[#C8A04D]">
                5 / 5
              </div>

              <p className="mt-5 italic text-gray-600">
                &ldquo;{review.comment}&rdquo;
              </p>

              <h3 className="mt-6 font-bold text-[#0B4D3B]">{review.name}</h3>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
