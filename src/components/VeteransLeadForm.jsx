import React, { useState } from 'react';
import { submitContactForm } from '../utils/api.js';
import { withLeadMetadata } from '../utils/leadTracking.js';

const serviceStatuses = [
  'Veteran',
  'Active duty',
  'National Guard / Reserve',
  'Surviving spouse',
  'Not sure — help me check',
];

export default function VeteransLeadForm({ compact = false }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    serviceStatus: '',
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

    const name = `${formData.firstName} ${formData.lastName}`.trim();
    const details = [
      formData.serviceStatus ? `Service status: ${formData.serviceStatus}` : null,
      formData.buyingTimeline ? `Timeline: ${formData.buyingTimeline}` : null,
      formData.message || null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await submitContactForm(
        withLeadMetadata(
          {
            name,
            email: formData.email,
            phone: formData.phone,
            interest: 'Veterans — 0.5% back + VA loan',
            message: details,
          },
          '/veterans/'
        )
      );
      setSubmitStatus({
        type: 'success',
        message: "Thank you. We'll follow up with your 0.5% veteran benefit and VA loan guidance.",
      });
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        serviceStatus: '',
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
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 sm:p-8 text-center">
        <p className="text-green-800 text-lg font-semibold">{submitStatus.message}</p>
        <p className="text-green-700 mt-2 text-sm">
          Prefer to talk now? Call{' '}
          <a href="tel:9709991407" className="font-semibold underline">
            (970) 999-1407
          </a>
          .
        </p>
      </div>
    );
  }

  const inputClass =
    'w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#CFB36E]';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-2';

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white rounded-lg shadow-xl scroll-mt-28 ${compact ? 'p-4 sm:p-6' : 'p-6 sm:p-8'}`}
      id="veterans-lead-form"
    >
      <h3 className={`font-bold font-serif text-gray-900 ${compact ? 'text-xl sm:text-2xl mb-4' : 'text-2xl sm:text-3xl mb-2'}`}>
        {compact ? 'Get your 0.5% veteran benefit' : 'Get your 0.5% veteran benefit + VA loan guidance'}
      </h3>
      {!compact && (
        <p className="text-gray-600 mb-6">
          Tell us about your service and home goals. We will follow up with honest VA loan guidance and how the 0.5% benefit applies to your purchase.
        </p>
      )}

      {submitStatus?.type === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{submitStatus.message}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="veterans-firstName" className={labelClass}>First Name *</label>
          <input type="text" id="veterans-firstName" name="firstName" required value={formData.firstName} onChange={handleChange} className={inputClass} autoComplete="given-name" />
        </div>
        <div>
          <label htmlFor="veterans-lastName" className={labelClass}>Last Name *</label>
          <input type="text" id="veterans-lastName" name="lastName" required value={formData.lastName} onChange={handleChange} className={inputClass} autoComplete="family-name" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="veterans-email" className={labelClass}>Email *</label>
          <input type="email" id="veterans-email" name="email" required value={formData.email} onChange={handleChange} className={inputClass} autoComplete="email" />
        </div>
        <div>
          <label htmlFor="veterans-phone" className={labelClass}>Phone *</label>
          <input type="tel" id="veterans-phone" name="phone" required value={formData.phone} onChange={handleChange} className={inputClass} autoComplete="tel" />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="veterans-serviceStatus" className={labelClass}>Service status *</label>
        <select id="veterans-serviceStatus" name="serviceStatus" required value={formData.serviceStatus} onChange={handleChange} className={inputClass}>
          <option value="">Select one</option>
          {serviceStatuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="veterans-buyingTimeline" className={labelClass}>When are you hoping to buy or relocate?</label>
        <select id="veterans-buyingTimeline" name="buyingTimeline" value={formData.buyingTimeline} onChange={handleChange} className={inputClass}>
          <option value="">Select a timeline</option>
          <option value="Just researching">Just researching</option>
          <option value="PCS / orders pending">PCS / orders pending</option>
          <option value="Within 1-3 months">Within 1–3 months</option>
          <option value="Within 3-6 months">Within 3–6 months</option>
          <option value="6+ months">6+ months</option>
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="veterans-message" className={labelClass}>Questions or comments</label>
        <textarea
          id="veterans-message"
          name="message"
          rows="3"
          placeholder="Tell us about your VA loan, PCS timeline, or Northern Colorado home goals..."
          value={formData.message}
          onChange={handleChange}
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-8 py-3.5 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
      >
        {isSubmitting ? 'Submitting...' : 'Get VA guidance + 0.5% benefit'}
      </button>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Email and phone required. By submitting, you agree to be contacted about veteran home buying services. The 0.5% benefit is disclosed in writing at closing.
      </p>
    </form>
  );
}
