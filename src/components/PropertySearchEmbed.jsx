import React, { useEffect, useRef } from 'react';

export default function PropertySearchEmbed({ location, height = '800px' }) {
  const iframeRef = useRef(null);

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

  // Scroll page to top when iframe loads
  const handleIframeLoad = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    
    // Try to scroll iframe content (may not work due to cross-origin restrictions)
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.scrollTo(0, 0);
      } catch (e) {
        // Cross-origin restriction - this is expected for external iframes
      }
    }
  };

  // Scroll to top when location changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location]);

  return (
    <div className="w-full relative" style={{ height, overflow: 'visible' }}>
      <iframe
        ref={iframeRef}
        src={searchUrl}
        className="w-full h-full border-0"
        title="Property Search"
        allow="geolocation"
        onLoad={handleIframeLoad}
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

