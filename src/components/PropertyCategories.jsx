import React from "react";

const categories = [
  {
    title: "Northern Colorado Single-Family Homes",
    href: "/single-family-homes/",
    image: "https://images.unsplash.com/photo-1501183638710-841dd1904471?q=80&w=2069&auto=format&fit=crop",
  },
  {
    title: "Northern Colorado Multi-Family Homes",
    href: "/multi-family-homes/",
    image: "https://images.unsplash.com/photo-1460317442991-0ec209397118?q=80&w=2070&auto=format&fit=crop",
  },
  {
    title: "Northern Colorado Waterfront Homes",
    href: "/waterfront-homes/",
    image: "https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=2069&auto=format&fit=crop",
  },
  {
    title: "Northern Colorado New Construction",
    href: "/new-construction/",
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2069&auto=format&fit=crop",
  },
  {
    title: "Northern Colorado Condominiums",
    href: "/condominiums/",
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=2069&auto=format&fit=crop",
  },
];

export default function PropertyCategories() {
  return (
    <section className="w-full bg-white py-16">
      <div className="w-full px-6 md:px-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {categories.map((item, idx) => (
            <a
              key={idx}
              href={item.href}
              className="group relative rounded-xl overflow-hidden bg-gray-100 shadow-lg hover:shadow-xl transition-shadow duration-300"
            >
              <div
                className="absolute inset-0 bg-center bg-cover transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundImage: `url('${item.image}')` }}
                aria-hidden="true"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" aria-hidden="true" />
              <div className="relative p-6 flex flex-col justify-end min-h-[280px]">
                <span className="text-white text-sm font-semibold mb-2">Explore All</span>
                <h3 className="text-white text-xl font-bold drop-shadow-lg">
                  {item.title}
                </h3>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
