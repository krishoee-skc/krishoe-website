import { CheckIcon } from "@/components/Icons";

export default function WhyChoose() {
  const features = [
    {
      title: "Premium Quality",
      desc: "Selected pairs with reliable materials, clean finishing, and a polished look.",
    },
    {
      title: "Comfort",
      desc: "Built around easy movement for daily wear, work days, and family outings.",
    },
    {
      title: "Fast Confirmation",
      desc: "Order requests are captured clearly so the KRISHOE team can confirm quickly.",
    },
    {
      title: "Fair Price",
      desc: "Premium everyday footwear with pricing that makes sense for repeat use.",
    },
  ];

  return (
    <section className="bg-[#F8F8F8] py-20">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center text-4xl font-bold text-brand-green">
          Why Choose KRISHOE?
        </h2>

        <p className="mb-14 mt-4 text-center text-gray-500">
          A cleaner shopping experience for everyday footwear.
        </p>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((item) => (
            <div
              key={item.title}
              className="rounded-lg bg-white p-8 text-center shadow-lg duration-300 hover:shadow-2xl"
            >
              <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-brand-green-mist text-brand-green">
                <CheckIcon className="h-6 w-6" />
              </div>

              <h3 className="text-2xl font-bold text-brand-green">{item.title}</h3>
              <p className="mt-4 text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
