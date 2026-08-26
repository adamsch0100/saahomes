import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitMarketReportForm } from '../utils/api.js';
import { withLeadMetadata } from '../utils/leadTracking.js';

export default function MarketReportForm({ areaName }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    area: areaName || '',
    address_line: '',
    postal_code: '',
    living_area: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [myHomePath, setMyHomePath] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const payload = {
        ...formData,
        living_area: formData.living_area ? Number(formData.living_area) : undefined,
      };
      const result = await submitMarketReportForm(withLeadMetadata(payload, window.location.pathname));
      const path = result?.my_home_path || (result?.home_profile_id ? '/my-home/' : null);
      setMyHomePath(path);
      setSubmitStatus({
        type: 'success',
        message: path
          ? "Thank you! We'll send your market report shortly — your home is ready on My Home."
          : "Thank you! We'll send you the market report shortly.",
      });
      setFormData({
        firstName: '', lastName: '', email: '', phone: '', area: areaName || '',
        address_line: '', postal_code: '', living_area: '',
      });
    } catch (error) {
      setSubmitStatus({ type: 'error', message: error.message || 'Failed to submit request. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus?.type === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <p className="text-green-800 text-lg font-semibold">
          {submitStatus.message}
        </p>
        {myHomePath && (
          <Link
            to={myHomePath}
            className="mt-4 inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-bold text-black"
            style={{ background: '#CFB36E' }}
          >
            View my home value →
          </Link>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl p-4 sm:p-6 md:p-8" id="market-report">
      {submitStatus?.type === 'error' && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{submitStatus.message}</p>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
            First Name *
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            required
            autoComplete="given-name"
            value={formData.firstName}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
            Last Name *
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            required
            autoComplete="family-name"
            value={formData.lastName}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            required
            autoComplete="tel"
            inputMode="tel"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Optional home address → seller nurture home profile */}
      <details className="mb-6 rounded-lg border border-gray-100 bg-gray-50">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-gray-800 hover:text-black select-none">
          Your home address <span className="font-normal text-gray-400">(optional — unlocks My Home value tracking)</span>
        </summary>
        <div className="px-4 pb-4 grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="address_line" className="block text-xs font-medium text-gray-600 mb-1">Street</label>
            <input
              type="text"
              id="address_line"
              name="address_line"
              autoComplete="street-address"
              value={formData.address_line}
              onChange={handleChange}
              placeholder="123 Main St"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent bg-white"
            />
          </div>
          <div>
            <label htmlFor="postal_code" className="block text-xs font-medium text-gray-600 mb-1">ZIP</label>
            <input
              type="text"
              id="postal_code"
              name="postal_code"
              autoComplete="postal-code"
              value={formData.postal_code}
              onChange={handleChange}
              placeholder="80525"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent bg-white"
            />
          </div>
          <div>
            <label htmlFor="living_area" className="block text-xs font-medium text-gray-600 mb-1">Sqft (optional)</label>
            <input
              type="number"
              id="living_area"
              name="living_area"
              min="0"
              inputMode="numeric"
              value={formData.living_area}
              onChange={handleChange}
              placeholder="e.g. 2100"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent bg-white"
            />
          </div>
        </div>
      </details>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Submitting...' : 'Get Market Report'}
      </button>
      <p className="text-xs text-gray-500 mt-4 text-center">
        No spam — just your personalized market report. Prefer to talk? Call{" "}
        <a href="tel:(970) 999-1407" className="text-gray-700 font-semibold hover:underline">(970) 999-1407</a>.
      </p>
    </form>
  );
}

