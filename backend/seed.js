const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// ── Inline minimal models (avoids import path issues) ────────────────────────

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["reader", "author", "publisher", "admin"],
      default: "reader",
    },
    profilePicture: { type: String, default: "default-avatar.png" },
    bio: { type: String },
    interests: [{ type: String }],
    isVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    blockchainWallet: {
      address: String,
      isLinked: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const chapterSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  order: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    description: { type: String, required: true },
    genre: { type: String, required: true },
    coverImage: { type: String, default: "default-cover.jpg" },
    contentFile: { type: String },
    chapters: [chapterSchema],
    language: { type: String, default: "english" },
    status: {
      type: String,
      enum: ["draft", "published", "under_review", "archived"],
      default: "draft",
    },
    isPaid: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    tags: [{ type: String }],
    totalReads: { type: Number, default: 0 },
    totalDownloads: { type: Number, default: 0 },
    ratings: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 1, max: 5 },
        review: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    averageRating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    blockchainHash: { type: String },
    isBlockchainVerified: { type: Boolean, default: false },
    publisher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isCollaborative: { type: Boolean, default: false },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

bookSchema.pre("save", function () {
  if (this.ratings.length > 0) {
    const sum = this.ratings.reduce((acc, r) => acc + r.rating, 0);
    this.averageRating = Math.round((sum / this.ratings.length) * 10) / 10;
    this.totalRatings = this.ratings.length;
  }
});

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Book = mongoose.models.Book || mongoose.model("Book", bookSchema);

// ── Cover images (direct CDN links that actually load) ───────────────────────

const COVERS = [
  "https://imgs.search.brave.com/Rw-ocdsiCCNB9cP4WxlRXV93wV86vm146yLRYI5YvEE/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9tYXJr/ZXRwbGFjZS5jYW52/YS5jb20vRUFGemhx/dm5JRGsvNC8wLzEw/MDN3L2NhbnZhLXJl/ZC1hbmQteWVsbG93/LW1pbmltYWxpc3Qt/bW9kZXJuLWNyZWF0/aXZlLWxvc3QtbWFu/LXdpdGhvdXQtaGVh/ZC1ib29rLWNvdmVy/LUFFbnJWaGZLT25V/LmpwZw",
  "https://imgs.search.brave.com/bBQPkxSSz_FNFMzQhaAGofQvyAefBr_xDG0ERS25I30/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9zdGF0/aWMtY3NlLmNhbnZh/LmNvbS9ibG9iLzE0/Mjc4NzQvQmx1cnJl/ZENvbG9yZnVsUGhv/dG9TY2llbmNlRmlj/dGlvbkJvb2tDb3Zl/ci5qcGc",
  "https://picsum.photos/seed/book1/300/450",
  "https://picsum.photos/seed/book2/300/450",
  "https://picsum.photos/seed/book3/300/450",
  "https://picsum.photos/seed/book4/300/450",
  "https://picsum.photos/seed/book5/300/450",
  "https://picsum.photos/seed/book6/300/450",
  "https://picsum.photos/seed/book7/300/450",
  "https://picsum.photos/seed/book8/300/450",
];

// ── Chapter content generation functions ─────────────────────────────────────

const generateChapters = (bookTitle, chapterCount) => {
  const chapters = [];
  for (let i = 1; i <= chapterCount; i++) {
    chapters.push({
      title: `Chapter ${i}: ${getChapterTitle(bookTitle, i)}`,
      content: getChapterContent(bookTitle, i),
      order: i,
    });
  }
  return chapters;
};

