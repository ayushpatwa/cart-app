// Initial seed data for the Food Cart Menu
const DEFAULT_MENU_DATA = {
  cartName: "Street Bytes Food Cart",
  tagline: "Artisanal Street Eats & Gourmet Comfort Food",
  location: "Downtown Plaza • Cart #04",
  hours: "Mon-Sat: 11:00 AM - 9:00 PM",
  adminPin: "1234",
  categories: [
    { id: "all", name: "All Items", icon: "✨" },
    { id: "burgers", name: "Smash Burgers", icon: "🍔" },
    { id: "tacos", name: "Street Tacos", icon: "🌮" },
    { id: "sides", name: "Loaded Sides", icon: "🍟" },
    { id: "drinks", name: "Craft Drinks", icon: "🥤" },
    { id: "desserts", name: "Sweet Treats", icon: "🍩" }
  ],
  items: [
    {
      id: "item-1",
      name: "Double Artisanal Smash Burger",
      category: "burgers",
      price: 11.99,
      description: "Dual crisp-edged Angus beef patties, double melted sharp cheddar, caramelized onions, crisp pickles, and secret signature cart sauce on a butter-toasted brioche bun.",
      image: "./assets/images/burger.jpg",
      inStock: true,
      popular: true,
      tags: ["Chef Special", "Popular"],
      dietary: ["halal"],
      calories: "780 kcal"
    },
    {
      id: "item-2",
      name: "Carne Asada Street Tacos (3x)",
      category: "tacos",
      price: 10.50,
      description: "Char-grilled marinated steak served on warm corn tortillas with freshly chopped cilantro, diced white onions, cotija cheese, and fresh lime wedges.",
      image: "./assets/images/tacos.jpg",
      inStock: true,
      popular: true,
      tags: ["Gluten-Free", "Spicy 🌶️"],
      dietary: ["gluten-free", "spicy"],
      calories: "540 kcal"
    },
    {
      id: "item-3",
      name: "Truffle & Garlic Loaded Fries",
      category: "sides",
      price: 7.99,
      description: "Crispy waffle fries tossed in white truffle oil, roasted garlic aioli, grated parmesan, smoked bacon crumbles, and fresh chives.",
      image: "./assets/images/fries.jpg",
      inStock: true,
      popular: false,
      tags: ["Customer Favorite"],
      dietary: ["vegetarian-option"],
      calories: "620 kcal"
    },
    {
      id: "item-4",
      name: "Artisan Hibiscus Mint Lemonade",
      category: "drinks",
      price: 4.50,
      description: "Freshly squeezed lemon juice steeped with wild hibiscus flowers, organic agave, crushed mint leaves, and served iced in a mason jar.",
      image: "./assets/images/lemonade.jpg",
      inStock: true,
      popular: true,
      tags: ["Vegan 🌱", "House Specialty"],
      dietary: ["vegan", "gluten-free"],
      calories: "140 kcal"
    },
    {
      id: "item-5",
      name: "Crispy Cinnamon Sugar Churros",
      category: "desserts",
      price: 6.00,
      description: "Four made-to-order golden fried churros dusted in Saigon cinnamon sugar, served with warm Mexican spiced dark chocolate dipping sauce.",
      image: "https://images.unsplash.com/photo-1624371414361-e670edf4898d?auto=format&fit=crop&w=800&q=80",
      inStock: true,
      popular: false,
      tags: ["Vegetarian 🌱"],
      dietary: ["vegetarian"],
      calories: "450 kcal"
    },
    {
      id: "item-6",
      name: "Spicy Birria Quesatacos (3x)",
      category: "tacos",
      price: 12.99,
      description: "Slow-braised beef birria folded in melted Oaxaca cheese corn tortillas, pan-seared till crispy, served with rich consommé for dipping.",
      image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80",
      inStock: true,
      popular: true,
      tags: ["Spicy 🌶️", "Bestseller 🔥"],
      dietary: ["spicy"],
      calories: "680 kcal"
    },
    {
      id: "item-7",
      name: "Smokey BBQ Pulled Pork Slider",
      category: "burgers",
      price: 9.50,
      description: "Slow-smoked hickory pulled pork piled high with tangy apple-cider slaw and house BBQ drizzle on twin slider buns.",
      image: "https://images.unsplash.com/photo-1521305916504-4a1121188589?auto=format&fit=crop&w=800&q=80",
      inStock: false, // Demo sold out state
      popular: false,
      tags: ["Sold Out Demo"],
      dietary: [],
      calories: "590 kcal"
    },
    {
      id: "item-8",
      name: "Vegan Beyond Street Burger",
      category: "burgers",
      price: 12.50,
      description: "100% plant-based grilled Beyond patty with vegan cheddar, avocado smash, arugula, and spicy vegan mayo on a toasted oat bun.",
      image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=800&q=80",
      inStock: true,
      popular: false,
      tags: ["100% Vegan 🌱"],
      dietary: ["vegan", "vegetarian"],
      calories: "510 kcal"
    }
  ]
};
