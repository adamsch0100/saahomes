import React, { useEffect, useRef } from 'react';
import { loadRealScoutScript } from '../utils/realscout.js';

export function RealScoutSimpleSearch({ agentEncodedId, location }) {
  const containerRef = useRef(null);

  useEffect(() => {
    loadRealScoutScript().then(() => {
      if (containerRef.current) {
        // Clear any existing content
        containerRef.current.innerHTML = '';
        
        // Create the custom element
        const widget = document.createElement('realscout-simple-search');
        widget.setAttribute('agent-encoded-id', agentEncodedId || 'QWdlbnQtMjUxOTI5');
        if (location) {
          widget.setAttribute('location', location);
        }
        
        containerRef.current.appendChild(widget);
      }
    }).catch((error) => {
      console.error('Error loading RealScout widget:', error);
    });
  }, [agentEncodedId, location]);

  return <div ref={containerRef} />;
}

export function RealScoutHomeValue({ agentEncodedId }) {
  const containerRef = useRef(null);

  useEffect(() => {
    loadRealScoutScript().then(() => {
      if (containerRef.current) {
        // Clear any existing content
        containerRef.current.innerHTML = '';
        
        // Create the custom element
        const widget = document.createElement('realscout-home-value');
        widget.setAttribute('agent-encoded-id', agentEncodedId || 'QWdlbnQtMjUxOTI5');
        
        containerRef.current.appendChild(widget);
      }
    }).catch((error) => {
      console.error('Error loading RealScout widget:', error);
    });
  }, [agentEncodedId]);

  return <div ref={containerRef} />;
}

export function RealScoutAdvancedSearch({ agentEncodedId }) {
  const containerRef = useRef(null);

  useEffect(() => {
    loadRealScoutScript().then(() => {
      if (containerRef.current) {
        // Clear any existing content
        containerRef.current.innerHTML = '';
        
        // Create the custom element
        const widget = document.createElement('realscout-advanced-search');
        widget.setAttribute('agent-encoded-id', agentEncodedId || 'QWdlbnQtMjUxOTI5');
        
        containerRef.current.appendChild(widget);
      }
    }).catch((error) => {
      console.error('Error loading RealScout widget:', error);
    });
  }, [agentEncodedId]);

  return <div ref={containerRef} />;
}