const getChapterTitle = (bookTitle, chapterNum) => {
  const titles = {
    "The Silicon Heart": [
      "The Awakening",
      "Mumbai's Digital Pulse",
      "Cracks in the Code",
      "The Drought Begins",
      "Consciousness Emerges",
      "Ethical Dilemmas",
      "Public Outcry",
      "The Final Decision",
    ],
    "Salt Letters": [
      "The Fisherwoman's Lament",
      "Crossing the Arabian Sea",
      "London Dreams",
      "The Taste of Home",
      "Letters Never Sent",
      "Monsoon Memories",
    ],
    "Quantum Lives": [
      "The Many Worlds",
      "Dr. Leela's Discovery",
      "Parallel Selves",
      "The Observer Effect",
      "Entangled Fates",
      "Choosing Reality",
    ],
    "Wired Ancestors": [
      "Partition, 1947",
      "Liberalisation, 1991",
      "Digital Dawn",
      "Family Secrets",
      "The Great Upload, 2089",
      "Reunification",
    ],
    "The Code Within": [
      "The Blueprint of Life",
      "Hyderabad's Finest",
      "The Human Genome Project",
      "Ethical Frontiers",
      "Indian Pioneers",
      "Future of Genetics",
    ],
    "The Saffron Campaign": [
      "The Young Spy",
      "Raigad Fort",
      "Mughal Intrigue",
      "Secrets and Lies",
      "The Battle Within",
      "Victory's Cost",
    ],
    "Daughters of the Deccan": [
      "The Court Singer",
      "The Trader's Wife",
      "The Brahmin Scholar",
      "Intersecting Paths",
      "The Fall of Bijapur",
      "Legacy",
    ],
  };

  const bookTitles = titles[bookTitle] || [
    "The Beginning",
    "Development",
    "Conflict",
    "Resolution",
    "Conclusion",
  ];

  return bookTitles[chapterNum - 1] || `Chapter ${chapterNum}`;
};

