import React, { useState } from 'react';
import { submitChfaLeadForm } from '../utils/api.js';

export default function ChfaLeadForm({ compact = false }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    schoolEmployer: '',
    buyingTimeline: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      await submitChfaLeadForm(formData);
      setSubmitStatus({
        type: 'success',
        message: "Thank you! We'll reach out shortly to help you explore CHFA Schools To Home.",
      });
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        schoolEmployer: '',
        buyingTimeline: '',
        message: '',
      });
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error.message || 'Failed to submit. Please try again or call us at (970) 999-1407.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus?.type === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <p className="text-green-800 text-lg font-semibold">{submitStatus.message}</p>
        <p className="text-green-700 mt-2 text-sm">
          In the meantime, you can verify your employer eligibility at{' '}
          <a
            href="https://www.cde.state.co.us/schoolview/explore/welcome"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Colorado Department of Education
          </a>
          .
        </p>
      </div>
    );
  }

  const inputClass =
    'w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-2';

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white rounded-lg shadow-xl ${compact ? 'p-6' : 'p-8'}`}
      id="chfa-lead-form"
    >
      <h3 className={`font-bold font-serif text-gray-900 ${compact ? 'text-2xl mb-4' : 'text-3xl mb-2'}`}>
        Get Started with CHFA Schools To Home
      </h3>
      {!compact && (
        <p className="text-gray-600 mb-6">
          Tell us a little about yourself and we'll help you understand how this program can work for you.
        </p>
      )}

      {submitStatus?.type === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{submitStatus.message}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="chfa-firstName" className={labelClass}>First Name *</label>
          <input
            type="text"
            id="chfa-firstName"
            name="firstName"
            required
            value={formData.firstName}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="chfa-lastName" className={labelClass}>Last Name *</label>
          <input
            type="text"
            id="chfa-lastName"
            name="lastName"
            required
            value={formData.lastName}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="chfa-email" className={labelClass}>Email *</label>
          <input
            type="email"
            id="chfa-email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="chfa-phone" className={labelClass}>Phone *</label>
          <input
            type="tel"
            id="chfa-phone"
            name="phone"
            required
            value={formData.phone}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="chfa-schoolEmployer" className={labelClass}>
          School or District Employer *
        </label>
        <input
          type="text"
          id="chfa-schoolEmployer"
          name="schoolEmployer"
          required
          placeholder="e.g. Poudre School District, Rocky Mountain High School"
          value={formData.schoolEmployer}
          onChange={handleChange}
          className={inputClass}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="chfa-buyingTimeline" className={labelClass}>When are you hoping to buy?</label>
        <select
          id="chfa-buyingTimeline"
          name="buyingTimeline"
          value={formData.buyingTimeline}
          onChange={handleChange}
          className={inputClass}
        >
          <option value="">Select a timeline</option>
          <option value="Just researching">Just researching</option>
          <option value="Within 1-3 months">Within 1–3 months</option>
          <option value="Within 3-6 months">Within 3–6 months</option>
          <option value="6+ months">6+ months</option>
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="chfa-message" className={labelClass}>Questions or comments</label>
        <textarea
          id="chfa-message"
          name="message"
          rows="3"
          placeholder="Tell us about your home buying goals..."
          value={formData.message}
          onChange={handleChange}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Submitting...' : 'Request a Free Consultation'}
      </button>

      <p className="text-xs text-gray-500 mt-4 text-center">
        By submitting, you agree to be contacted about CHFA Schools To Home and home buying services.
      </p>
    </form>
  );
}
