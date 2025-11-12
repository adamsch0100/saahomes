import React from "react";

const testimonials = [
  {
    name: "Andy Witt",
    text: "Adam and Mandi were absolutely phenomenal! Would definitely recommend them if you're a first time buyer. Walked me through every step of the process and constantly checked in! You should definitely give them a shout if you're thinking of purchasing a home!",
    rating: 5
  },
  {
    name: "Kevin Freestone",
    text: "💯 the right people to help you get a home. Very responsive, respectful, and professional. Although I may not have been the easiest customer due to unforseen circumstances, they stuck through it with me. Thank you so much for helping me find my dream home!",
    rating: 5
  },
  {
    name: "Josh Sorensen",
    text: "Adam is friendly, professional and easy to talk too. I highly recommend Adam if you're selling/buying your home. You won't be disappointed!",
    rating: 5
  },
  {
    name: "Daen Manriquez",
    text: "Adam is a pleasure to work with. His friendly demeanor and dedication to client satisfaction set him apart. Adam's outstanding service made the home-buying experience a positive one!",
    rating: 5
  },
  {
    name: "Kylie Graff",
    text: "My husband and I just bought our first home, and couldn't have done it with out the knowledge and guidance from the Schwartz team. They were always available to answer any questions, and every house we wanted to look at they made sure we got in. They were very patient and helped us look through many homes before we found the perfect one.",
    rating: 5
  },
  {
    name: "Ana Ssenz",
    text: "Very honest",
    rating: 5
  }
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="w-full bg-gray-900 py-20">
      <div className="w-full px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-white text-center mb-16">
            Success Stories
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow">
                <div className="flex items-center mb-4">
                  <img 
                    src="https://saahomes.com/wp-content/plugins/agentfire-testimonials-v2/images/source/google-small.png" 
                    alt="Google Review"
                    className="w-8 h-8"
                  />
                  <div className="ml-3 flex">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 text-base mb-4 leading-relaxed">
                  "{testimonial.text}"
                </p>
                <p className="font-semibold text-gray-900">
                  — {testimonial.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

