const SHOP_CATEGORY_SYSTEM = [
  {
    key: "building-materials",
    label: "Building Materials",
    icon: "🧱",
    description: "Cement, sand, aggregates, blocks and core structural materials"
  },
  {
    key: "steel-roofing",
    label: "Steel, Roofing & Ceiling",
    icon: "🏠",
    description: "Steel bars, metal sections, roofing sheets and ceiling essentials"
  },
  {
    key: "plumbing-sanitary",
    label: "Plumbing & Sanitary",
    icon: "🚰",
    description: "Pipes, fittings, tanks, taps and bathroom-related hardware"
  },
  {
    key: "electrical-lighting",
    label: "Electrical & Lighting",
    icon: "💡",
    description: "Wires, switches, breakers, lighting and electrical accessories"
  },
  {
    key: "paint-finishing",
    label: "Paint & Finishing",
    icon: "🎨",
    description: "Paint, putty, waterproofing and finishing products"
  },
  {
    key: "tools-fasteners",
    label: "Tools & Fasteners",
    icon: "🛠️",
    description: "Power tools, hand tools, nails, screws and site accessories"
  },
  {
    key: "safety-site",
    label: "Safety & Site Essentials",
    icon: "⛑️",
    description: "Helmets, PPE, gloves and on-site safety essentials"
  },
  {
    key: "tiles-adhesives",
    label: "Tiles, Adhesives & Flooring",
    icon: "🧩",
    description: "Tiles, grout, adhesives, flooring and surface solutions"
  }
];

const SHOP_CATEGORY_BY_KEY = Object.fromEntries(SHOP_CATEGORY_SYSTEM.map((item) => [item.key, item]));
const SHOP_CATEGORY_ORDER = new Map(SHOP_CATEGORY_SYSTEM.map((item, index) => [item.key, index]));

const CATEGORY_RULES = [
  {
    key: "plumbing-sanitary",
    keywords: [
      "plumbing",
      "sanitary",
      "bathroom",
      "pipe",
      "pvc",
      "upvc",
      "cpvc",
      "fitting",
      "tap",
      "valve",
      "shower",
      "toilet",
      "sink",
      "drain",
      "gutter",
      "tank",
      "hose",
      "water line",
      "water supply"
    ]
  },
  {
    key: "electrical-lighting",
    keywords: [
      "electrical",
      "lighting",
      "light",
      "wire",
      "cable",
      "socket",
      "switch",
      "breaker",
      "conduit",
      "db box",
      "bulb",
      "fan",
      "chint",
      "kevilton",
      "orange"
    ]
  },
  {
    key: "paint-finishing",
    keywords: [
      "paint",
      "putty",
      "primer",
      "finishing",
      "decorating",
      "waterproof",
      "coating",
      "thinner",
      "skim coat",
      "sealant",
      "woodcare",
      "filler"
    ]
  },
  {
    key: "tiles-adhesives",
    keywords: [
      "tile",
      "grout",
      "adhesive",
      "flooring",
      "floor",
      "mosaic",
      "vinyl",
      "ceramic",
      "porcelain",
      "self leveler"
    ]
  },
  {
    key: "safety-site",
    keywords: [
      "safety",
      "helmet",
      "ppe",
      "glove",
      "boot",
      "mask",
      "goggle",
      "workwear",
      "protective",
      "vest",
      "site light"
    ]
  },
  {
    key: "tools-fasteners",
    keywords: [
      "tool",
      "drill",
      "saw",
      "wrench",
      "spanner",
      "hammer",
      "blade",
      "fastener",
      "nail",
      "screw",
      "bolt",
      "anchor",
      "hilti",
      "chisel",
      "hacker",
      "chemical anchoring",
      "scaffolding wrench"
    ]
  },
  {
    key: "steel-roofing",
    keywords: [
      "steel",
      "tmt",
      "rebar",
      "rod",
      "box bar",
      "roof",
      "roofing",
      "ceiling",
      "lanwa",
      "melwa",
      "gi pipe",
      "galvanized",
      "sheet",
      "zinc",
      "truss"
    ]
  },
  {
    key: "building-materials",
    keywords: [
      "building material",
      "cement",
      "sand",
      "aggregate",
      "metal 1 cube",
      "metal aggregate",
      "brick",
      "block",
      "concrete",
      "masonry",
      "plaster",
      "drywall",
      "insulation",
      "soil",
      "gravel",
      "mortar"
    ]
  }
];

function normalizeText(...values) {
  return values
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (value === undefined || value === null) return [];
      return [value];
    })
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function detectShopCategory(product = {}) {
  const rawCategory = String(product.category || "").trim();
  const directMatch = SHOP_CATEGORY_SYSTEM.find(
    (item) => item.label.toLowerCase() === rawCategory.toLowerCase() || item.key === rawCategory
  );
  if (directMatch) return directMatch;

  const searchText = normalizeText(
    product.name,
    product.category,
    product.subCategory,
    product.brand,
    product.description,
    product.tags
  );

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => searchText.includes(keyword))) {
      return SHOP_CATEGORY_BY_KEY[rule.key];
    }
  }

  return SHOP_CATEGORY_BY_KEY["building-materials"];
}

