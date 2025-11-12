// RealScout Widget Loader
// This ensures the RealScout script loads properly

let scriptLoaded = false;
let scriptLoading = false;

export function loadRealScoutScript() {
  // Return if already loaded or currently loading
  if (scriptLoaded) {
    return Promise.resolve();
  }

  if (scriptLoading) {
    // Wait for existing load to complete
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (scriptLoaded) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  scriptLoading = true;

  return new Promise((resolve, reject) => {
    // Check if script already exists and is loaded
    const existingScript = document.querySelector('script[src*="realscout"]');
    if (existingScript) {
      // Check if custom elements are already registered
      if (window.customElements && 
          (window.customElements.get('realscout-simple-search') || 
           document.querySelector('realscout-simple-search'))) {
        scriptLoaded = true;
        scriptLoading = false;
        resolve();
        return;
      }
      // Script exists but elements not registered yet - wait a bit
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (window.customElements && 
            (window.customElements.get('realscout-simple-search') || 
             document.querySelector('realscout-simple-search'))) {
          clearInterval(checkInterval);
          scriptLoaded = true;
          scriptLoading = false;
          resolve();
        } else if (attempts > 50) { // 5 seconds max wait
          clearInterval(checkInterval);
          scriptLoading = false;
          // Script might be loading from index.html, resolve anyway
          scriptLoaded = true;
          resolve();
        }
      }, 100);
      return;
    }

    // Create and load the script dynamically
    const script = document.createElement('script');
    script.src = 'https://em.realscout.com/widgets/realscout-web-components.umd.js';
    script.type = 'module';
    script.async = true;
    
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      // Give it a moment for the custom elements to register
      setTimeout(() => resolve(), 200);
    };
    
    script.onerror = () => {
      scriptLoading = false;
      console.error('Failed to load RealScout script');
      // Don't reject - might work from index.html
      scriptLoaded = true;
      resolve();
    };
    
    document.head.appendChild(script);
  });
}

