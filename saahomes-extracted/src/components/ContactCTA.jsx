import React from "react";

export default function ContactCTA() {
  return (
    <section id="contact" className="w-full bg-gradient-to-br from-blue-700 to-blue-500 text-white">
      <div className="w-full px-6 md:px-12 py-16">
        <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-8 md:p-10 shadow-xl">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl sm:text-3xl font-bold">Ready to tour or list a home?</h3>
              <p className="mt-3 text-white/90">
                Tell us your goals. We will follow up quickly to help you buy or sell with confidence.
              </p>
            </div>
            <div>
              <form
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  const name = data.get("name");
                  const email = data.get("email");
                  const message = data.get("message");
                  const subject = encodeURIComponent("SAA Homes - Consultation Request");
                  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
                  window.location.href = `mailto:contact@saahomes.com?subject=${subject}&body=${body}`;
                }}
              >
                <input
                  name="name"
                  required
                  type="text"
                  placeholder="Full name"
                  className="px-4 py-3 rounded-md bg-white text-gray-900 placeholder-gray-500 border border-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <input
                  name="email"
                  required
                  type="email"
                  placeholder="Email address"
                  className="px-4 py-3 rounded-md bg-white text-gray-900 placeholder-gray-500 border border-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <textarea
                  name="message"
                  required
                  rows="4"
                  placeholder="How can we help?"
                  className="sm:col-span-2 px-4 py-3 rounded-md bg-white text-gray-900 placeholder-gray-500 border border-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 px-6 py-3 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 hover:shadow-lg transform hover:scale-105 transition-all"
                >
                  Send Message
                </button>
              </form>
              <p className="mt-3 text-white/80 text-sm">
                Prefer email? Write to contact@saahomes.com
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}