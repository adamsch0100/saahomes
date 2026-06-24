import React, { useState } from 'react';
import { submitChfaDpaLeadForm } from '../utils/api.js';
import { withLeadMetadata } from '../utils/leadTracking.js';

const buyerStatuses = [
  'First-time homebuyer',
  'First-generation homebuyer',
  'Qualified veteran',
  'Buying in a targeted area (not first-time)',
  'Not sure — need help determining eligibility',
];

const targetCounties = [
  'Larimer County (Fort Collins, Loveland, Wellington)',
  'Weld County (Greeley, Windsor, Eaton)',
  'Other Colorado county',
  'Not sure yet',
];

export default function ChfaDpaLeadForm({ compact = false, sourcePage = '/chfa-down-payment-assistance/' }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    buyerStatus: '',
    targetCounty: '',
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
      await submitChfaDpaLeadForm(withLeadMetadata(formData, sourcePage));
      setSubmitStatus({
        type: 'success',
        message: "Thank you! We'll reach out to help you explore CHFA down payment assistance options.",
      });
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        buyerStatus: '',
        targetCounty: '',
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
          A CHFA Participating Lender will confirm your exact program eligibility. We can help connect you with lenders and guide your Northern Colorado home search.
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
      id="chfa-dpa-lead-form"
    >
      <h3 className={`font-bold font-serif text-gray-900 ${compact ? 'text-xl sm:text-2xl mb-4' : 'text-2xl sm:text-3xl mb-2'}`}>
        {compact ? 'Free CHFA Consultation' : 'Get Your Free CHFA Home Buying Consultation'}
      </h3>
      {!compact && (
        <p className="text-gray-600 mb-6">
          Tell us about your home buying goals. We will help you understand which CHFA programs may fit and how to get started in Northern Colorado.
        </p>
      )}

      {submitStatus?.type === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{submitStatus.message}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="chfa-dpa-firstName" className={labelClass}>First Name *</label>
          <input type="text" id="chfa-dpa-firstName" name="firstName" required value={formData.firstName} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label htmlFor="chfa-dpa-lastName" className={labelClass}>Last Name *</label>
          <input type="text" id="chfa-dpa-lastName" name="lastName" required value={formData.lastName} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="chfa-dpa-email" className={labelClass}>Email *</label>
          <input type="email" id="chfa-dpa-email" name="email" required value={formData.email} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label htmlFor="chfa-dpa-phone" className={labelClass}>Phone *</label>
          <input type="tel" id="chfa-dpa-phone" name="phone" required value={formData.phone} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="chfa-dpa-buyerStatus" className={labelClass}>Buyer status *</label>
        <select id="chfa-dpa-buyerStatus" name="buyerStatus" required value={formData.buyerStatus} onChange={handleChange} className={inputClass}>
          <option value="">Select your status</option>
          {buyerStatuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="chfa-dpa-targetCounty" className={labelClass}>Where are you looking to buy?</label>
        <select id="chfa-dpa-targetCounty" name="targetCounty" value={formData.targetCounty} onChange={handleChange} className={inputClass}>
          <option value="">Select a county</option>
          {targetCounties.map((county) => (
            <option key={county} value={county}>{county}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="chfa-dpa-buyingTimeline" className={labelClass}>When are you hoping to buy?</label>
        <select id="chfa-dpa-buyingTimeline" name="buyingTimeline" value={formData.buyingTimeline} onChange={handleChange} className={inputClass}>
          <option value="">Select a timeline</option>
          <option value="Just researching">Just researching</option>
          <option value="Within 1-3 months">Within 1–3 months</option>
          <option value="Within 3-6 months">Within 3–6 months</option>
          <option value="6+ months">6+ months</option>
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="chfa-dpa-message" className={labelClass}>Questions or comments</label>
        <textarea
          id="chfa-dpa-message"
          name="message"
          rows="3"
          placeholder="Tell us about your budget, target areas, or CHFA questions..."
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
        By submitting, you agree to be contacted about CHFA programs and home buying services. SAA Homes is not a lender.
      </p>
    </form>
  );
}
