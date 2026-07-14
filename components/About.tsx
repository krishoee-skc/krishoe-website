import Image from "next/image";

export default function About() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <Image
              src="/images/about.jpg"
              alt="KRISHOE footwear display"
              width={700}
              height={700}
              className="rounded-lg object-cover shadow-2xl"
            />
          </div>

          <div>
            <p className="font-bold uppercase tracking-widest text-[#C8A04D]">
              About KRISHOE
            </p>

            <h2 className="mt-4 text-5xl font-extrabold text-[#0B4D3B]">
              Quality Footwear
              <br />
              Made For Nepal
            </h2>

            <p className="mt-8 text-lg leading-8 text-gray-600">
              KRISHOE brings quality footwear for Nepal-ready daily style:
              comfortable sandals, slippers, casual shoes, heels, and selected
              seasonal pairs.
            </p>

            <p className="mt-5 text-lg leading-8 text-gray-600">
              Our focus is simple: polished design, dependable finishing, fair
              pricing, and a shopping flow that is easy to understand.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-6">
              <div className="rounded-lg bg-gray-100 p-6 text-center">
                <h3 className="text-4xl font-bold text-[#0B4D3B]">5000+</h3>
                <p className="mt-2 text-gray-500">Happy Customers</p>
              </div>

              <div className="rounded-lg bg-gray-100 p-6 text-center">
                <h3 className="text-4xl font-bold text-[#0B4D3B]">100+</h3>
                <p className="mt-2 text-gray-500">Premium Designs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
