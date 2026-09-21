import type { UserRole } from "@/types/database";

export type WorkMode = "remote" | "hybrid" | "office";
export type FoodHabit = "pure_veg" | "veg_preferred" | "non_veg_friendly";
export type RoomKind = "private_attached_bath" | "private_balcony" | "private_room" | "shared_room";
export type GenderPreference = "female_only" | "male_only" | "any";

export interface VerifiedProfessional {
  id: string;
  name: string;
  age: number;
  company: string;
  designation: string;
  workEmailDomain: string;
  linkedinVerified: boolean;
  avatarUrl: string;
  workMode: WorkMode;
  habits: {
    routine: string; // e.g. "Early riser (7 AM)", "Flexible night owl"
    smoking: "non_smoker" | "smoker";
    drinking: "non_drinker" | "social" | "regular";
    food: FoodHabit;
    pets: "loves_pets" | "pet_owner" | "no_pets";
    socialVibe: string; // e.g. "Calm weeknights, chill weekends"
    chores: string; // e.g. "Daily cook & maid shared equally"
  };
  bio: string;
}

export interface DirectOwner {
  id: string;
  name: string;
  ownershipVerified: boolean;
  verificationDoc: string; // e.g. "Electricity Bill / Society NOC verified"
  profession?: string;
  bio?: string;
  avatarUrl: string;
}

export interface DirectListing {
  id: string;
  kind: "owner_flat" | "shared_room";
  title: string;
  society: string;
  area: string;
  locality: string;
  bhk: "1bhk" | "2bhk" | "3bhk" | "4plus";
  roomKind?: RoomKind;
  rentMonthly: number;
  deposit: number;
  maintenanceIncluded: boolean;
  maintenanceAmount: number;
  brokerage: 0; // Strictly 0
  availableFrom: string;
  photos: string[];
  genderPreference: GenderPreference;
  professionalsOnly: boolean;
  postedByKind: "owner" | "flatmate";
  owner?: DirectOwner;
  flatmate?: VerifiedProfessional;
  currentRoommates?: VerifiedProfessional[];
  houseRules: string[];
  amenities: string[];
  description: string;
  phone: string;
  whatsapp: string;
  addressLine: string;
}

