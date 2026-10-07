// Everything public about Feed Sioux Falls, in one place - a copy of the
// website's src/config/org.js. Change a link or address in both places.
//
// A link set to null is hidden everywhere, rather than shown broken - fill
// in amazonWishlist once you have it.
export const ORG = {
  name: 'Feed Sioux Falls',
  tagline: 'End hunger in Sioux Falls',
  mission:
    'Food is a human right. We aim to provide for our community and help each other every day. Feed Sioux Falls strives to help neighbors as we would ourselves. No one should be hungry.',
  legal: '501(c)(3) nonprofit public charity',

  email: 'foodsiouxfalls@gmail.com',

  pantry: {
    address: '2809 S Spring Ave, Sioux Falls, SD 57105',
    hours: 'Open 24 hours, 7 days a week',
    host: 'On the side of Vital Animal Veterinary Clinic (the pantry is not part of the clinic)',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=2809+S+Spring+Ave+Sioux+Falls+SD+57105',
  },

  outreach: {
    name: 'Compassion Crew',
    when: 'Saturdays, 10–11 am',
    where: 'Heritage Park, 330 N Weber Ave, Sioux Falls',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Heritage+Park+330+N+Weber+Ave+Sioux+Falls+SD',
  },

  links: {
    website: 'https://www.feedsiouxfalls.com',
    about: 'https://www.feedsiouxfalls.com/who-we-are',
    news: 'https://www.feedsiouxfalls.com/blog',
    facebook: 'https://www.facebook.com/profile.php?id=61590352504825',
    meetup: 'https://www.meetup.com/feeding-sioux-falls-community-outreach-group/',
    zeffy: 'https://www.zeffy.com/en-US/donation-form/feed-sioux-falls',
    pledge: 'https://www.pledge.to/feed-sioux-falls',
    amazonWishlist: null, // e.g. 'https://www.amazon.com/hz/wishlist/ls/XXXXXXXX'
  },

  textToGive: { keyword: 'FOOD', number: '707070' },

  team: [
    {
      name: 'Lisa Coder',
      role: 'Founder & CEO',
      bio: 'Lisa saw a need in our community and decided to act. Veterinary clinic owner, coffee lover, and single mom of two, she believes in loving and helping our neighbors in any way we can.',
    },
    {
      name: 'Kisha Limoges',
      role: 'Board member',
      bio: '“I have always been passionate about helping out anyone who may be in need.”',
    },
    {
      name: 'Melaney Sohm',
      role: 'Board member',
      bio: 'A recently retired public servant who remembers struggling as a single parent, and how much a pantry like this would have helped.',
    },
  ],
};

// Store names for item "where to buy" links (codes match the backend).
export const STORES = {
  amazon: 'Amazon',
  temu: 'Temu',
  dollar_general: 'Dollar General',
  walmart: 'Walmart',
  target: 'Target',
  costco: 'Costco',
  sams_club: "Sam's Club",
  other: 'Other store',
};

export function storeLabel(source) {
  if (source.store === 'other' && source.note) return source.note;
  return STORES[source.store] || 'Store';
}

// The Feed Sioux Falls website (the staff database pages live there, and
// the survey's share link and QR code point at its /survey page).
export const websiteUrl = 'https://feed-sioux-falls-website.onrender.com';
