Prepared by analyizing lexsy.ai

**Brand + Asset Inventory (Markdown-ready)**

| Category | Asset | URL | Notes / Suggested Use |
| - | - | - | - |
| Logo | Primary Lexsy logo (multisize WebP/PNG) | `https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/671dd7da409351203f94af52_Lexsy.png` (Srcset includes 500w, 800w, 1080w, 1600w, 2000w) | Use for nav bars, footer branding, hero sections. Transparent background, rectangular aspect. |
| Hero Illustration | Hero dashboard mock | `https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/669e8921529a7f101e0f65ee_5.png` (500/800/1080 variants) | Right-side hero visual paired with “Legal partner on your hero's journey” message. |
| Services Imagery | Startup services graphic | `https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/669ebf714b4a8190b9b18d7c_Untitled%20design%20-%202024-07-22T232151.601.png` (500/800/1080 variants) | Use on “For Startups” tab/card. |
| Services Imagery | Investor services graphic | `https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/650c19023596a7ff47afbcf0_1.png` (500/800/936 variants) | Pair with “For Investors” messaging. |
| Testimonials | Star icon (5-point) | `https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/67171d719a4550c0ba34cbc3_Star%201.svg` | Gold/yellow star used for 5-star ratings. |
| Testimonials | Carousel left arrow | `https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/67171d729a4550c0ba34ccf5_Left%20Arrow.svg` | Use alongside slider nav; stroke-based arrow. |
| Testimonials | Carousel right arrow | `https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/67171d729a4550c0ba34cce6_Right%20Arrow.svg` | Mirror of left arrow. |
| Testimonial Portraits | Oliver Cameron | `https://cdn.prod.website-files.com/65030262282cb8dc8d56f8b8/6717211f9a16352e6269a027_Oliver.jpeg` | Use as circular avatar; many similar assets exist per testimonial (Alan Chiu, etc.). |
| Footer Social | TikTok icon (filled) | `https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/650aa26107b3cdde304d0c2e_ic_baseline-tiktok%20(1).png` | Dark icon for default state. |
| Footer Social | TikTok icon (white) | `https://cdn.prod.website-files.com/65030261282cb8dc8d56f660/66e09972b527ee2c909ef3bf_tiktok.svg` | Hover/contrast version. |
| Footer Social | Instagram SVG | Inline `<svg>` (16x16) in footer markup | Copy/paste the inline SVG for consistent look; uses currentColor to inherit text color. |
| Footer Social | LinkedIn SVG | Inline `<svg>` (16x16) in footer markup | Same instructions as Instagram icon. |
| UI Call-to-Action Texts | Primary CTA | “Apply to Work With Us” button, class `spark-button` / `lawlace-book-a-call rectangle small` | Use for buttons requiring high emphasis. |
| Buttons Secondary | “Learn More” (class `lawlace-black-small-button`) | Applies to secondary CTAs within tabbed content. |
| Form CTA | “Get in touch” submit button | Gradient-styled `cf-form-gradient-submit` button for contact forms. |

**Color / Typography clues (from markup & imagery)**
- Backgrounds appear light/white (`body` default), with dark charcoal copy (`#0F172A`/`#111827`-like) and accent magenta/pink used on CTAs (from imagery). Exact hex values aren’t in the snippet; sample from assets when importing.
- Buttons labeled “Apply to Work With Us” likely use a pink-to-coral gradient (visible in hero screenshot). Sample via any design tool eyedropper once assets are downloaded.
- Typefaces implied by class naming (`lawlace-64px-heading`, etc.), suggesting Webflow-assigned fonts. Inspect live CSS (if accessible) to capture font families (likely `Inter`, `Space Grotesk`, or similar). Current CDN blocks direct download, so plan to grab via browser devtools.
