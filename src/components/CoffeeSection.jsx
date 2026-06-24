import React from "react";

export default function CoffeeSection() {
  return (
    <section className="w-full bg-white py-16">
      <div className="w-full px-6 md:px-12">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl shadow-xl p-6 sm:p-10 md:p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
            <img 
              src="/images/Cooffee-2-120xAUTO.fit.png" 
              alt="Coffee"
              className="w-full h-full object-contain"
            />
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Let's Grab Coffee
          </h2>
          <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
            We can discuss your real estate goals over coffee.<br />
            No strings attached, and take it from there.
          </p>
          
          <a
            href="/contact/"
            className="inline-flex items-center justify-center px-10 py-4 bg-gray-900 text-white font-semibold rounded-lg shadow-lg hover:bg-gray-800 transform hover:scale-105 transition-all"
          >
            Book A Slot
          </a>
        </div>
      </div>
    </section>
  );
}

