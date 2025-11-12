import React from "react";

const categories = [
  {
    title: "Northern Colorado Single-Family Homes",
    href: "#contact",
    image:
      "https://images.unsplash.com/photo-1501183638710-841dd1904471?q=80&w=2069&auto=format&fit=crop",
  },
  {
    title: "Northern Colorado Multi-Family Homes",
    href: "#contact",
    image:
      "https://images.unsplash.com/photo-1460317442991-0ec209397118?q=80&w=2070&auto=format&fit=crop",
  },
  {
    title: "Northern Colorado Waterfront Homes",
    href: "#contact",
    image:
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=2069&auto=format&fit=crop",
  },
  {
    title: "Northern Colorado New Construction",
    href: "#contact",
    image:
      "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2069&auto=format&fit=crop",
  },
  {
    title: "Ranches & Land in Northern Colorado",
    href: "#contact",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=2069&auto=format&fit=crop",
  },
  {
    title: "Northern Colorado Luxury Homes",
    href: "#contact",
    image:
      "https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=2070&auto=format&fit=crop",
  },
];

export default function Explore() {
  return (
    <section id="explore" className="w-full bg-white">
      <div className="w-full px-6 md:px-12 py-16">
        <div className="mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Explore Northern Colorado</h2>
          <p className="mt-2 text-gray-600">
            Find the right lifestyle fit: single-family, multi-family, waterfront, new construction, ranches, and luxury.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="group relative rounded-xl overflow-hidden bg-gray-100 shadow hover:shadow-xl transition-shadow duration-300"
            >
              <div
                className="absolute inset-0 bg-center bg-cover"
                style={{ backgroundImage: `url('${item.image}')` }}
                aria-hidden="true"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" aria-hidden="true" />
              <div className="relative p-6 flex flex-col justify-end min-h-[240px]">
                <h3 className="text-white text-xl font-semibold drop-shadow">
                  {item.title}
                </h3>
                <span className="mt-3 inline-block w-fit px-4 py-2 rounded-md bg-white text-gray-900 font-medium shadow group-hover:translate-y-[-2px] group-hover:shadow-lg transition-all">
                  Explore All
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}