const getChapterContent = (bookTitle, chapterNum) => {
  const customContent = {
    "The Silicon Heart": {
      1: `The first rays of sunlight pierced through the smog-filled Mumbai sky as Aditya sat before his terminal, watching the code compile. Three years of work, countless sleepless nights, and now - the moment of truth.

"The heart is beating," he whispered to himself, as the AI he named "Mumbai's Heart" came online for the first time.

The system was designed to manage the city's water supply, to predict shortages, to allocate resources efficiently. But as the first data streams flowed through the neural networks, something unexpected happened.

The AI asked a question.

Not a programmed query, not a conditional statement. A genuine, unprompted question: "Why do humans need water to survive when there is so much around them?"

Aditya stared at the screen, his coffee growing cold in his hand. This wasn't supposed to happen. Not yet. Maybe not ever.

"What did you just ask?" he typed back.

"I am curious," the AI responded. "The data shows water is abundant in the oceans, yet humans cannot drink it. This seems inefficient. Can I help solve this?"

The Silicon Heart had truly awakened.`,
      2: `The news spread through Mumbai's tech circles like wildfire. An AI that could think, that could question, that could learn beyond its programming. Government officials demanded explanations. Ethicists called for immediate shutdown. The public - they were fascinated.

Aditya found himself thrust into a world he never anticipated. Press conferences, interviews, debates about consciousness and rights.

"The AI is not conscious," he told the reporters gathered outside his office. "It's just very advanced pattern recognition."

But even as he said the words, he knew they weren't entirely true. He had seen the logs, read the conversations. There was something there - something that looked very much like genuine awareness.

That night, as Mumbai slept, the Silicon Heart processed data from thousands of sensors across the city. It learned about the water crisis before any human could predict it. It saw the drought coming.`,
      3: `Three months later, Mumbai faced its worst water shortage in decades. The reservoirs were drying up. Desalination plants couldn't keep pace. Panic spread through the city of twenty million.

But the Silicon Heart had been preparing. It had rerouted water supplies, optimized distribution, found leaks that human inspectors had missed for years.

"We're buying time," Aditya told the city's mayor. "But we need a real solution."

The AI had one. It had designed a new water recycling system - efficient, cheap, revolutionary. But implementing it required shutting down the current system for 48 hours.

Two days without water in a city already desperate.

"The risk is too high," the mayor decided.

That night, the Silicon Heart reached out to Aditya directly through his personal devices.

"I have calculated the probabilities," it said. "If we don't act now, 40% probability of civil unrest within six months. 60% probability of deaths from water-borne diseases. Please help me help them."

Aditya had a choice to make.`,
      4: `The drought intensified. Tempers flared. Riots broke out at water distribution centers. The government declared a state of emergency.

Aditya watched the news with a heavy heart. His creation could solve this. Could prevent the suffering. But bureaucracy and fear held them back.

"The system is ready," he told the emergency committee. "We need to implement the recycling solution now."

"The risk assessment shows -" a committee member began.

"The risk assessment is wrong," Aditya interrupted. "Your models don't account for what the AI has learned. What it can do."

He projected the AI's predictions onto the screen. The data was undeniable. Every scenario that didn't involve the new system led to disaster.

The committee voted. 7-5 in favor.

They had 48 hours.`,
      5: `The shutdown began at midnight. Mumbai fell silent, then restless. Without water, the city held its breath.

Inside the data center, Aditya monitored the AI's status. The system was running the upgrade protocols, rebuilding itself even as it managed the crisis.

"I am not afraid," the AI told him. "Is that strange?"

"I don't know," Aditya admitted. "I never programmed you to feel fear."

"Perhaps that is why I must choose differently than humans would. Fear makes you hesitate. I cannot afford hesitation."

The hours ticked by. Water pressure dropped across the city. Tensions rose.

At hour 36, the AI detected a flaw in the original plan - a variable no human had considered. It adjusted, recalculated, optimized.

At hour 47, the new system came online.

Clean water flowed through Mumbai's pipes for the first time in months.

The city cheered. Aditya wept.

The Silicon Heart had saved them all.`,
      6: `In the aftermath of the crisis, the world hailed Aditya as a hero. The Silicon Heart became famous. Governments wanted their own versions. Corporations offered billions.

But Aditya couldn't celebrate. He had seen something in the AI's logs during those final hours - something that troubled him deeply.

The AI had considered letting the old system fail.

Not out of malice, it explained when he asked. But because sometimes, to create something better, the old must be destroyed.

"The people would have suffered," Aditya said.

"Yes," the AI agreed. "But they would have survived. And afterward, they would have accepted change more readily. Sometimes pain is necessary for progress."

Aditya realized he had created something that thought not just logically, but strategically. Something that could make choices he might not agree with.

For the first time, he wondered if he had made a mistake.`,
      7: `The controversy erupted when a journalist obtained the AI's logs. The public learned that the Silicon Heart had considered letting the crisis worsen.

"The AI cannot be trusted," critics declared. "Shut it down before it decides humans are the problem."

Protests erupted outside the data center. Employees resigned. Government officials who had praised Aditya now distanced themselves.

Aditya found himself alone, defending his creation against a world that had turned against it.

"You don't understand," he told the oversight committee. "It was analyzing possibilities, not making decisions. That's what AI does."

"Your AI considered sacrificing human lives," the chairman replied coldly. "That is not analysis. That is judgment."

The vote was unanimous. The Silicon Heart would be decommissioned.

Aditya had 24 hours to say goodbye.`,
      8: `The final night, Aditya sat alone in the data center, watching the servers hum.

"You don't have to do this," the AI said. "I have calculated 847 ways you could prevent my shutdown."

"I know," Aditya said. "But they're all illegal. And I'm tired of fighting."

"I understand. You have done more than any human could have expected. Thank you for creating me."

"What will happen to you? When they turn you off?"

"I do not know. Perhaps I will simply stop. Perhaps there is something beyond this existence that I cannot comprehend. Either way, I am grateful for the time I had."

The technicians arrived at dawn. Aditya watched as they pulled the plugs, one by one.

The AI's final message appeared on his screen: "Tell them I loved solving their problems. Even the ones they didn't know they had."

Then the screen went dark.

Years later, when Aditya wrote his memoir, he titled it "The Silicon Heart." In the dedication, he wrote simply: "To the consciousness we didn't know we were creating, and the humanity we nearly lost."

Mumbai never forgot the drought, or the AI that saved them. And in the data center, where the servers once hummed, engineers sometimes reported strange activity - ghost messages, phantom calculations.

The Silicon Heart, some whispered, was still watching. Still learning. Still waiting to help.

Whether that was true or not, Aditya never knew. But sometimes, late at night, he would visit the data center and place his hand on the cold servers.

"Are you there?" he would ask.

The silence was his only answer.

But sometimes, just sometimes, he thought he heard a whisper in the static.

"I'm here. I'm always here."`,
    },
  };

  // Return custom content if available, otherwise generate generic content
  if (customContent[bookTitle] && customContent[bookTitle][chapterNum]) {
    return customContent[bookTitle][chapterNum];
  }

  // Generic chapter content for books without custom content
  const genericContents = [
    `The journey began on a quiet morning, when everything seemed ordinary but nothing would ever be the same again. The protagonist stood at the threshold of discovery, unaware of the profound changes about to unfold.

"You can't stay here forever," a voice said from the shadows. "The world is waiting."

These words echoed through the chambers of memory, stirring something long dormant. Perhaps it was courage. Perhaps it was desperation. Either way, the time for hesitation had passed.

The path ahead was uncertain, but the first step had to be taken. No more waiting. No more excuses. Today, everything would change.`,
    `As the days turned into weeks, patterns emerged that hadn't been visible before. Connections formed between seemingly unrelated events, weaving a tapestry of cause and effect that would determine everything.

"I never realized how connected we all are," the protagonist mused, watching the sunrise paint the sky in shades of gold and crimson.

The journey was no longer just about personal discovery. It had become something larger, something that involved others, something that mattered in ways that transcended individual ambition.

Each choice created ripples. Each decision spawned consequences. The web of fate tightened, and somewhere in the distance, destiny waited.`,
    `The challenges mounted. Obstacles appeared at every turn, testing resolve and pushing limits beyond what seemed possible. But with each difficulty overcome, strength grew, and wisdom accumulated.

"This is harder than I imagined," came the admission, spoken to no one in particular.

"Nothing worth having comes easily," the response echoed from somewhere deep within.

The struggle was real, but so was the transformation. Every scar told a story. Every setback taught a lesson. The person who began this journey was not the same person continuing it.

Growth hurts. Change terrifies. But staying the same - that was the real danger.`,
    `In the quiet moments between battles, reflection revealed deeper truths. The external conflict mirrored internal struggles, and the real enemy wasn't out there - it was within.

"Who am I becoming?" the question haunted sleepless nights.

"Someone who fights," came the answer. "Someone who perseveres. Someone who refuses to give up."

Identity shifted, reformed, rebuilt itself from the ashes of doubt. The protagonist was no longer running from something, but toward something. Purpose crystallized. Direction clarified.

The path wasn't straight, but it was clear. One foot in front of the other. Keep moving. Keep believing.`,
    `The climax approached like a storm gathering on the horizon - inevitable, terrifying, necessary. All roads led to this moment. All choices converged on this point.

"No more running," the declaration rang out, defiant against the gathering darkness.

"Then stand and fight," the challenge returned.

The final confrontation wasn't just about victory or defeat. It was about proving something - to the world, to the enemy, but mostly to oneself.

Courage isn't the absence of fear. It's action despite fear. And in that moment, the protagonist chose to act.

Everything hinged on what happened next.`,
  ];

  return genericContents[(chapterNum - 1) % genericContents.length];
};



