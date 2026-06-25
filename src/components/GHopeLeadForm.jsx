import React, { useState } from 'react';
import { submitGhopeLeadForm } from '../utils/api.js';
import { withLeadMetadata } from '../utils/leadTracking.js';

const targetZones = [
  'Zone 1 — East of 8th Avenue (up to $8,000)',
  'Zone 2 — 14th–17th & 8th Avenues area (up to $6,000)',
  'Zone 3 — West of 14th & 17th Avenues (up to $4,000)',
  'Zone 4 — Eligible area (up to $2,500)',
  'Not sure yet — east of 35th Avenue in Greeley',
];

export default function GHopeLeadForm({ compact = false, sourcePage = '/greeley-g-hope-down-payment-assistance/' }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    employerName: '',
    targetZone: '',
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
      await submitGhopeLeadForm(withLeadMetadata(formData, sourcePage));
      setSubmitStatus({
        type: 'success',
        message: "Thank you! We'll reach out to help you explore G-HOPE and Greeley home buying options.",
      });
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        employerName: '',
        targetZone: '',
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
          Final G-HOPE eligibility is determined by the City of Greeley Housing Solutions team. We can help you find qualifying homes and navigate the purchase alongside your lender.
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
      className={`bg-white rounded-lg shadow-xl scroll-mt-28 ${compact ? 'p-4 sm:p-6' : 'p-6 sm:p-8'}`}
      id="g-hope-lead-form"
    >
      <h3 className={`font-bold font-serif text-gray-900 ${compact ? 'text-xl sm:text-2xl mb-4' : 'text-2xl sm:text-3xl mb-2'}`}>
        {compact ? 'Free G-HOPE Consultation' : 'Get Help With G-HOPE & Greeley Home Buying'}
      </h3>
      {!compact && (
        <p className="text-gray-600 mb-6">
          Work full-time for a Greeley-area employer? Tell us about your goals. Adam and Mandi Schwartz help employees navigate Greeley purchases and down payment programs.
        </p>
      )}

      {submitStatus?.type === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{submitStatus.message}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="ghope-firstName" className={labelClass}>First Name *</label>
          <input type="text" id="ghope-firstName" name="firstName" required value={formData.firstName} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label htmlFor="ghope-lastName" className={labelClass}>Last Name *</label>
          <input type="text" id="ghope-lastName" name="lastName" required value={formData.lastName} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="ghope-email" className={labelClass}>Email *</label>
          <input type="email" id="ghope-email" name="email" required value={formData.email} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label htmlFor="ghope-phone" className={labelClass}>Phone *</label>
          <input type="tel" id="ghope-phone" name="phone" required value={formData.phone} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="ghope-employerName" className={labelClass}>Employer (Greeley-area) *</label>
        <input
          type="text"
          id="ghope-employerName"
          name="employerName"
          required
          placeholder="e.g. City of Greeley, UNC, local business in Greeley"
          value={formData.employerName}
          onChange={handleChange}
          className={inputClass}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="ghope-targetZone" className={labelClass}>Target purchase area in Greeley</label>
        <select id="ghope-targetZone" name="targetZone" value={formData.targetZone} onChange={handleChange} className={inputClass}>
          <option value="">Select a zone (if known)</option>
          {targetZones.map((zone) => (
            <option key={zone} value={zone}>{zone}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="ghope-buyingTimeline" className={labelClass}>When are you hoping to buy?</label>
        <select id="ghope-buyingTimeline" name="buyingTimeline" value={formData.buyingTimeline} onChange={handleChange} className={inputClass}>
          <option value="">Select a timeline</option>
          <option value="Just researching">Just researching</option>
          <option value="Within 1-3 months">Within 1–3 months</option>
          <option value="Within 3-6 months">Within 3–6 months</option>
          <option value="6+ months">6+ months</option>
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="ghope-message" className={labelClass}>Questions or comments</label>
        <textarea
          id="ghope-message"
          name="message"
          rows="3"
          placeholder="Tell us about neighborhoods you are considering in Greeley..."
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
        {isSubmitting ? 'Submitting...' : 'Request Free Consultation'}
      </button>

      <p className="text-xs text-gray-500 mt-4 text-center">
        By submitting, you agree to be contacted about G-HOPE, Greeley home buying, and related services. Program eligibility is determined by the City of Greeley.
      </p>
    </form>
  );
}
