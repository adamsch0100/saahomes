import React, { useState } from 'react';
import { submitChampionsLeadForm } from '../utils/api.js';
import { withLeadMetadata } from '../utils/leadTracking.js';

const responderTypes = [
  'Peace officer',
  'Firefighter',
  'EMT / Paramedic',
  'Corrections officer',
  '911 emergency communications specialist',
  'Wildlife / port of entry officer',
  'Other qualifying first responder',
];

export default function ChampionsLeadForm({ compact = false }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    responderType: '',
    employerAgency: '',
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
      await submitChampionsLeadForm(withLeadMetadata(formData, '/colorado-champions-home-loan-program/'));
      setSubmitStatus({
        type: 'success',
        message: "Thank you! We'll reach out with program updates and local home buying guidance.",
      });
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        responderType: '',
        employerAgency: '',
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
          Many first responders may already qualify under existing CHFA programs. We can help you explore options now while the Champions program is finalized.
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
      id="champions-lead-form"
    >
      <h3 className={`font-bold font-serif text-gray-900 ${compact ? 'text-xl sm:text-2xl mb-4' : 'text-2xl sm:text-3xl mb-2'}`}>
        {compact ? 'Get Program Updates' : 'Sign Up for Champions Program Updates'}
      </h3>
      {!compact && (
        <p className="text-gray-600 mb-6">
          Tell us about your role and home buying goals. We will follow up with guidance as CHFA releases final program details.
        </p>
      )}

      {submitStatus?.type === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{submitStatus.message}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="champions-firstName" className={labelClass}>First Name *</label>
          <input type="text" id="champions-firstName" name="firstName" required value={formData.firstName} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label htmlFor="champions-lastName" className={labelClass}>Last Name *</label>
          <input type="text" id="champions-lastName" name="lastName" required value={formData.lastName} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="champions-email" className={labelClass}>Email *</label>
          <input type="email" id="champions-email" name="email" required value={formData.email} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label htmlFor="champions-phone" className={labelClass}>Phone *</label>
          <input type="tel" id="champions-phone" name="phone" required value={formData.phone} onChange={handleChange} className={inputClass} />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="champions-responderType" className={labelClass}>First Responder Role *</label>
        <select id="champions-responderType" name="responderType" required value={formData.responderType} onChange={handleChange} className={inputClass}>
          <option value="">Select your role</option>
          {responderTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="champions-employerAgency" className={labelClass}>Employer / Agency</label>
        <input
          type="text"
          id="champions-employerAgency"
          name="employerAgency"
          placeholder="e.g. Loveland Fire Rescue, Larimer County Sheriff"
          value={formData.employerAgency}
          onChange={handleChange}
          className={inputClass}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="champions-buyingTimeline" className={labelClass}>When are you hoping to buy?</label>
        <select id="champions-buyingTimeline" name="buyingTimeline" value={formData.buyingTimeline} onChange={handleChange} className={inputClass}>
          <option value="">Select a timeline</option>
          <option value="Just researching">Just researching</option>
          <option value="When program launches">When program launches</option>
          <option value="Within 1-3 months">Within 1–3 months</option>
          <option value="Within 3-6 months">Within 3–6 months</option>
          <option value="6+ months">6+ months</option>
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="champions-message" className={labelClass}>Questions or comments</label>
        <textarea
          id="champions-message"
          name="message"
          rows="3"
          placeholder="Tell us about your home buying goals in Northern Colorado..."
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
        {isSubmitting ? 'Submitting...' : 'Request Local Guidance'}
      </button>

      <p className="text-xs text-gray-500 mt-4 text-center">
        By submitting, you agree to be contacted about the Champions program and home buying services.
      </p>
    </form>
  );
}
