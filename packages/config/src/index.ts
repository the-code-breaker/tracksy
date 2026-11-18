export const categories = [
  "Food & drinks",
  "Groceries",
  "Travel",
  "Rent",
  "Utilities",
  "Entertainment",
  "Shopping",
  "Other",
] as const;
export const flags = {
  tripMode: false,
  householdMode: false,
  personalExpenses: false,
  aiAssistant: false,
  receiptScanning: false,
} as const;
export const translations = {
  en: {
    home: "Home",
    groups: "Groups",
    activity: "Activity",
    insights: "Insights",
    profile: "Profile",
    tagline: "Split smarter. Settle together.",
    addExpense: "Add expense",
    owed: "You owe",
    receivable: "You’re owed",
    empty: "A fresh start. Create your first group.",
  },
  hi: {
    home: "होम",
    groups: "समूह",
    activity: "गतिविधि",
    insights: "विश्लेषण",
    profile: "प्रोफ़ाइल",
    tagline: "खर्च बाँटें। साथ मिलकर हिसाब करें।",
    addExpense: "खर्च जोड़ें",
    owed: "आपको देना है",
    receivable: "आपको मिलना है",
    empty: "शुरुआत करें। अपना पहला समूह बनाएँ।",
  },
};
