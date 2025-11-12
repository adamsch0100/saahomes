import React from 'react';

export default function PropertySearchEmbed({ location, height = '800px' }) {
  // Build the RealScout URL with optional location parameter
  // RealScout supports various URL parameters for filtering
  let searchUrl = 'https://saahomes.realscout.com/homesearch/map?for_sale=1&for_rent=0';
  
  if (location) {
    // Try multiple parameter formats that RealScout might support
    // Some RealScout implementations use 'q' for query, others use 'location'
    // We'll try 'q' first as it's more commonly used for search queries
    const locationParam = encodeURIComponent(location);
    searchUrl += `&q=${locationParam}`;
    // Also add location parameter as fallback
    searchUrl += `&location=${locationParam}`;
  }

  return (
    <div className="w-full relative" style={{ height, overflow: 'visible' }}>
      <iframe
        src={searchUrl}
        className="w-full h-full border-0"
        title="Property Search"
        allow="geolocation"
        style={{ 
          minHeight: height,
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: 'calc(100% + 600px)' // Extend 600px below to hide popup behind footer
        }}
      />
    </div>
  );
}

