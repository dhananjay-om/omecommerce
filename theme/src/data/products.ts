export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  category: string;
  subcategory: string;
  gender: "women" | "men" | "unisex";
  images: string[];
  sizes: string[];
  colors: { name: string; hex: string }[];
  rating: number;
  reviews: number;
  description: string;
  details: string[];
  isNew?: boolean;
  isBestseller?: boolean;
  tags: string[];
}

export const products: Product[] = [
  {
    id: "p001",
    name: "Silk Slip Midi Dress",
    brand: "Maison Élume",
    price: 8990,
    originalPrice: 12990,
    discount: 31,
    category: "women",
    subcategory: "dresses",
    gender: "women",
    images: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: [
      { name: "Champagne", hex: "#D4B896" },
      { name: "Midnight", hex: "#1A1A2E" },
      { name: "Blush", hex: "#F2C2B1" },
    ],
    rating: 4.7,
    reviews: 238,
    description: "A luxuriously fluid silk slip dress that effortlessly transitions from day to evening. Cut on the bias for a flattering silhouette with adjustable satin straps.",
    details: ["100% Pure Silk", "Bias cut construction", "Adjustable satin straps", "Midi length", "Dry clean recommended"],
    isNew: false,
    isBestseller: true,
    tags: ["silk", "midi", "slip dress", "evening"],
  },
  {
    id: "p002",
    name: "Structured Blazer",
    brand: "Atelier V",
    price: 11500,
    originalPrice: 15000,
    discount: 23,
    category: "women",
    subcategory: "outerwear",
    gender: "women",
    images: [
      "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: [
      { name: "Ivory", hex: "#F5F0E8" },
      { name: "Onyx", hex: "#1C1C1C" },
      { name: "Camel", hex: "#C19A6B" },
    ],
    rating: 4.5,
    reviews: 156,
    description: "A perfectly tailored single-breasted blazer with sharp shoulders and a cinched waist. Versatile enough for boardroom to bar.",
    details: ["Wool-blend fabric", "Single-breasted", "Padded shoulders", "Front welt pockets", "Fully lined", "Dry clean only"],
    isNew: true,
    isBestseller: false,
    tags: ["blazer", "tailored", "work", "formal"],
  },
  {
    id: "p003",
    name: "Wide-Leg Palazzo Pants",
    brand: "Studio Noir",
    price: 5490,
    category: "women",
    subcategory: "bottoms",
    gender: "women",
    images: [
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    colors: [
      { name: "Stone", hex: "#9B9B8C" },
      { name: "Black", hex: "#111111" },
      { name: "Sage", hex: "#8A9E85" },
    ],
    rating: 4.3,
    reviews: 94,
    description: "Effortlessly chic wide-leg palazzo pants in a flowy crepe fabric. High waisted with a wide waistband for a polished silhouette.",
    details: ["100% Viscose crepe", "High-rise waist", "Wide-leg silhouette", "Side zip closure", "Machine washable"],
    isNew: false,
    isBestseller: false,
    tags: ["palazzo", "wide-leg", "casual", "everyday"],
  },
  {
    id: "p004",
    name: "Linen Off-Shoulder Top",
    brand: "Côte Blanc",
    price: 3290,
    originalPrice: 4500,
    discount: 27,
    category: "women",
    subcategory: "tops",
    gender: "women",
    images: [
      "https://images.unsplash.com/photo-1485462537746-965f33f7f6a7?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: [
      { name: "White", hex: "#FFFFFF" },
      { name: "Ecru", hex: "#EDE8DC" },
      { name: "Sky", hex: "#A8CBDF" },
    ],
    rating: 4.6,
    reviews: 312,
    description: "A breezy off-shoulder linen top with an elasticated neckline and relaxed fit. Perfect for warm days and coastal escapes.",
    details: ["100% Linen", "Off-shoulder neckline", "Relaxed fit", "Frayed hem detail", "Machine washable"],
    isNew: false,
    isBestseller: true,
    tags: ["linen", "summer", "casual", "off-shoulder"],
  },
  {
    id: "p005",
    name: "Merino Turtleneck",
    brand: "Nordvik",
    price: 6800,
    category: "women",
    subcategory: "tops",
    gender: "women",
    images: [
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: [
      { name: "Oat", hex: "#E8DCC8" },
      { name: "Charcoal", hex: "#3A3A3A" },
      { name: "Dusty Rose", hex: "#C4908A" },
    ],
    rating: 4.8,
    reviews: 445,
    description: "Ultra-fine merino wool turtleneck that provides warmth without bulk. A wardrobe essential in a versatile palette.",
    details: ["100% Extra-fine Merino wool", "Ribbed turtleneck collar", "Slim fit", "Machine washable at 30°C", "Ethically sourced"],
    isNew: false,
    isBestseller: true,
    tags: ["knitwear", "merino", "winter", "essentials"],
  },
  {
    id: "p006",
    name: "Oxford Button-Down",
    brand: "Percival & Sons",
    price: 4200,
    originalPrice: 5500,
    discount: 24,
    category: "men",
    subcategory: "shirts",
    gender: "men",
    images: [
      "https://images.unsplash.com/photo-1490603708531-f1cf65f53aa6?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: [
      { name: "White", hex: "#FFFFFF" },
      { name: "Blue", hex: "#7CA3C1" },
      { name: "Pink", hex: "#E8B4A8" },
    ],
    rating: 4.4,
    reviews: 189,
    description: "A classic Oxford cloth button-down shirt with a slim tailored fit. Timeless styling meets modern precision.",
    details: ["100% Cotton Oxford cloth", "Button-down collar", "Slim fit", "Single chest pocket", "Machine washable"],
    isNew: false,
    isBestseller: false,
    tags: ["shirt", "oxford", "classic", "work"],
  },
  {
    id: "p007",
    name: "Slim Tapered Chinos",
    brand: "Riven",
    price: 5900,
    category: "men",
    subcategory: "trousers",
    gender: "men",
    images: [
      "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["28", "30", "32", "34", "36"],
    colors: [
      { name: "Khaki", hex: "#C2A97E" },
      { name: "Navy", hex: "#263453" },
      { name: "Stone", hex: "#9B9B8C" },
    ],
    rating: 4.5,
    reviews: 267,
    description: "Slim-tapered chinos with a clean silhouette and premium stretch twill fabric for all-day comfort and style.",
    details: ["98% Cotton, 2% Elastane", "Slim tapered fit", "Mid-rise waist", "Four pocket construction", "Machine washable"],
    isNew: false,
    isBestseller: true,
    tags: ["chinos", "trousers", "casual", "smart-casual"],
  },
  {
    id: "p008",
    name: "Suede Chelsea Boots",
    brand: "Balmera",
    price: 12500,
    originalPrice: 16000,
    discount: 22,
    category: "accessories",
    subcategory: "shoes",
    gender: "men",
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["39", "40", "41", "42", "43", "44", "45"],
    colors: [
      { name: "Tan", hex: "#A0784F" },
      { name: "Black", hex: "#111111" },
    ],
    rating: 4.7,
    reviews: 134,
    description: "Handcrafted suede Chelsea boots with a stacked leather heel and elastic side panels. An investment in lasting style.",
    details: ["Premium suede upper", "Leather lining", "Rubber sole with leather heel", "Elastic side panels", "Pull tab at back"],
    isNew: false,
    isBestseller: false,
    tags: ["chelsea boots", "suede", "formal", "winter"],
  },
  {
    id: "p009",
    name: "Structured Tote Bag",
    brand: "Maison Élume",
    price: 9800,
    category: "accessories",
    subcategory: "bags",
    gender: "women",
    images: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["One Size"],
    colors: [
      { name: "Cognac", hex: "#9B5523" },
      { name: "Black", hex: "#111111" },
      { name: "Ecru", hex: "#EDE8DC" },
    ],
    rating: 4.9,
    reviews: 312,
    description: "A refined structured tote in full-grain leather with a top-zip closure and gold-tone hardware. Spacious enough for daily essentials.",
    details: ["Full-grain leather", "Top-zip closure", "Gold-tone hardware", "Interior zip pocket", "Two interior slip pockets", "14\" W x 11\" H x 5\" D"],
    isNew: true,
    isBestseller: true,
    tags: ["tote", "leather", "everyday", "work"],
  },
  {
    id: "p010",
    name: "Floral Wrap Dress",
    brand: "Studio Noir",
    price: 6700,
    originalPrice: 8500,
    discount: 21,
    category: "women",
    subcategory: "dresses",
    gender: "women",
    images: [
      "https://images.unsplash.com/photo-1572804013427-4d7ca7268217?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["XS", "S", "M", "L", "XL"],
    colors: [
      { name: "Garden", hex: "#7A9E7E" },
      { name: "Terracotta", hex: "#C4786A" },
    ],
    rating: 4.6,
    reviews: 198,
    description: "A romantic floral wrap dress in lightweight georgette with a deep V-neckline and flutter sleeves. The quintessential feminine silhouette.",
    details: ["100% Georgette", "Wrap front with tie closure", "V-neckline", "Flutter sleeves", "Knee length", "Dry clean recommended"],
    isNew: false,
    isBestseller: false,
    tags: ["floral", "wrap dress", "feminine", "spring"],
  },
  {
    id: "p011",
    name: "Cashmere Crewneck",
    brand: "Nordvik",
    price: 14500,
    category: "men",
    subcategory: "knitwear",
    gender: "men",
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: [
      { name: "Oat", hex: "#E8DCC8" },
      { name: "Navy", hex: "#263453" },
      { name: "Burgundy", hex: "#7D2A3C" },
    ],
    rating: 4.9,
    reviews: 521,
    description: "Pure Grade-A cashmere crewneck sweater with a clean, minimal design. A lifetime investment piece crafted to soften with every wear.",
    details: ["100% Grade-A Cashmere", "Two-ply knit", "Crewneck collar", "Ribbed cuffs and hem", "Hand wash or dry clean"],
    isNew: false,
    isBestseller: true,
    tags: ["cashmere", "luxury", "knitwear", "winter"],
  },
  {
    id: "p012",
    name: "Leather Belt",
    brand: "Riven",
    price: 2800,
    category: "accessories",
    subcategory: "accessories",
    gender: "unisex",
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1594938298603-c8148c4b4546?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["S/M", "M/L", "L/XL"],
    colors: [
      { name: "Black", hex: "#111111" },
      { name: "Brown", hex: "#6B4226" },
      { name: "Tan", hex: "#A0784F" },
    ],
    rating: 4.5,
    reviews: 87,
    description: "A slim full-grain leather belt with a brushed silver pin buckle. Made to outlast trends and wardrobes.",
    details: ["Full-grain leather", "Brushed silver buckle", "35mm width", "Punched holes for adjustability"],
    isNew: false,
    isBestseller: false,
    tags: ["belt", "leather", "accessories", "unisex"],
  },
  {
    id: "p013",
    name: "Tailored Suit Jacket",
    brand: "Atelier V",
    price: 18900,
    originalPrice: 24000,
    discount: 21,
    category: "men",
    subcategory: "jackets",
    gender: "men",
    images: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: [
      { name: "Charcoal", hex: "#3A3A3A" },
      { name: "Navy", hex: "#263453" },
      { name: "Tan", hex: "#C2A97E" },
    ],
    rating: 4.8,
    reviews: 203,
    description: "A single-breasted suit jacket cut from Italian wool with a soft construction and precise tailoring. Elevates any occasion.",
    details: ["Italian wool fabric", "Single-breasted two-button", "Notch lapel", "Two flap pockets", "Fully lined", "Dry clean only"],
    isNew: true,
    isBestseller: false,
    tags: ["suit", "jacket", "formal", "tailored"],
  },
  {
    id: "p014",
    name: "Silk Scarf",
    brand: "Côte Blanc",
    price: 3900,
    category: "accessories",
    subcategory: "accessories",
    gender: "unisex",
    images: [
      "https://images.unsplash.com/photo-1601762603339-fd61e28b698a?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["One Size"],
    colors: [
      { name: "Floral Multi", hex: "#E8B4A8" },
      { name: "Geometric Navy", hex: "#263453" },
      { name: "Abstract Gold", hex: "#D4B896" },
    ],
    rating: 4.7,
    reviews: 156,
    description: "A hand-rolled silk twill scarf featuring an exclusive seasonal print. Wear as a hair accessory, neck scarf, or bag charm.",
    details: ["100% Silk twill", "Hand-rolled edges", "90cm x 90cm", "Dry clean only", "Exclusive print"],
    isNew: false,
    isBestseller: false,
    tags: ["scarf", "silk", "accessories", "gift"],
  },
  {
    id: "p015",
    name: "Slip-On Mules",
    brand: "Balmera",
    price: 7200,
    originalPrice: 9500,
    discount: 24,
    category: "accessories",
    subcategory: "shoes",
    gender: "women",
    images: [
      "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["35", "36", "37", "38", "39", "40", "41"],
    colors: [
      { name: "Nude", hex: "#C9A882" },
      { name: "Black", hex: "#111111" },
    ],
    rating: 4.4,
    reviews: 178,
    description: "Minimalist leather mule slides with a block heel and squared toe. Effortlessly polished from office to evening.",
    details: ["Leather upper", "Leather lining", "Block heel 6cm", "Squared toe", "Rubber outsole"],
    isNew: false,
    isBestseller: true,
    tags: ["mules", "heels", "summer", "versatile"],
  },
  {
    id: "p016",
    name: "Mini Crossbody Bag",
    brand: "Maison Élume",
    price: 6500,
    category: "accessories",
    subcategory: "bags",
    gender: "women",
    images: [
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&h=800&fit=crop&auto=format",
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=800&fit=crop&auto=format",
    ],
    sizes: ["One Size"],
    colors: [
      { name: "Black", hex: "#111111" },
      { name: "White", hex: "#F5F0E8" },
      { name: "Red", hex: "#9B2335" },
    ],
    rating: 4.8,
    reviews: 432,
    description: "A compact crossbody in smooth calfskin leather with an adjustable chain strap and magnetic snap closure.",
    details: ["Smooth calfskin leather", "Magnetic snap closure", "Adjustable chain strap", "Interior slip pocket", "18cm W x 14cm H x 6cm D"],
    isNew: true,
    isBestseller: true,
    tags: ["crossbody", "mini bag", "evening", "everyday"],
  },
];

export const categories = [
  {
    id: "women",
    label: "Women",
    subcategories: [
      { id: "dresses", label: "Dresses" },
      { id: "tops", label: "Tops" },
      { id: "bottoms", label: "Bottoms & Skirts" },
      { id: "outerwear", label: "Outerwear" },
      { id: "knitwear", label: "Knitwear" },
      { id: "loungewear", label: "Loungewear" },
    ],
  },
  {
    id: "men",
    label: "Men",
    subcategories: [
      { id: "shirts", label: "Shirts" },
      { id: "trousers", label: "Trousers" },
      { id: "jackets", label: "Jackets" },
      { id: "knitwear", label: "Knitwear" },
      { id: "suits", label: "Suits" },
    ],
  },
  {
    id: "accessories",
    label: "Accessories",
    subcategories: [
      { id: "bags", label: "Bags" },
      { id: "shoes", label: "Shoes" },
      { id: "accessories", label: "Belts & Scarves" },
      { id: "jewelry", label: "Jewellery" },
    ],
  },
];

export const brands = ["Maison Élume", "Atelier V", "Studio Noir", "Côte Blanc", "Nordvik", "Percival & Sons", "Riven", "Balmera"];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getProductsByCategory(category: string, subcategory?: string): Product[] {
  return products.filter(
    (p) => p.category === category && (!subcategory || p.subcategory === subcategory)
  );
}

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q)) ||
      p.subcategory.includes(q)
  );
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(price);
}