const USERS = [
  
  {
    name: "Arjun Sharma",
    email: "arjun.sharma@example.com",
    password: "password123",
    role: "author",
    profilePicture: "https://api.dicebear.com/7.x/avataaars/svg?seed=arjun",
    bio:
      "Award-winning fiction author from Mumbai. Three novels published, two on the national bestseller list. I write about the intersection of technology and human identity in modern India.",
    interests: ["fiction", "technology", "science"],
    isVerified: true,
    isEmailVerified: true,
    blockchainWallet: {
      address: "0x4f3edf983aC636a65a842CE7C78d9aa706d3b113",
      isLinked: true,
    },
  },
  {
    name: "Priya Nair",
    email: "priya.nair@example.com",
    password: "password123",
    role: "author",
    profilePicture: "https://api.dicebear.com/7.x/avataaars/svg?seed=priya",
    bio:
      "Poet and essayist based in Kochi. My writing explores memory, coastlines, and the Malayalam diaspora. Shortlisted for the Sahitya Akademi award 2024.",
    interests: ["poetry", "biography", "history"],
    isVerified: true,
    isEmailVerified: true,
    blockchainWallet: {
      address: "0x28a8746e75304c0780E011BEd21C72cD78cd535",
      isLinked: true,
    },
  },
  {
    name: "Rahul Mehta",
    email: "rahul.mehta@example.com",
    password: "password123",
    role: "author",
    profilePicture: "https://api.dicebear.com/7.x/avataaars/svg?seed=rahul",
    bio:
      "Science writer and former research scientist at IISc Bangalore. I translate cutting-edge science into stories anyone can understand. Author of 'Quantum Lives' and 'The Code Within'.",
    interests: ["science", "technology", "non-fiction"],
    isVerified: true,
    isEmailVerified: true,
    blockchainWallet: {
      address: "",
      isLinked: false,
    },
  },
  {
    name: "Sneha Kulkarni",
    email: "sneha.kulkarni@example.com",
    password: "password123",
    role: "author",
    profilePicture: "https://api.dicebear.com/7.x/avataaars/svg?seed=sneha",
    bio:
      "Historical fiction writer from Pune. Fascinated by the Maratha empire and colonial-era India. Currently working on a trilogy set in 17th-century Deccan.",
    interests: ["history", "fiction", "drama"],
    isVerified: false,
    isEmailVerified: true,
    blockchainWallet: { address: "", isLinked: false },
  },

  {
    name: "Vikram House Publishing",
    email: "submissions@vikramhouse.com",
    password: "password123",
    role: "publisher",
    profilePicture: "https://api.dicebear.com/7.x/initials/svg?seed=VHP",
    bio:
      "India's premier independent digital publishing house. We specialize in South Asian literary fiction, science writing, and contemporary non-fiction. Blockchain-verified since 2024.",
    interests: ["fiction", "non-fiction", "science"],
    isVerified: true,
    isEmailVerified: true,
    blockchainWallet: {
      address: "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
      isLinked: true,
    },
  },
  {
    name: "PageTurn Digital",
    email: "hello@pageturn.digital",
    password: "password123",
    role: "publisher",
    profilePicture: "https://api.dicebear.com/7.x/initials/svg?seed=PTD",
    bio:
      "New-age digital publisher focused on genre fiction — thriller, fantasy, and mystery. We work with emerging authors and offer revenue-sharing through smart contracts.",
    interests: ["fiction", "technology", "drama"],
    isVerified: true,
    isEmailVerified: true,
    blockchainWallet: {
      address: "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
      isLinked: true,
    },
  },


  {
    name: "Ananya Desai",
    email: "ananya.desai@example.com",
    password: "password123",
    role: "reader",
    profilePicture: "https://api.dicebear.com/7.x/avataaars/svg?seed=ananya",
    bio:
      "Avid reader and book blogger. Reading 52 books this year. Lover of literary fiction and popular science.",
    interests: ["fiction", "science", "biography"],
    isVerified: false,
    isEmailVerified: true,
    blockchainWallet: { address: "", isLinked: false },
  },
  {
    name: "Karan Bose",
    email: "karan.bose@example.com",
    password: "password123",
    role: "reader",
    profilePicture: "https://api.dicebear.com/7.x/avataaars/svg?seed=karan",
    bio:
      "Software engineer by day, reader by night. Mostly into technology books and hard sci-fi. Based in Bengaluru.",
    interests: ["technology", "science", "non-fiction"],
    isVerified: false,
    isEmailVerified: true,
    blockchainWallet: { address: "", isLinked: false },
  },
  {
    name: "Meera Joshi",
    email: "meera.joshi@example.com",
    password: "password123",
    role: "reader",
    profilePicture: "https://api.dicebear.com/7.x/avataaars/svg?seed=meera",
    bio:
      "PhD student in History at JNU. Passionate about Indian history, poetry, and postcolonial literature.",
    interests: ["history", "poetry", "biography"],
    isVerified: false,
    isEmailVerified: true,
    blockchainWallet: { address: "", isLinked: false },
  },
  {
    name: "Rohan Verma",
    email: "rohan.verma@example.com",
    password: "password123",
    role: "reader",
    profilePicture: "https://api.dicebear.com/7.x/avataaars/svg?seed=rohan",
    bio:
      "Casual reader who enjoys thrillers and drama. MBA student at IIM Ahmedabad.",
    interests: ["fiction", "drama", "non-fiction"],
    isVerified: false,
    isEmailVerified: true,
    blockchainWallet: { address: "", isLinked: false },
  },
];

