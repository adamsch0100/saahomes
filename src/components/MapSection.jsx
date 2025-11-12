import React, { useEffect, useRef, useState } from "react";

export default function MapSection() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [hoveredArea, setHoveredArea] = useState(null);

  const areas = [
    { name: "Fort Collins", coords: [-105.0844, 40.5853], link: "https://www.realscout.com/search?agent_id=251929&location=Fort%20Collins,%20CO", url: "/northern-colorado-areas/fort-collins/" },
    { name: "Loveland", coords: [-105.0750, 40.3978], link: "https://www.realscout.com/search?agent_id=251929&location=Loveland,%20CO", url: "/northern-colorado-areas/loveland/" },
    { name: "Windsor", coords: [-104.9014, 40.4775], link: "https://www.realscout.com/search?agent_id=251929&location=Windsor,%20CO", url: "/northern-colorado-areas/windsor/" },
    { name: "Greeley", coords: [-104.7091, 40.4233], link: "https://www.realscout.com/search?agent_id=251929&location=Greeley,%20CO", url: "/northern-colorado-areas/greeley/" },
    { name: "Timnath", coords: [-104.9897, 40.5286], link: "https://www.realscout.com/search?agent_id=251929&location=Timnath,%20CO", url: "/northern-colorado-areas/timnath/" },
    { name: "Wellington", coords: [-105.0086, 40.7031], link: "https://www.realscout.com/search?agent_id=251929&location=Wellington,%20CO", url: "/northern-colorado-areas/wellington/" },
    { name: "Johnstown", coords: [-104.9111, 40.3369], link: "https://www.realscout.com/search?agent_id=251929&location=Johnstown,%20CO", url: "/northern-colorado-areas/johnstown/" },
    { name: "Eaton", coords: [-104.7147, 40.5308], link: "https://www.realscout.com/search?agent_id=251929&location=Eaton,%20CO", url: "/northern-colorado-areas/eaton/" },
    { name: "Milliken", coords: [-104.8544, 40.3294], link: "https://www.realscout.com/search?agent_id=251929&location=Milliken,%20CO", url: "/northern-colorado-areas/milliken/" },
    { name: "La Salle", coords: [-104.7019, 40.3478], link: "https://www.realscout.com/search?agent_id=251929&location=LaSalle,%20CO", url: "/northern-colorado-areas/la-salle/" },
    { name: "Mead", coords: [-105.0036, 40.2333], link: "https://www.realscout.com/search?agent_id=251929&location=Mead,%20CO", url: "/northern-colorado-areas/mead/" },
    { name: "Longmont", coords: [-105.1019, 40.1672], link: "https://www.realscout.com/search?agent_id=251929&location=Longmont,%20CO", url: "/northern-colorado-areas/longmont/" },
    { name: "Boulder", coords: [-105.2705, 40.0150], link: "https://www.realscout.com/search?agent_id=251929&location=Boulder,%20CO", url: "/northern-colorado-areas/boulder/" },
  ];

  useEffect(() => {
    // Only initialize once
    if (map.current) return;
    if (!mapContainer.current) return;

    // Check if Mapbox is already loaded
    if (window.mapboxgl) {
      initMap();
    } else {
      // Load Mapbox CSS
      const link = document.createElement('link');
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      // Load Mapbox JS
      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
      script.onload = initMap;
      document.head.appendChild(script);
    }

    function initMap() {
      if (!window.mapboxgl || !mapContainer.current || map.current) return;

      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = 'pk.eyJ1IjoiYWdlbnRmaXJlY29ycCIsImEiOiJjamp5Y3RkaWIwMDVrM2pvdHVzcmxvdXd1In0.0mhs52YCgV45qwNh9f7qpw';

      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-105.0, 40.35],
        zoom: 8.5
      });

      // Add navigation controls
      map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

      // Add markers after map loads
      map.current.on('load', () => {
        areas.forEach((area) => {
          // Create marker element
          const el = document.createElement('div');
          el.className = 'custom-map-marker';
          el.innerHTML = `
            <svg width="20" height="28" viewBox="0 0 30 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 0C6.716 0 0 6.716 0 15C0 22.5 15 40 15 40C15 40 30 22.5 30 15C30 6.716 23.284 0 15 0Z" fill="#000"/>
              <circle cx="15" cy="15" r="6" fill="#fff"/>
            </svg>
          `;
          el.style.cursor = 'pointer';
          el.style.width = '20px';
          el.style.height = '28px';

          // Create popup
          const popup = new mapboxgl.Popup({
            offset: 25,
            closeButton: false,
            closeOnClick: false,
            maxWidth: '300px'
          }).setHTML(`
            <div style="padding: 16px; text-align: center;">
              <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #000;">${area.name}</h3>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <a href="${area.link}" target="_blank" rel="noopener noreferrer" 
                   style="padding: 10px 20px; background: #000; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: block;">
                  Search Homes
                </a>
                <a href="${area.url}" 
                   style="padding: 10px 20px; background: #CFB36E; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: block;">
                  Learn More
                </a>
              </div>
            </div>
          `);

          // Add marker
          const marker = new mapboxgl.Marker(el)
            .setLngLat(area.coords)
            .setPopup(popup)
            .addTo(map.current);

          // Show popup on hover
          el.addEventListener('mouseenter', () => {
            popup.addTo(map.current);
            el.querySelector('path').setAttribute('fill', '#CFB36E');
          });

          el.addEventListener('mouseleave', () => {
            setTimeout(() => {
              const popupEl = document.querySelector('.mapboxgl-popup');
              if (popupEl && !popupEl.matches(':hover')) {
                popup.remove();
                el.querySelector('path').setAttribute('fill', '#000');
              }
            }, 200);
          });

          markersRef.current.push(marker);
        });
      });
    }

    return () => {
      // Cleanup
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return (
    <section className="w-full bg-gray-50 py-20">
      <style>{`
        .mapboxgl-popup {
          z-index: 1000;
        }
        .mapboxgl-popup-content {
          padding: 0;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          border-radius: 8px;
        }
        .mapboxgl-popup-tip {
          border-top-color: white;
        }
        .custom-map-marker svg {
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
          transition: all 0.3s ease;
        }
        .custom-map-marker:hover svg {
          filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4));
        }
      `}</style>
      
      <div className="w-full px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold text-gray-600 uppercase tracking-widest mb-4">Areas of Service</p>
            
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Explore The Area Using Our Map
            </h2>
            
            <p className="text-lg text-gray-700 max-w-3xl mx-auto leading-relaxed">
              With all of the beauty that Northern Colorado has to offer, it's hard to find the perfect place to call home. Our area guides simplify that process by giving you unique market, lifestyle, and demographic insights into each area!
            </p>
          </div>

          {/* Interactive Mapbox Map */}
          <div className="bg-white rounded-lg shadow-xl overflow-hidden mb-8">
            <div 
              ref={mapContainer} 
              className="w-full h-[600px]"
            />
          </div>

          {/* Quick Area Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            {areas.map((area, index) => (
              <a
                key={index}
                href={area.link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 bg-white border-2 border-gray-200 rounded-lg text-center font-semibold text-gray-800 hover:bg-black hover:text-white hover:border-black transition-all text-sm"
              >
                {area.name}
              </a>
            ))}
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <a
              href="/featured-areas/"
              className="inline-flex items-center justify-center px-10 py-4 bg-gray-900 text-white font-semibold rounded-lg shadow-lg hover:bg-gray-800 transform hover:scale-105 transition-all"
            >
              Explore All Areas
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