// Initial curated dataset of real Pune tech-hub direct flats and shared rooms
export const INITIAL_DIRECT_LISTINGS: DirectListing[] = [
  {
    id: "dir-1",
    kind: "shared_room",
    title: "Master Bedroom with Attached Balcony & Washroom in 3BHK",
    society: "Mont Vert One",
    area: "Wakad",
    locality: "Pune",
    bhk: "3bhk",
    roomKind: "private_attached_bath",
    rentMonthly: 13500,
    deposit: 27000,
    maintenanceIncluded: true,
    maintenanceAmount: 0,
    brokerage: 0,
    availableFrom: "Immediate",
    photos: [
      "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1200&auto=format&fit=crop",
    ],
    genderPreference: "male_only",
    professionalsOnly: true,
    postedByKind: "flatmate",
    flatmate: {
      id: "pro-1",
      name: "Piyush Gupta",
      age: 26,
      company: "Barclays",
      designation: "Senior Software Engineer",
      workEmailDomain: "barclays.com",
      linkedinVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop",
      workMode: "hybrid",
      habits: {
        routine: "Early riser (7:30 AM), office 3 days",
        smoking: "non_smoker",
        drinking: "social",
        food: "non_veg_friendly",
        pets: "loves_pets",
        socialVibe: "Quiet weeknights for work/workout, board games on weekends",
        chores: "Dedicated maid for cleaning & dusting, cook for dinner split equally",
      },
      bio: "Living here for 1.5 years. Flatmate relocated to Bangalore. Looking for an easygoing, clean working professional. No drama, no brokers.",
    },
    currentRoommates: [
      {
        id: "pro-2",
        name: "Vedant Mishra",
        age: 25,
        company: "Capgemini",
        designation: "Data Analyst",
        workEmailDomain: "capgemini.com",
        linkedinVerified: true,
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop",
        workMode: "hybrid",
        habits: {
          routine: "9 AM to 6 PM",
          smoking: "non_smoker",
          drinking: "social",
          food: "non_veg_friendly",
          pets: "loves_pets",
          socialVibe: "Chill, enjoys sports and cooking on Sundays",
          chores: "Clean sink rule",
        },
        bio: "Capgemini Hinjewadi campus. Commute is 15 mins via Bhumkar Chowk.",
      },
    ],
    houseRules: [
      "Working IT / Corporate professionals only",
      "Cook & maid expenses split 3 ways (approx ₹2,800/mo)",
      "High-speed 300 Mbps Airtel Fiber already set up",
      "Guests welcome on weekends with prior heads-up",
    ],
    amenities: [
      "Attached Private Bath",
      "Balcony with Greens View",
      "Washing Machine",
      "Refrigerator",
      "Air Conditioner",
      "Gated Society with Gym & Pool",
    ],
    description: "Fully furnished 3BHK in Mont Vert One, Wakad. The master bedroom is opening up as our flatmate moved to Bangalore. Large double bed with memory foam mattress, 3-door wooden wardrobe, attached modern bathroom with geyser, and personal balcony. Living room has a 55-inch TV, sofa, and dining table. Zero brokerage, deal directly with us.",
    phone: "+91 98231 44820",
    whatsapp: "919823144820",
    addressLine: "Tower 4, Mont Vert One, Datta Mandir Road, Wakad, Pune",
  },
  {
    id: "dir-2",
    kind: "owner_flat",
    title: "Direct Owner: Fully Furnished 2BHK in Serenity Megapolis",
    society: "Megapolis Serenity",
    area: "Hinjewadi",
    locality: "Pune",
    bhk: "2bhk",
    rentMonthly: 28000,
    deposit: 60000,
    maintenanceIncluded: false,
    maintenanceAmount: 2500,
    brokerage: 0,
    availableFrom: "1st Oct 2026",
    photos: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1200&auto=format&fit=crop",
    ],
    genderPreference: "any",
    professionalsOnly: true,
    postedByKind: "owner",
    owner: {
      id: "own-1",
      name: "Col. Sanjeev Kulkarni (Retd.)",
      ownershipVerified: true,
      verificationDoc: "Registered Society Share Certificate & Property Tax Verified",
      profession: "Ex-Indian Army, Currently Tech Advisor",
      bio: "I own this flat in Hinjewadi Phase 3. Strictly no brokers please. I want polite, educated working professionals who keep the home clean. Full transparency, no unexpected deductions.",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=300&auto=format&fit=crop",
    },
    houseRules: [
      "Working IT / Corporate professionals or family only",
      "Proof of corporate employment (Work ID / LinkedIn) required",
      "Rent transfer directly on 1st of every month via UPI / NEFT",
      "No brokers, agents please do not call",
    ],
    amenities: [
      "Modular Kitchen with Piped Gas",
      "2 Covered Reserved Car Parkings",
      "Both Bedrooms Furnished with Wardrobes & Beds",
      "High Floor with Hinjewadi Hills View",
      "Clubhouse, 24x7 Power Backup & Security",
    ],
    description: "East facing, vastu compliant 2BHK flat on the 14th floor overlooking the Hinjewadi hills. Ideal for employees working in Hinjewadi Tech Park (Wipro, Infosys, Tech Mahindra, Cognizant are 5-10 mins away). Flat includes modular kitchen, 2 double beds, sofa set, dining table, water purifier, and geysers. Dealing directly with me, zero brokerage.",
    phone: "+91 94220 18833",
    whatsapp: "919422018833",
    addressLine: "Flat 1402, Serenity Tower, Megapolis, Phase 3, Hinjewadi, Pune",
  },
  {
    id: "dir-3",
    kind: "shared_room",
    title: "Private Room for Female Flatmate in Premium 2.5 BHK Society",
    society: "Rohan Leher",
    area: "Baner",
    locality: "Pune",
    bhk: "2bhk",
    roomKind: "private_room",
    rentMonthly: 15000,
    deposit: 30000,
    maintenanceIncluded: true,
    maintenanceAmount: 0,
    brokerage: 0,
    availableFrom: "Immediate",
    photos: [
      "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1200&auto=format&fit=crop",
    ],
    genderPreference: "female_only",
    professionalsOnly: true,
    postedByKind: "flatmate",
    flatmate: {
      id: "pro-3",
      name: "Smriti Rao",
      age: 25,
      company: "Google",
      designation: "UX Researcher",
      workEmailDomain: "google.com",
      linkedinVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300&auto=format&fit=crop",
      workMode: "remote",
      habits: {
        routine: "Flexible daytime routine, loves quiet morning coffee on the balcony",
        smoking: "non_smoker",
        drinking: "social",
        food: "pure_veg",
        pets: "loves_pets",
        socialVibe: "Calm, creative atmosphere. Cozy movie nights and book reading",
        chores: "Daily househelp handles cooking and cleaning",
      },
      bio: "Working remotely for Google. Looking for a respectful, friendly female working professional. The society is lush green, super safe, and has 24/7 security with touchless access.",
    },
    houseRules: [
      "Female working professional only",
      "Vegetarian cooking preferred in main kitchen",
      "Cleanliness and mutual quiet hours after 11 PM on weekdays",
      "Zero brokerage, direct split of rent with flatmates",
    ],
    amenities: [
      "Private Bedroom with Large Window",
      "Dedicated Study / Work Desk & Ergonomic Chair",
      "High-speed 500 Mbps Wi-Fi",
      "Full Modular Kitchen with Microwave & Chimney",
      "Swimming Pool & Badminton Court in Society",
    ],
    description: "Sunlit, airy private room in Rohan Leher, Baner. Located just off Mumbai-Pune Highway, walking distance from top cafes and grocery stores in Baner. Looking for a neat and sorted female professional to share this beautiful home.",
    phone: "+91 97644 51290",
    whatsapp: "919764451290",
    addressLine: "B-Wing, Rohan Leher, Baner Pashan Link Road, Baner, Pune",
  },
  {
    id: "dir-4",
    kind: "owner_flat",
    title: "Direct Owner: Spacious 3BHK for Corporate Professionals",
    society: "Marvel Cascada",
    area: "Kharadi",
    locality: "Pune",
    bhk: "3bhk",
    rentMonthly: 42000,
    deposit: 100000,
    maintenanceIncluded: true,
    maintenanceAmount: 0,
    brokerage: 0,
    availableFrom: "15th Oct 2026",
    photos: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?q=80&w=1200&auto=format&fit=crop",
    ],
    genderPreference: "any",
    professionalsOnly: true,
    postedByKind: "owner",
    owner: {
      id: "own-2",
      name: "Dr. Arvind Shinde",
      ownershipVerified: true,
      verificationDoc: "Society Share Certificate & Electricity Meter Verified",
      profession: "Senior Consultant Surgeon",
      bio: "Owner of the property. I live nearby in Koregaon Park. Strictly dealing with working IT/Corporate professionals or families directly. No brokerage, no middlemen.",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300&auto=format&fit=crop",
    },
    houseRules: [
      "Working corporate professionals or families only (EON / WTC Kharadi preferred)",
      "Standard 11-month agreement with 1-month notice period",
      "Direct owner interaction for any maintenance needs",
      "Strictly no broker inquiries",
    ],
    amenities: [
      "Private Landscaped Terrace Balcony",
      "VRV Central Air Conditioning",
      "Fully Fitted German Modular Kitchen",
      "Wooden Flooring in Master Bedroom",
      "Olympic-sized Society Pool, Gym & Squash Court",
    ],
    description: "Luxurious 3BHK flat in Marvel Cascada, Kharadi — walking distance from EON Free Zone and World Trade Center (WTC). Premium construction with wooden decks, false ceiling, and designer bathrooms. Rent directly from me without paying any agent commissions.",
    phone: "+91 99224 87019",
    whatsapp: "919922487019",
    addressLine: "Tower C, Marvel Cascada, Near EON IT Park, Kharadi, Pune",
  },
  {
    id: "dir-5",
    kind: "shared_room",
    title: "Private Room in 2BHK Near Cummins & MIT College",
    society: "Dahanukar Colony Society",
    area: "Kothrud",
    locality: "Pune",
    bhk: "2bhk",
    roomKind: "private_room",
    rentMonthly: 11000,
    deposit: 22000,
    maintenanceIncluded: true,
    maintenanceAmount: 0,
    brokerage: 0,
    availableFrom: "Immediate",
    photos: [
      "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?q=80&w=1200&auto=format&fit=crop",
    ],
    genderPreference: "male_only",
    professionalsOnly: true,
    postedByKind: "flatmate",
    flatmate: {
      id: "pro-4",
      name: "Aditya Patil",
      age: 27,
      company: "Cummins India",
      designation: "Mechanical Design Engineer",
      workEmailDomain: "cummins.com",
      linkedinVerified: true,
      avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=300&auto=format&fit=crop",
      workMode: "office",
      habits: {
        routine: "8 AM to 5:30 PM office shift",
        smoking: "non_smoker",
        drinking: "non_drinker",
        food: "pure_veg",
        pets: "no_pets",
        socialVibe: "Quiet, peaceful atmosphere. Enjoys cycling on weekends",
        chores: "Maid cleans daily, cook makes breakfast and dinner",
      },
      bio: "Working at Cummins Kothrud tech center. Friendly, quiet, and neat. The flat is in a peaceful, tree-lined residential lane in Kothrud with quick metro access.",
    },
    houseRules: [
      "Male working professional only",
      "Non-smoker strictly",
      "Vegetarian preferred",
      "Equal split of electricity and Wi-Fi bills",
    ],
    amenities: [
      "Private Wardrobe & Bed with Mattress",
      "High Speed Fiber Internet",
      "Washing Machine & Water Purifier",
      "Walking distance to Vanaz Metro Station",
    ],
    description: "Looking for a working professional to take the second bedroom in a well-maintained 2BHK flat in Kothrud. Cummins India and MIT WPU are within 10 minutes. Zero brokerage, dealing directly with me.",
    phone: "+91 98811 72341",
    whatsapp: "919881172341",
    addressLine: "Lane 4, Dahanukar Colony, Kothrud, Pune",
  },
];

export interface DirectFilterOptions {
  kind?: "all" | "owner_flat" | "shared_room";
  area?: string;
  gender?: GenderPreference | "all";
  maxRent?: number;
}

export function getDirectListings(filters: DirectFilterOptions = {}): DirectListing[] {
  return INITIAL_DIRECT_LISTINGS.filter((item) => {
    if (filters.kind && filters.kind !== "all" && item.kind !== filters.kind) {
      return false;
    }
    if (filters.area && filters.area !== "all" && item.area.toLowerCase() !== filters.area.toLowerCase()) {
      return false;
    }
    if (filters.gender && filters.gender !== "all") {
      if (item.genderPreference !== "any" && item.genderPreference !== filters.gender) {
        return false;
      }
    }
    if (filters.maxRent && item.rentMonthly > filters.maxRent) {
      return false;
    }
    return true;
  });
}

export function getDirectListingById(id: string): DirectListing | undefined {
  return INITIAL_DIRECT_LISTINGS.find((l) => l.id === id);
}
