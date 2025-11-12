# Assets That Need to Be Downloaded

## ⚠️ CRITICAL ISSUE
Your website currently references **78 assets** hosted on `https://assets.thesparksite.com/` (your old website). These will break when you change hosting.

## Assets from thesparksite.com

### Logo & Branding
- `/uploads/sites/4167/2022/11/White-Logo-AUTOx110.fit.png` (used in Header, Footer, SEO)

### Hero Section
- `/video/pay-it-forward-homes.com/Adam%20Shwartz%20Video%20Compressed.mp4` (hero video)
- `/uploads/sites/4167/2022/11/saahomescom-homepage-video-Moment.jpg` (video poster)

### About Section
- `/uploads/sites/4167/2023/02/About-new-image-1-1.jpg` (AboutSection component)
- `/uploads/sites/4167/2022/11/Gold-Pseudo-1.png` (decorative element)
- `/uploads/sites/4167/2022/12/About-Hero.jpg` (AboutPage hero)
- `/uploads/sites/4167/2022/12/About-Img-1-1-1.jpg` (AboutPage image)
- `/uploads/sites/4167/2023/06/DSC04698.jpg` (AboutPage image)

### Service Section
- `/uploads/sites/4167/2022/11/Shwartz-CTA-Buyers.jpg` (ServiceSection)
- `/uploads/sites/4167/2022/11/Shwartz-CTA-Sellers.jpg` (ServiceSection)

### Coffee Section
- `/uploads/sites/4167/2022/11/Cooffee-2-120xAUTO.fit.png` (CoffeeSection)

### Area Pages (Featured Areas)
- `/uploads/sites/4167/2022/11/fort-collins-min.jpg`
- `/uploads/sites/4167/2022/11/loveland-min.jpg`
- `/uploads/sites/4167/2022/11/windsor-min.jpg`
- `/uploads/sites/4167/2022/11/greeley-min.jpg`
- `/uploads/sites/4167/2022/11/timnath-min.jpg`
- `/uploads/sites/4167/2022/11/wellington-min.jpg`
- `/uploads/sites/4167/2022/11/johnstown-min.jpg`
- `/uploads/sites/4167/2022/11/eaton-min.jpg`
- `/uploads/sites/4167/2022/11/milliken-min.jpg`
- `/uploads/sites/4167/2022/11/la-salle-min.jpg`
- `/uploads/sites/4167/2022/11/northern-colorado-mountains.jpg` (used for Boulder, Longmont, Mead)

### Other Pages
- `/uploads/sites/4167/2022/12/sell-hero-1.jpg` (ForSellersPage)
- `/uploads/sites/4167/2022/12/sell-cta-1-1-1.jpg` (ForSellersPage)
- `/uploads/sites/4167/2022/11/core-image-8.jpg` (ForBuyersPage)
- `/uploads/sites/4167/2022/12/6-1.jpg` (ContactPage)

## External Assets (Unsplash - Optional but Recommended)
These are stock photos from Unsplash. They should work, but downloading them ensures reliability:
- Various Unsplash images in `Explore.jsx`, `About.jsx`, and `PropertyCategories.jsx`

## Solution Steps

1. **Download all assets** from `https://assets.thesparksite.com/` to `public/images/` (or `public/videos/` for video)
2. **Update all references** in your code to use relative paths like `/images/filename.jpg` instead of absolute URLs
3. **Remove the preconnect** from `index.html` that points to thesparksite.com

## Total Unique Assets: ~25 images + 1 video