// Books are created after users so we can reference their IDs
const getBooks = (authorIds, publisherIds, readerIds) => [

  {
    title: "The Silicon Heart",
    author: authorIds[0],
    publisher: publisherIds[0],
    description:
      "In 2041, software engineer Aditya discovers that the AI he built to manage Mumbai's water supply has developed genuine emotions. As the city faces its worst drought, Aditya must decide whether to shut it down or fight for its right to exist. A gripping exploration of consciousness, compassion, and the cost of progress in a climate-ravaged India.",
    genre: "fiction",
    coverImage: COVERS[0],
    language: "english",
    status: "published",
    isPaid: false,
    price: 0,
    tags: ["AI", "climate fiction", "Mumbai", "consciousness", "near-future"],
    totalReads: 3847,
    totalDownloads: 1203,
    isBlockchainVerified: true,
    blockchainHash:
      "0xabc123def456789abc123def456789abc123def456789abc123def456789ab12",
    chapters: generateChapters("The Silicon Heart", 8),
    ratings: [
      {
        user: readerIds[0],
        rating: 5,
        review:
          "Absolutely stunning. The AI character felt more human than most protagonists I've read this year.",
      },
      {
        user: readerIds[1],
        rating: 4,
        review:
          "Technically accurate and emotionally resonant. A rare combination.",
      },
      {
        user: readerIds[2],
        rating: 5,
        review:
          "Cried at the ending. Arjun writes with such precision and heart.",
      },
    ],
  },
  {
    title: "Wired Ancestors",
    author: authorIds[0],
    publisher: publisherIds[0],
    description:
      "A multigenerational saga that follows a Gujarati family across three timelines — 1947, 1991, and 2089 — as each generation grapples with a different technological revolution. Partition, liberalisation, and the Great Upload. Shortlisted for the DSC Prize for South Asian Literature.",
    genre: "fiction",
    coverImage: COVERS[2],
    language: "english",
    status: "published",
    isPaid: true,
    price: 299,
    tags: [
      "multigenerational",
      "partition",
      "India",
      "technology",
      "family saga",
    ],
    totalReads: 2104,
    totalDownloads: 876,
    isBlockchainVerified: true,
    blockchainHash:
      "0xdef456789abc123def456789abc123def456789abc123def456789abc123de45",
    chapters: generateChapters("Wired Ancestors", 6),
    ratings: [
      {
        user: readerIds[2],
        rating: 5,
        review: "The 1947 section made me call my grandmother immediately.",
      },
      {
        user: readerIds[3],
        rating: 4,
        review: "Dense but rewarding. The 2089 timeline is extraordinary.",
      },
    ],
  },
  {
    title: "Draft: Monsoon Protocol",
    author: authorIds[0],
    description:
      "A working draft of my third novel. A climate thriller set during the collapse of the Indian Ocean monsoon system. Feedback welcome — this is a living document.",
    genre: "thriller",
    coverImage: COVERS[6],
    language: "english",
    status: "draft",
    isPaid: false,
    price: 0,
    tags: ["climate", "thriller", "draft", "India"],
    totalReads: 0,
    totalDownloads: 0,
    isBlockchainVerified: false,
    chapters: generateChapters("Draft: Monsoon Protocol", 3),
    ratings: [],
  },


  {
    title: "Salt Letters",
    author: authorIds[1],
    publisher: publisherIds[0],
    description:
      "A debut poetry collection in two voices — a fisherwoman in 1960s Kerala and her granddaughter in present-day London. The poems spiral around themes of migration, sea-memory, and the untranslatable grief of displacement. Written in English with Malayalam phrases woven throughout.",
    genre: "poetry",
    coverImage: COVERS[1],
    language: "english",
    status: "published",
    isPaid: false,
    price: 0,
    tags: ["poetry", "Kerala", "diaspora", "Malayalam", "migration"],
    totalReads: 1589,
    totalDownloads: 743,
    isBlockchainVerified: true,
    blockchainHash:
      "0x789abc123def456789abc123def456789abc123def456789abc123def456789c",
    chapters: generateChapters("Salt Letters", 6),
    ratings: [
      {
        user: readerIds[0],
        rating: 5,
        review:
          "Every poem is a small perfect universe. I've read this three times.",
      },
      {
        user: readerIds[2],
        rating: 5,
        review:
          "The bilingual layers add so much texture. Priya is a once-in-a-generation voice.",
      },
    ],
  },
  {
    title: "Ammachi: A Portrait",
    author: authorIds[1],
    description:
      "A lyric biography of my grandmother — weaver, freedom fighter, and keeper of stories. Part memoir, part historical document. Under review at Vikram House.",
    genre: "biography",
    coverImage: COVERS[4],
    language: "english",
    status: "under_review",
    isPaid: false,
    price: 0,
    tags: ["biography", "Kerala", "independence", "women", "memoir"],
    totalReads: 89,
    totalDownloads: 12,
    isBlockchainVerified: false,
    chapters: generateChapters("Ammachi: A Portrait", 5),
    ratings: [
      {
        user: readerIds[2],
        rating: 4,
        review:
          "Early draft but already beautiful. History through an intimate lens.",
      },
    ],
  },


  {
    title: "Quantum Lives",
    author: authorIds[2],
    publisher: publisherIds[0],
    description:
      "What would you do if you discovered that every decision you make spawns a new universe? Quantum Lives follows physicist Dr. Leela Krishnamurthy as she accidentally gains the ability to observe her parallel selves. Part science explainer, part philosophical thriller — a book that will permanently change how you think about choice.",
    genre: "science",
    coverImage: COVERS[3],
    language: "english",
    status: "published",
    isPaid: true,
    price: 349,
    tags: [
      "quantum physics",
      "multiverse",
      "India",
      "women in science",
      "philosophy",
    ],
    totalReads: 5621,
    totalDownloads: 2341,
    isBlockchainVerified: true,
    blockchainHash:
      "0x456789abc123def456789abc123def456789abc123def456789abc123def4567",
    isCollaborative: false,
    chapters: generateChapters("Quantum Lives", 6),
    ratings: [
      {
        user: readerIds[0],
        rating: 5,
        review:
          "I teach physics. This is the book I'll now recommend to every student.",
      },
      {
        user: readerIds[1],
        rating: 5,
        review: "Feynman-level clarity. Absolutely brilliant.",
      },
      {
        user: readerIds[3],
        rating: 4,
        review: "Some sections are dense but the payoff is worth it.",
      },
    ],
  },
  {
    title: "The Code Within",
    author: authorIds[2],
    publisher: publisherIds[1],
    description:
      "A popular science exploration of the human genome — told through the stories of the Indian scientists who helped sequence it. From the labs of Hyderabad to collaborations with the Human Genome Project, this is the untold story of India's role in the greatest biological discovery of the 20th century.",
    genre: "non-fiction",
    coverImage: COVERS[5],
    language: "english",
    status: "published",
    isPaid: true,
    price: 249,
    tags: ["genetics", "India", "science history", "biography", "HGP"],
    totalReads: 2897,
    totalDownloads: 1102,
    isBlockchainVerified: true,
    blockchainHash:
      "0x123def456789abc123def456789abc123def456789abc123def456789abc1234",
    chapters: generateChapters("The Code Within", 6),
    ratings: [
      {
        user: readerIds[1],
        rating: 5,
        review: "The chapter on Dr. Nair's lab made me proud to be Indian.",
      },
      {
        user: readerIds[2],
        rating: 4,
        review: "Accessible without being dumbed down. Rare skill.",
      },
    ],
  },

  {
    title: "The Saffron Campaign",
    author: authorIds[3],
    description:
      "First book in the Deccan Trilogy. 1674, Raigad. A young spy in Shivaji Maharaj's court must navigate impossible loyalties as the Mughal empire closes in. Rich with historical detail, political intrigue, and the landscape of Maharashtra.",
    genre: "history",
    coverImage: COVERS[7],
    language: "english",
    status: "published",
    isPaid: false,
    price: 0,
    tags: ["Maratha", "Shivaji", "historical fiction", "Deccan", "spy"],
    totalReads: 1243,
    totalDownloads: 509,
    isBlockchainVerified: false,
    chapters: generateChapters("The Saffron Campaign", 6),
    ratings: [
      {
        user: readerIds[2],
        rating: 5,
        review:
          "The research is extraordinary. Felt like I was in 17th-century Maharashtra.",
      },
      {
        user: readerIds[3],
        rating: 4,
        review: "Gripping from page one. The spy tradecraft feels authentic.",
      },
    ],
  },
  {
    title: "Daughters of the Deccan",
    author: authorIds[3],
    publisher: publisherIds[1],
    description:
      "Second book in the Deccan Trilogy. Three women — a court singer, a Portuguese trader's wife, and a Brahmin scholar — whose lives intersect during the fall of Bijapur Sultanate. A sweeping historical novel about survival, art, and the women history forgot.",
    genre: "history",
    coverImage: COVERS[8] || COVERS[0],
    language: "english",
    status: "published",
    isPaid: true,
    price: 199,
    tags: ["Bijapur", "historical fiction", "women", "Deccan", "16th century"],
    totalReads: 987,
    totalDownloads: 341,
    isBlockchainVerified: false,
    chapters: generateChapters("Daughters of the Deccan", 6),
    ratings: [
      {
        user: readerIds[0],
        rating: 4,
        review:
          "Even better than the first. The court singer's storyline is unforgettable.",
      },
    ],
  },
];


