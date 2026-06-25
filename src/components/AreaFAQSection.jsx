import React from 'react';

const GOLD = '#CFB36E';

export default function AreaFAQSection({ faqs, city }) {
  if (!faqs || faqs.length === 0) return null;

  return (
    <section className="py-16 px-6 bg-white" id={`${city.toLowerCase().replace(/\s+/g, '-')}-faq`}>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4 text-center">
          Frequently asked questions about {city}, CO real estate
        </h2>
        <p className="text-lg text-gray-700 mb-10 text-center max-w-3xl mx-auto">
          Common questions from Northern Colorado home buyers and sellers about living in and moving to {city}.
        </p>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <details
              key={index}
              className="group bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
                <h3 className="text-lg font-bold font-serif pr-4">{faq.q}</h3>
                <span
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-white text-sm font-bold transition-transform duration-200 group-open:rotate-180"
                  style={{ backgroundColor: GOLD }}
                >
                  ▼
                </span>
              </summary>
              <div className="px-6 pb-6 pt-0 text-gray-700 leading-relaxed border-t border-gray-50">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
