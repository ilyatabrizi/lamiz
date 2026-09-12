// Everything about Lamiz that isn't the catalogue. The catalogue (menu, branches,
// photographs) is generated into data.js from lamizcoffee.com; this file holds what
// the app itself decides, and says so wherever it is a preview assumption.

export const BUSINESS = {
  name: "Lamiz",
  full: "Lamiz Coffee",
  fa: "قهوه لمیز",
  country: "Iran",
  since: 1388,                              // lamizcoffee.com/about-us: first branch, Tajrish, 1388
  sinceAD: 2009,
  branches: 41,                             // "۴۱ شعبه فعال"
  snappfood: 28,                            // "به همراه ۲۸ شعبه اسنپ فود"
  baristas: 600,                            // "بیش از ۶۰۰ باریستا"
  // Their home page, verbatim: «ما قهوه لمیز هستیم و بی‌نهایت عاشق کاری که انجام می‌دهیم»
  tagline: "We are Lamiz Coffee, and we love what we do.",
  taglineFa: "ما قهوه لمیز هستیم و بی‌نهایت عاشق کاری که انجام می‌دهیم",
  // About page: «از قهوه سبز تا لیوان دست شما»
  greenToCup: "From green coffee to the cup in your hand.",
  greenToCupFa: "از قهوه سبز تا لیوان دست شما",
  instagram: "lamizcoffee",
  instagramUrl: "https://www.instagram.com/lamizcoffee",
  linkedinUrl: "https://www.linkedin.com/company/lamizcoffee/",
  site: "lamizcoffee.com",
  siteUrl: "https://lamizcoffee.com",
  snappfoodUrl: "https://lamizcoffee.com/snappfood-branches",
  phone: { main: "02154429000", ext: null },   // head office, lamizcoffee.com/contact-us
  email: "info@lamizcoffee.com",
  officeHours: "Saturday to Wednesday, 8:00 to 17:20",
  currency: "T",
  currencyLong: "Toman",
};

// ------------------------------------------------------------------ the club
// PREVIEW PROPOSAL. lamizcoffee.com has no loyalty programme; every number in this
// block is Alpha's suggestion, shown so the idea can be judged on a phone. The names
// follow their own line — from green coffee to the cup in your hand.
export const CLUB = {
  name: "Lamiz Club",
  unit: "bean",
  units: "beans",
  perToman: 1 / 10000,                      // one bean for every 10,000 T paid
  welcome: 50,                              // on joining
  windowDays: 365,                          // a tier is earned by beans collected in the last year
  tiers: [
    { id: "green", en: "Green", fa: "سبز", min: 0, rate: 1,
      line: "Where every coffee starts.", perks: ["1 bean for every 10,000 T", "50 beans to welcome you"] },
    { id: "roast", en: "Roast", fa: "رُست", min: 600, rate: 1.25,
      line: "600 beans in a year.", perks: ["1.25× beans on every order", "A drink on your birthday"] },
    { id: "black", en: "Black", fa: "سیاه", min: 1800, rate: 1.5,
      line: "1,800 beans in a year.", perks: ["1.5× beans on every order", "A drink on your birthday", "The seasonal menu, a week early"] },
  ],
  // Spent in the bag: each one makes one unit of a matching line free.
  rewards: [
    { id: "extra", en: "An extra, on us", sub: "A syrup, a shot or almond milk", cost: 60, cats: ["extras"], ico: "drop" },
    { id: "pastry", en: "A pastry, on us", sub: "Anything from the cake counter", cost: 250, cats: ["bakery"], ico: "cake" },
    { id: "hot", en: "A hot drink, on us", sub: "Espresso bar, brew bar or tea", cost: 300, cats: ["hot", "brew", "tea"], ico: "cup" },
    { id: "any", en: "Any drink, on us", sub: "Hot, cold, matcha or seasonal", cost: 450,
      cats: ["hot", "cold", "season", "matcha", "health", "brew", "tea", "popsicle"], ico: "sparkle" },
  ],
};

export const ORDER = {
  readyMinutes: 8,                          // the ring on the order screen
  maxPerLine: 9,
  keep: 30,                                 // orders remembered on this device
  // Preview: an order ends at a pickup code, paid at the counter. No payment is taken.
  pay: "Pay at the counter when you collect.",
};

export const CHECKIN = {
  holdMinutes: 60,                          // one tap holds your place for an hour
  extendMinutes: 60,
  nearMeters: 250,                          // "looks like you're at …"
  // Presence is device-local until an endpoint is set. Point this at a shared room
  // service and the same calls go there — see README → Check-in.
  endpoint: "",
  // Fills the rooms from a clock-derived roster so the feature can be judged on one
  // phone. Turn off the moment the endpoint above is live.
  demo: true,
};

export const STORAGE = "lamiz.v1.";
