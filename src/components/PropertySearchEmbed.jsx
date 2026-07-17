import React from 'react';

const FRAMER_BASE_URL = 'https://www.coloproperty.com/framer/1309';

export default function PropertySearchEmbed({ location, height = '100%' }) {
  // Build the framer URL — coloproperty supports ?city= for location filtering
  let searchUrl = FRAMER_BASE_URL;
  if (location) {
    searchUrl += `?city=${encodeURIComponent(location)}`;
  }

  return (
    <div className="w-full relative" style={{ height, minHeight: '700px' }}>
      <iframe
        src={searchUrl}
        className="w-full h-full border-0"
        title="Northern Colorado Property Search"
        allow="geolocation"
        style={{
          minHeight: '700px',
          width: '100%',
          height: '100%',
        }}
        loading="lazy"
      />
    </div>
  );
}
