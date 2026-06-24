import React, { useState } from "react";
import SEO from "../components/SEO";
import { submitContactForm } from "../utils/api.js";
import { withLeadMetadata } from "../utils/leadTracking.js";
import { BUSINESS } from "../utils/seoConstants.js";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    interest: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <>
      <SEO
        exactTitle="Contact SAA Homes | Northern Colorado Real Estate Agents"
        description="Contact SAA Homes — Northern Colorado real estate agents. Call (970) 999-1407 or email info@saahomes.com. We help buyers and sellers in Fort Collins, Loveland, Windsor, Greeley, and beyond."
        keywords="contact SAA Homes, contact realtor Fort Collins, Northern Colorado real estate contact, Schwartz and Associates phone, real estate inquiry Fort Collins"
        canonical="https://saahomes.com/contact/"
        includeLocalBusiness={true}
      />

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6 bg-cover bg-center" 
        style={{backgroundImage: "url('/images/6-1.jpg')"}}>
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center text-white">
          <h1 className="text-5xl sm:text-6xl font-bold mb-6">Our doors are always open!</h1>
          <p className="text-xl">
            To make the real estate process more pleasurable, Adam and Mandi strive to project positive energy and love to their friends, family, business partners, and clients. We look forward to putting our expertise into action for you!
          </p>
        </div>
      </section>

      {/* Contact Info & Form Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12">
          {/* Contact Information */}
          <div className="bg-gray-50 p-8 rounded-lg">
            <h2 className="text-3xl font-bold mb-6">Contact Information</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Phone number:</h3>
                <a href="tel:(970) 999-1407" className="text-2xl text-blue-600 hover:text-blue-800">
                  (970) 999-1407
                </a>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Email address:</h3>
                <a href="mailto:info@saahomes.com" className="text-2xl text-blue-600 hover:text-blue-800">
                  info@saahomes.com
                </a>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Address:</h3>
                <address className="text-lg not-italic">
                  {BUSINESS.address.streetAddress}<br />
                  {BUSINESS.address.addressLocality}, {BUSINESS.address.addressRegion} {BUSINESS.address.postalCode}
                </address>
              </div>

              <div className="pt-4 flex gap-3">
                <a href="https://www.facebook.com/schwartzandassociateshomes" className="w-10 h-10 border border-gray-800 flex items-center justify-center hover:bg-gray-800 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                </a>
                <a href="https://youtube.com/@SAAHomes" className="w-10 h-10 border border-gray-800 flex items-center justify-center hover:bg-gray-800 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                </a>
                <a href="https://www.instagram.com/saa_homes/" className="w-10 h-10 border border-gray-800 flex items-center justify-center hover:bg-gray-800 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <h2 className="text-3xl font-bold mb-4">Send us a message</h2>
            <p className="text-gray-700 mb-6">
              Fill out your information so we can reach out for a quick discovery call to learn how we can best service your needs.
            </p>
            
            {submitStatus && (
              <div className={`mb-6 p-4 rounded-lg ${
                submitStatus.type === 'success' 
                  ? 'bg-green-50 border border-green-500 text-green-800' 
                  : 'bg-red-50 border border-red-500 text-red-800'
              }`}>
                <p>{submitStatus.message}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  name="name"
                  placeholder="Your name *"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              
              <div>
                <input
                  type="email"
                  name="email"
                  placeholder="Your email address *"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              
              <div>
                <input
                  type="tel"
                  name="phone"
                  placeholder="Your phone number"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              
              <div>
                <select
                  name="interest"
                  value={formData.interest}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">Select an interest</option>
                  <option value="Buying a home">Buying a home</option>
                  <option value="Selling a home">Selling a home</option>
                  <option value="Relocating to the area">Relocating to the area</option>
                  <option value="Media">Media</option>
                  <option value="Area information">Area information</option>
                  <option value="Home valuation">Home valuation</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <textarea
                  name="message"
                  rows="5"
                  placeholder="Comments, questions?"
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
                ></textarea>
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-8 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Map & Additional Info Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="h-96 bg-gray-300 rounded-lg">
            {/* Map iframe would go here */}
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3032.123456789!2d-105.0764!3d40.5853!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDM1JzA3LjEiTiAxMDXCsDA0JzM1LjAiVw!5e0!3m2!1sen!2sus!4v1234567890"
              width="100%"
              height="100%"
              style={{border: 0}}
              allowFullScreen=""
              loading="lazy"
              className="rounded-lg"
            ></iframe>
          </div>
          <div>
            <h2 className="text-4xl font-bold mb-4">We're Proud to be your Colorado real estate experts.</h2>
            <p className="text-lg text-gray-700 mb-6">
              Our Fort Collins office, located in the heart of the old town, is leading the local property market. Our team of real estate professionals is always ready to help you.
            </p>
            <a href="/about-us/" className="inline-block px-8 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors">
              Get to know us
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