function getDisplaySubCategory(product = {}, shopCategory = detectShopCategory(product)) {
  const subCategory = String(product.subCategory || "").trim();
  if (subCategory) return subCategory;

  const rawCategory = String(product.category || "").trim();
  if (rawCategory && rawCategory.toLowerCase() !== shopCategory.label.toLowerCase()) {
    return rawCategory;
  }

  return "";
}

function getTagsArray(product = {}) {
  const input = product.tags;
  const tags = Array.isArray(input)
    ? input
    : String(input || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  return tags.map((item) => String(item).trim()).filter(Boolean);
}

function serializeProductForShop(productDoc) {
  const plain = typeof productDoc?.toObject === "function" ? productDoc.toObject() : { ...(productDoc || {}) };
  const shopCategory = detectShopCategory(plain);
  const stockQty = Number(plain.stockQty || 0);
  const tags = getTagsArray(plain);

  return {
    ...plain,
    tags,
    isReturnable: plain.isReturnable !== false,
    nonReturnableReason: String(plain.nonReturnableReason || "").trim(),
    warrantyDays: Number(plain.warrantyDays || 0),
    shopCategoryKey: shopCategory.key,
    shopCategoryLabel: shopCategory.label,
    shopCategoryDescription: shopCategory.description,
    shopCategoryIcon: shopCategory.icon,
    displayCategory: shopCategory.label,
    displaySubCategory: getDisplaySubCategory(plain, shopCategory),
    stockStatus: stockQty <= 0 ? "out-of-stock" : stockQty <= 5 ? "low-stock" : "in-stock"
  };
}

function productMatchesSearch(product, query) {
  const terms = String(query || "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!terms.length) return true;

  const haystack = normalizeText(
    product.name,
    product.description,
    product.brand,
    product.category,
    product.subCategory,
    product.shopCategoryLabel,
    product.displaySubCategory,
    product.tags
  );

  return terms.every((term) => haystack.includes(term));
}

function sortShopProducts(products = [], sort = "featured") {
  const list = [...products];
  const categoryRank = (item) => SHOP_CATEGORY_ORDER.get(item.shopCategoryKey) ?? 999;
  const stockRank = (item) => (Number(item.stockQty || 0) > 0 ? 0 : 1);

  const nameAsc = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));

  if (sort === "price_asc") {
    return list.sort((a, b) => Number(a.priceLKR || 0) - Number(b.priceLKR || 0) || nameAsc(a, b));
  }
  if (sort === "price_desc") {
    return list.sort((a, b) => Number(b.priceLKR || 0) - Number(a.priceLKR || 0) || nameAsc(a, b));
  }
  if (sort === "name_asc") {
    return list.sort(nameAsc);
  }
  if (sort === "newest") {
    return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0) || nameAsc(a, b));
  }

  return list.sort((a, b) => {
    return (
      stockRank(a) - stockRank(b) ||
      categoryRank(a) - categoryRank(b) ||
      nameAsc(a, b)
    );
  });
}

function getCategorySummaries(productDocs = []) {
  const counts = new Map(SHOP_CATEGORY_SYSTEM.map((item) => [item.key, 0]));

  for (const productDoc of productDocs) {
    const product = serializeProductForShop(productDoc);
    counts.set(product.shopCategoryKey, Number(counts.get(product.shopCategoryKey) || 0) + 1);
  }

  return SHOP_CATEGORY_SYSTEM.map((item) => ({
    ...item,
    count: Number(counts.get(item.key) || 0)
  }));
}

function normalizeProductPayload(body = {}, { partial = false } = {}) {
  const out = {};

  const assignString = (key, fallback = "") => {
    if (partial && body[key] === undefined) return;
    out[key] = String(body[key] ?? fallback).trim();
  };

  const assignNumber = (key, fallback = 0) => {
    if (partial && body[key] === undefined) return;
    out[key] = Number(body[key] ?? fallback);
  };

  const assignBoolean = (key, fallback = true) => {
    if (partial && body[key] === undefined) return;
    out[key] = body[key] === undefined ? fallback : !!body[key];
  };

  assignString("name");
  assignString("category", "Building Materials");
  assignString("subCategory", "");
  assignString("brand", "");
  assignNumber("priceLKR", 0);
  assignNumber("stockQty", 0);
  assignString("description", "");
  assignString("imageUrl", "");
  assignBoolean("isActive", true);
  assignBoolean("isReturnable", true);
  assignString("nonReturnableReason", "");
  assignNumber("warrantyDays", 0);

  if (!partial || body.tags !== undefined) {
    out.tags = getTagsArray(body);
  }

  return out;
}

module.exports = {
  SHOP_CATEGORY_SYSTEM,
  serializeProductForShop,
  productMatchesSearch,
  sortShopProducts,
  getCategorySummaries,
  normalizeProductPayload,
  detectShopCategory
};
