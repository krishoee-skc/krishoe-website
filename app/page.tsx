import Navbar from "../components/Navbar";
export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar/>
      
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-black to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <h1 className="text-5xl md:text-7xl font-bold">
            KRISHOE
          </h1>

          <p className="mt-6 text-xl text-gray-300 max-w-2xl">
            Premium Ladies Footwear Brand in Nepal.
            Quality, Comfort and Style in Every Step.
          </p>

          <div className="mt-10 flex gap-4">
            <button className="bg-yellow-500 text-black px-8 py-4 rounded-xl font-bold hover:bg-yellow-400 transition">
              Shop Now
            </button>

            <button className="border border-white px-8 py-4 rounded-xl hover:bg-white hover:text-black transition">
              Explore Collection
            </button>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold">
            Welcome to KRISHOE
          </h2>

          <p className="mt-6 text-gray-600 text-lg leading-8">
            KRISHOE is a trusted Nepali footwear brand specializing in
            premium ladies sandals, slippers and fashionable footwear.
            Our mission is to provide comfort, durability and elegant
            designs at affordable prices.
          </p>
        </div>
      </section>

      {/* Featured */}
      <section className="bg-gray-100 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-10">
            Featured Collection
          </h2>

          <div className="grid md:grid-cols-3 gap-8">

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="h-56 bg-gray-200 rounded-xl"></div>

              <h3 className="text-2xl font-bold mt-5">
                Ladies Sandals
              </h3>

              <p className="mt-3 text-gray-600">
                Elegant and comfortable sandals for every occasion.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="h-56 bg-gray-200 rounded-xl"></div>

              <h3 className="text-2xl font-bold mt-5">
                Casual Slippers
              </h3>

              <p className="mt-3 text-gray-600">
                Everyday comfort with modern style.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="h-56 bg-gray-200 rounded-xl"></div>

              <h3 className="text-2xl font-bold mt-5">
                Premium Collection
              </h3>

              <p className="mt-3 text-gray-600">
                Luxury footwear crafted with premium quality.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h3 className="text-3xl font-bold">
            KRISHOE
          </h3>

          <p className="mt-4 text-gray-400">
            Every Step Defines You.
          </p>

          <p className="mt-8 text-sm text-gray-500">
            © 2026 KRISHOE. All Rights Reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
