// Run with: npm run seed
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Item = require("../models/Item");
const DistributionEvent = require("../models/DistributionEvent");
const PersonServedTally = require("../models/PersonServedTally");
const MonthlyBudget = require("../models/MonthlyBudget");

const PANTRY_ADDRESS = "2809 S Spring Ave, Sioux Falls, SD 57105";
const OUTREACH_LOCATION =
  "Heritage Park, 330 N Weber Ave, Sioux Falls, SD 57103";

async function seed() {
  await connectDB();

  // Refuse to wipe a database that already has real data in it. This script
  // deletes and recreates every collection below, so a second run against a
  // live database would destroy anything added since the first seed.
  const forceReseed = process.argv.includes("--force");
  const existingUserCount = await User.countDocuments();
  if (existingUserCount > 0 && !forceReseed) {
    console.error(
      `Refusing to reseed: ${existingUserCount} user(s) already exist in this database.\n` +
        "Re-running this script would delete all current users, items, events, tallies, and budgets.\n" +
        "If you really want to wipe and reseed, run: npm run seed -- --force"
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  // --- Users ---
  await User.deleteMany({});

  const [admin, coAdmin, volunteer, neighbor] = await Promise.all([
    makeUser("Dr. Lisa Coder", "admin", "2809"),
    makeUser("Mary Elenius", "admin", "0292"),
    makeUser("Volunteer (Test)", "volunteer", "2800"),
    makeUser("Neighbor (Test)", "neighbor", "1234"),
  ]);

  console.log("Seeded users:");
  console.log(`  Admin: ${admin.name} `);
  console.log(`  Admin: ${coAdmin.name} `);
  console.log(`  Volunteer: ${volunteer.name} `);
  console.log(`  Neighbor: ${neighbor.name} `);

  // --- Inventory items ---
  await Item.deleteMany({});

  const items = [
    // hygiene
    {
      name: "Bar soap, 0.5oz travel size (individually wrapped)",
      category: "hygiene",
      unitCost: 0.18,
      currentStock: 100,
      lowThreshold: 30,
      unitType: "bar",
    },
    {
      name: "Toothbrush + toothpaste set",
      category: "hygiene",
      unitCost: 0.35,
      currentStock: 0,
      lowThreshold: 150,
      unitType: "set",
    },
    {
      name: "Wet wipes (individually wrapped)",
      category: "hygiene",
      unitCost: 0.16,
      currentStock: 0,
      lowThreshold: 150,
      unitType: "wipe",
    },
    {
      name: "Travel deodorant",
      category: "hygiene",
      unitCost: 0.8,
      currentStock: 0,
      lowThreshold: 75,
      unitType: "stick",
    },
    {
      name: "Feminine hygiene pads",
      category: "hygiene",
      unitCost: 0.22,
      currentStock: 0,
      lowThreshold: 75,
      unitType: "pad",
    },
    {
      name: "Nail clippers, stainless steel (individually wrapped)",
      category: "hygiene",
      unitCost: 0.19,
      currentStock: 100,
      lowThreshold: 30,
      unitType: "clipper",
    },
    {
      name: "Travel-size empty squeeze bottles (2oz, refillable)",
      category: "hygiene",
      unitCost: 0.23,
      currentStock: 200,
      lowThreshold: 50,
      unitType: "bottle",
    },
    {
      name: "3-in-1 shampoo/conditioner/body wash, fragrance-free (bulk refill)",
      category: "hygiene",
      unitCost: 0.23,
      currentStock: 128,
      lowThreshold: 32,
      unitType: "oz",
    },

    // winter
    {
      name: "Winter gloves, adult unisex knit (bulk)",
      category: "winter",
      unitCost: 1.67,
      currentStock: 12,
      lowThreshold: 4,
      unitType: "pair",
    },
    {
      name: "Beanie hats (wholesale bulk)",
      category: "winter",
      unitCost: 0.83,
      currentStock: 24,
      lowThreshold: 8,
      unitType: "hat",
    },
    {
      name: "HotHands hand warmers (bulk)",
      category: "winter",
      unitCost: 0.62,
      currentStock: 40,
      lowThreshold: 12,
      unitType: "pair",
    },
    {
      name: "Cotton crew socks, bulk (men's & women's)",
      category: "winter",
      unitCost: 1.05,
      currentStock: 300,
      lowThreshold: 75,
      unitType: "pair",
    },
    {
      name: "Emergency mylar blankets (waterproof, individually sealed)",
      category: "winter",
      unitCost: 0.84,
      currentStock: 50,
      lowThreshold: 15,
      unitType: "blanket",
    },
    {
      name: "Winter fleece scarves (bulk)",
      category: "winter",
      unitCost: 3.08,
      currentStock: 12,
      lowThreshold: 4,
      unitType: "scarf",
    },

    // other
    {
      name: "Canned Vienna sausage, BBQ flavor (4.6oz)",
      category: "other",
      unitCost: 0.89,
      currentStock: 24,
      lowThreshold: 8,
      unitType: "can",
    },
    {
      name: "Bottled water (16.9oz)",
      category: "other",
      unitCost: 0.29,
      currentStock: 24,
      lowThreshold: 8,
      unitType: "bottle",
    },
    {
      name: "Granola bars, Oats 'N Honey (individually wrapped)",
      category: "other",
      unitCost: 0.28,
      currentStock: 98,
      lowThreshold: 25,
      unitType: "bar",
    },
    {
      name: "Emergency disposable rain ponchos with hood",
      category: "other",
      unitCost: 3.59,
      currentStock: 12,
      lowThreshold: 3,
      unitType: "poncho",
    },
    {
      name: "Drawstring backpacks, bulk (black)",
      category: "other",
      unitCost: 0.55,
      currentStock: 100,
      lowThreshold: 25,
      unitType: "bag",
    },
  ];

  await Item.insertMany(items);
  console.log(`Seeded ${items.length} inventory items.`);

  // --- Distribution events ---
  await DistributionEvent.deleteMany({});
  await PersonServedTally.deleteMany({});

  await DistributionEvent.create({
    location: PANTRY_ADDRESS,
    details:
      "Open 24/7. Shelves, fridge, and freezer available - fridge/freezer use a child lock (required by city ordinance), freely available to open. Located on the side of Vital Animal Veterinary Clinic; not affiliated with or run by the veterinary business.",
    createdBy: admin._id,
  });

  const SATURDAY_COUNT = 200;
  const firstSaturday = Date.UTC(2026, 8, 19, 16, 0, 0); // Sept 19, 2026, 10:00am CST (UTC-6)
  const outreachEvents = Array.from({ length: SATURDAY_COUNT }, (_, i) => ({
    date: new Date(firstSaturday + i * 7 * 24 * 60 * 60 * 1000),
    location: OUTREACH_LOCATION,
    details:
      "Community outreach event. Free hygiene and winter items available while supplies last. Drinks and sometimes food provided. Volunteers welcome! Please contact us if you want to help.",
    createdBy: admin._id,
  }));

  const insertedEvents = await DistributionEvent.insertMany(outreachEvents);
  console.log(
    `Seeded 1 standing pantry listing + ${insertedEvents.length} weekly outreach events (Saturdays starting 2026-09-19).`
  );

  // --- Person served tally ---
  // The first Saturday outreach event (2026-09-19) served 222 people.
  const firstOutreachEvent = insertedEvents[0];
  await PersonServedTally.create({
    distributionEvent: firstOutreachEvent._id,
    countIncrement: 222,
    timestamp: firstOutreachEvent.date,
    createdBy: volunteer._id,
  });
  console.log("Seeded person-served tally: 222 on 2026-09-19.");

  // --- Monthly budgets ---
  await MonthlyBudget.deleteMany({});

  const now = new Date();
  const pastMonths = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (i + 1), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  await MonthlyBudget.insertMany(
    pastMonths.map((month) => ({ month, totalBudget: 2800 }))
  );
  console.log(
    `Seeded ${pastMonths.length} past monthly budgets: ${pastMonths.join(
      ", "
    )}.`
  );

  console.log("\nOrganization info for reference:");
  console.log("  Feed Sioux Falls - founded by Dr. Lisa Coder");
  console.log(`  Pantry location: ${PANTRY_ADDRESS}`);
  console.log(
    `  Weekly outreach: Saturdays 10-11am CST at ${OUTREACH_LOCATION}`
  );

  await mongoose.disconnect();
  console.log("\nSeed complete.");
}

async function makeUser(name, role, pin) {
  const user = new User({ name, role });
  await user.setPin(pin);
  await user.save();
  return user;
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