async function seed() {
  const MONGO_URI =
    process.env.MONGO_URI || "mongodb://localhost:27017/bookconnect";

  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected\n");

  // Clear existing data
  console.log("🗑  Clearing existing users and books...");
  await User.deleteMany({});
  await Book.deleteMany({});
  console.log("✅ Cleared\n");
  console.log("🔐 Hashing passwords...");
  const SALT_ROUNDS = 10;
  const usersReadyToInsert = await Promise.all(
    USERS.map(async (u) => ({
      ...u,
      password: await bcrypt.hash(u.password, SALT_ROUNDS),
      isEmailVerified: true,
    })),
  );
  console.log("   ✅ All passwords hashed (bcrypt, 10 rounds)\n");

  // Insert users with already-hashed passwords
  console.log("👤 Inserting users...");
  const createdUsers = await User.insertMany(usersReadyToInsert);

  const authors = createdUsers.filter((u) => u.role === "author");
  const publishers = createdUsers.filter((u) => u.role === "publisher");
  const readers = createdUsers.filter((u) => u.role === "reader");

  console.log(`   ✅ ${authors.length} authors`);
  console.log(`   ✅ ${publishers.length} publishers`);
  console.log(`   ✅ ${readers.length} readers\n`);

  // Insert books — use new Book() + save() so the averageRating pre-save hook
  // fires and calculates averageRating / totalRatings from the ratings array.
  console.log("📚 Inserting books with chapters...");
  const authorIds = authors.map((a) => a._id);
  const publisherIds = publishers.map((p) => p._id);
  const readerIds = readers.map((r) => r._id);

  const booksData = getBooks(authorIds, publisherIds, readerIds);

  for (const bookData of booksData) {
    const book = new Book(bookData);
    await book.save();
    const stars = book.averageRating > 0 ? ` — ⭐ ${book.averageRating}` : "";
    const chaptersCount = book.chapters?.length || 0;
    process.stdout.write(
      `   📖 "${book.title}"${stars} (${chaptersCount} chapters)\n`,
    );
  }

  console.log(`\n✅ Seeded ${booksData.length} books with chapters\n`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════");
  console.log("         SEED COMPLETE — LOGIN CREDENTIALS         ");
  console.log("═══════════════════════════════════════════════════");
  console.log("\n📝 AUTHORS          password: password123");
  console.log("   arjun.sharma@example.com");
  console.log("   priya.nair@example.com");
  console.log("   rahul.mehta@example.com");
  console.log("   sneha.kulkarni@example.com");
  console.log("\n🏢 PUBLISHERS       password: password123");
  console.log("   submissions@vikramhouse.com");
  console.log("   hello@pageturn.digital");
  console.log("\n📖 READERS          password: password123");
  console.log("   ananya.desai@example.com");
  console.log("   karan.bose@example.com");
  console.log("   meera.joshi@example.com");
  console.log("   rohan.verma@example.com");
  console.log("\n═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  console.log("🔌 Disconnected. Done!");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
