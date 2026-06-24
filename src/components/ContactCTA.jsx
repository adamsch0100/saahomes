import React, { useState } from "react";
import { submitContactForm } from "../utils/api.js";
import { withLeadMetadata } from "../utils/leadTracking.js";

export default function ContactCTA() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    interest: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      await submitContactForm(withLeadMetadata(formData));
      setSubmitStatus({ type: 'success', message: 'Thank you! We will contact you soon.' });
      setFormData({ name: "", email: "", phone: "", interest: "", message: "" });
    } catch (error) {
      setSubmitStatus({ type: 'error', message: error.message || 'Failed to send message. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="w-full bg-gradient-to-br from-gray-900 to-gray-800 text-white py-20">
      <div className="w-full px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">Ready To Tour Or List A Home?</h2>
            <p className="text-xl text-gray-300">
              Tell us your goals. We will follow up quickly to help you buy or sell with confidence.
            </p>
          </div>
          
          {submitStatus && (
            <div className={`mb-6 p-4 rounded-lg ${
              submitStatus.type === 'success' 
                ? 'bg-green-500/20 border border-green-500' 
                : 'bg-red-500/20 border border-red-500'
            }`}>
              <p className={submitStatus.type === 'success' ? 'text-green-200' : 'text-red-200'}>
                {submitStatus.message}
              </p>
            </div>
          )}

          <form
            className="bg-white/10 backdrop-blur rounded-2xl p-8 md:p-10 shadow-2xl"
            onSubmit={handleSubmit}
          >
            <div className="grid md:grid-cols-2 gap-6">
              <input
                name="name"
                required
                type="text"
                placeholder="Your Name"
                value={formData.name}
                onChange={handleChange}
                className="px-6 py-4 rounded-lg bg-white text-gray-900 placeholder-gray-500 border-2 border-transparent focus:border-blue-500 focus:outline-none transition-colors"
              />
              <input
                name="email"
                required
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                className="px-6 py-4 rounded-lg bg-white text-gray-900 placeholder-gray-500 border-2 border-transparent focus:border-blue-500 focus:outline-none transition-colors"
              />
              <input
                name="phone"
                type="tel"
                placeholder="Phone Number (Optional)"
                value={formData.phone}
                onChange={handleChange}
                className="px-6 py-4 rounded-lg bg-white text-gray-900 placeholder-gray-500 border-2 border-transparent focus:border-blue-500 focus:outline-none transition-colors"
              />
              <select
                name="interest"
                value={formData.interest}
                onChange={handleChange}
                className="px-6 py-4 rounded-lg bg-white text-gray-900 border-2 border-transparent focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="">I'm interested in...</option>
                <option value="buying">Buying a Home</option>
                <option value="selling">Selling a Home</option>
                <option value="both">Both</option>
                <option value="consultation">Just a Consultation</option>
              </select>
            </div>
            <textarea
              name="message"
              required
              rows="5"
              placeholder="Tell us about your real estate goals..."
              value={formData.message}
              onChange={handleChange}
              className="mt-6 w-full px-6 py-4 rounded-lg bg-white text-gray-900 placeholder-gray-500 border-2 border-transparent focus:border-blue-500 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full px-8 py-4 bg-white text-gray-900 font-bold rounded-lg shadow-lg hover:bg-gray-100 transform hover:scale-[1.02] transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
            <p className="mt-4 text-center text-gray-300 text-sm">
              Or email us directly at{" "}
              <a href="mailto:info@saahomes.com" className="text-white font-semibold hover:underline">
                info@saahomes.com
              </a>
              {" "}or call{" "}
              <a href="tel:(970) 999-1407" className="text-white font-semibold hover:underline">
                (970) 999-1407
              </a>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
