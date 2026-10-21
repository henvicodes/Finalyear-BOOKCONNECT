/**
 * All the plain-language help text in one place, so wording is easy to review
 * and fix without hunting through components.
 *
 * Every feature entry says WHERE it lives:
 *   tab:  a sidebar item inside the user's own dashboard
 *   path: a page reached from the top navigation bar / profile menu
 * `where` is the human-readable version shown to the user.
 *
 * Keep the claims here true to what the code does — e.g. the "quality score"
 * is a readability estimate, not an AI judgement of the story.
 */
import {
  Search, BookMarked, Heart, Star, UserCheck, MessageCircle, Settings, Sparkles,
  Wallet, BookOpen, Upload, Shield, TrendingUp, FileText, Users, Languages,
  Highlighter, Lightbulb, BarChart2, Send,
} from "lucide-react";

// Terms that appear around the app, explained without jargon.
export const GLOSSARY = [
  {
    term: "Wallet balance",
    text: "Your in-app money, shown in dollars. It's used to buy books and to pay publishing fees. It's hidden by default — click the eye icon and enter your PIN to see it.",
  },
  {
    term: "Security PIN",
    text: "A 4-digit code you choose the first time you need it. It protects your balance and approves payments. It is not your login password.",
  },
  {
    term: "MetaMask",
    text: "A free browser extension that works as a crypto wallet. It's optional: you only need it for the blockchain features (registering a manuscript on-chain, or sending a payment that is also recorded on the blockchain). Readers, authors and publishers can all link it from the Wallet section of their Profile page. Payments are only recorded on the blockchain when both people have linked a wallet; otherwise they stay inside BookConnect.",
  },
  {
    term: "Sepolia testnet",
    text: "A practice version of the Ethereum blockchain. Nothing on it has real money value. To use it you need a tiny amount of free \"test ETH\" for fees — search for \"Sepolia faucet\" to get some.",
  },
  {
    term: "On-chain registration",
    text: "Saves a fingerprint of your manuscript on a public blockchain, so you can later prove you had this exact text by that date. Your story itself is not published — only the fingerprint.",
  },
  {
    term: "Fingerprint (hash)",
    text: "A short code worked out from your text. Change even one letter and the code changes completely, which is how a change can be detected.",
  },
  {
    term: "Publishing fee",
    text: "What a publisher charges to publish your manuscript. The publisher proposes the amount; you accept by paying it from your wallet balance, and the book goes live.",
  },
  {
    term: "Quality score",
    text: "A simple estimate worked out from a reading-ease formula and the length of your text. It is not AI and not a judgement of how good your story is.",
  },
  {
    term: "Plagiarism score",
    text: "How similar your text is to books already on BookConnect (0% = nothing similar). It only compares against books on this platform, not the whole internet.",
  },
  {
    term: "Version history",
    text: "A timeline of saved versions of your manuscript. Each version has its own fingerprint, so you can see when it changed.",
  },
  {
    term: "Free vs paid books",
    text: "Free books can be read straight away. Paid books show the cover, price and chapter titles — the chapters unlock once you buy the book.",
  },
  {
    term: "Genre suggestion",
    text: "A model trained on thousands of book summaries reads your text and suggests genres. It's only a suggestion — you always choose.",
  },
];

// "Where do I look?" for each role.
export const GUIDE = {
  reader: {
    title: "Reader guide",
    intro: "Find books, read them, and get to know authors. Here is everything you can do and where to find it.",
    journey: [
      "Find a book in Discover marketplace",
      "Unlock it — free books open at once, paid books ask for your PIN",
      "Open it from My Library and start reading",
      "Rate it with the stars at the top of the reader",
    ],
    features: [
      { icon: Search, title: "Browse and search books", text: "See every published book. Green \"Free\" and indigo \"$\" badges show the price. Filter by genre or search by title.", where: "Sidebar → Discover marketplace", tab: "discover", keywords: "find search genre buy price" },
      { icon: Wallet, title: "Buy a paid book", text: "Press Purchase on a book. You'll be asked for your 4-digit PIN, then to confirm the payment. Chapters unlock straight after.", where: "Sidebar → Discover marketplace", tab: "discover", keywords: "pay purchase unlock pin money" },
      { icon: BookMarked, title: "Read your books", text: "Everything you've unlocked lives here, with your reading progress. Open a book to start reading.", where: "Sidebar → My Library", tab: "library", keywords: "read library progress continue" },
      { icon: Languages, title: "Translate a chapter", text: "While reading, use the Translate drop-down at the top of the reader, pick a language, and press Translate. \"Show Original\" switches back.", where: "Inside the reader (open a book from My Library)", tab: "library", keywords: "translate language hindi english" },
      { icon: Highlighter, title: "Highlight text", text: "While reading, select any words with your mouse and press the yellow Highlight button. Click a highlight to remove it. Highlights are saved on this device.", where: "Inside the reader (open a book from My Library)", tab: "library", keywords: "highlight mark note underline" },
      { icon: Star, title: "Rate a book", text: "Click the stars at the top of the reader to rate instantly, or leave a written review from the book's details.", where: "Inside the reader — top right; reviews in My Reviews", tab: "myreviews", keywords: "rate review stars" },
      { icon: Heart, title: "Save for later", text: "Press the heart on any book to add it to your reading list. The list is stored on this device.", where: "Sidebar → Reading List", tab: "readinglist", keywords: "wishlist save later favourite" },
      { icon: Lightbulb, title: "Books picked for you", text: "Recommendations based on books you've bought, rated highly, and your interests.", where: "Top bar → For You", path: "/recommendations", keywords: "recommend suggestions for you" },
      { icon: UserCheck, title: "Authors who match your taste", text: "People whose interests are similar to yours. Press Message to start a chat.", where: "Sidebar → Matchmaker (or top bar → Connect)", tab: "matchmaker", keywords: "match connect author follow" },
      { icon: MessageCircle, title: "Chat", text: "Message authors and publishers, or ask the built-in AI assistant a question.", where: "Sidebar → Messages", tab: "messages", keywords: "chat message talk assistant" },
      { icon: Wallet, title: "Check your wallet balance", text: "Your balance is hidden by default. Click the eye in the Wallet Balance box and enter your 4-digit PIN to see it.", where: "Left sidebar → Wallet Balance", tab: "overview", keywords: "wallet balance money pin eye" },
      { icon: Settings, title: "Your details & dark mode", text: "Change your name, bio and interests (interests improve your recommendations), and switch between light and dark.", where: "Sidebar → Settings", tab: "settings", keywords: "profile dark theme interests name" },
    ],
  },

  author: {
    title: "Author guide",
    intro: "Write, publish and protect your books. Here is everything you can do and where to find it.",
    journey: [
      "Write your manuscript in Upload Book",
      "Choose a publisher and submit it",
      "The publisher reads your draft and sends you an offer to publish",
      "Press Pay & Publish in My Books — your book goes live",
    ],
    features: [
      { icon: Upload, title: "Write a new book", text: "Add a title, genre, price, cover and your text. Use \"Suggest genre from my text\" if you're not sure which genre fits.", where: "Sidebar → Upload Book", tab: "upload", keywords: "write create new manuscript cover genre price" },
      { icon: BookOpen, title: "Add chapters", text: "Open a book with Edit, then use the Manage Chapters panel at the bottom to add, edit or delete chapters one by one.", where: "Sidebar → My Books → Edit", tab: "mybooks", keywords: "chapter write edit order" },
      { icon: Send, title: "Submit to a publisher", text: "Pick a publisher from the list and submit. They'll review it and may propose a publishing fee.", where: "Sidebar → Upload Book (or My Books → Edit)", tab: "upload", keywords: "submit publisher send review" },
      { icon: BookOpen, title: "See all your books", text: "Every manuscript with its status: Draft, Reviewing, Read by publisher, Offer received or Published. When a fee is proposed, a Pay & Publish button appears here.", where: "Sidebar → My Books", tab: "mybooks", keywords: "status pay publish fee list" },
      { icon: Sparkles, title: "AI writing helper", text: "Paste text and have it rewritten more simply, more formally, or summarised. There are also creative presets for ideas.", where: "Sidebar → AI Assistant", tab: "aiassist", keywords: "ai rewrite simplify summarise help ideas" },
      { icon: Shield, title: "Protect your work (blockchain)", text: "Create a fingerprint of your manuscript, optionally register it on the Sepolia test blockchain with MetaMask, verify it later, and see every saved version.", where: "Sidebar → Blockchain", tab: "blockchain", keywords: "blockchain copyright register verify hash version history metamask sepolia" },
      { icon: TrendingUp, title: "Readers and earnings", text: "See how many reads each book has and what you've earned.", where: "Sidebar → Analytics", tab: "analytics", keywords: "reads earnings stats analytics" },
      { icon: MessageCircle, title: "Chat with publishers", text: "Negotiate with publishers, or ask the built-in AI assistant a question.", where: "Sidebar → Messages", tab: "messages", keywords: "chat message publisher negotiate" },
      { icon: Wallet, title: "Wallet, MetaMask & payments", text: "Check your balance in the sidebar (click the eye, enter your PIN). To link MetaMask, see your payment history, or send money to another user, open your Profile page. Forgot your PIN? Use “Forgot or reset PIN” and confirm with your account password.", where: "Sidebar → Wallet Balance; and your avatar (top right) → My Profile", path: "/profile", keywords: "wallet balance metamask send history crypto pin" },
      { icon: Users, title: "Find readers and publishers", text: "People whose interests match yours.", where: "Top bar → Connect", path: "/matching", keywords: "match connect network" },
      { icon: Settings, title: "Your details & dark mode", text: "Change your name, bio and genres, and switch between light and dark.", where: "Sidebar → Settings", tab: "settings", keywords: "profile dark theme bio" },
    ],
  },

  publisher: {
    title: "Publisher guide",
    intro: "Review manuscripts, agree a fee with authors, and publish. Here is everything you can do and where to find it.",
    journey: [
      "An author sends you their draft",
      "Open it in Submissions and read it",
      "Send the author an offer to publish (the fee)",
      "When the author pays, the book goes live and the fee reaches your wallet",
    ],
    features: [
      { icon: FileText, title: "Read submitted drafts", text: "Manuscripts authors have sent to you. Click one to read the whole draft, including its chapters — opening it tells the author you have read it. You can also run the scan to see its readability and how similar it is to books already on the platform.", where: "Sidebar → Submissions", tab: "submissions", keywords: "review manuscript scan check plagiarism quality" },
      { icon: BarChart2, title: "Send an offer to publish", text: "After reading the draft, type the publishing fee and send your offer to the author. If they accept by paying it, the book goes live.", where: "Sidebar → Submissions → open a manuscript", tab: "submissions", keywords: "fee cost price propose" },
      { icon: BookOpen, title: "Your published books", text: "Books you've published through BookConnect.", where: "Sidebar → Published", tab: "published", keywords: "published books list" },
      { icon: Users, title: "Find authors", text: "Search the author directory.", where: "Sidebar → Authors Directory", tab: "authors", keywords: "author directory search find" },
      { icon: MessageCircle, title: "Negotiate by chat", text: "Talk to authors about terms, or ask the built-in AI assistant a question.", where: "Sidebar → Negotiations", tab: "messages", keywords: "chat negotiate message" },
      { icon: Shield, title: "Verified-publisher badge", text: "Add a link to a document that shows who you are, to mark your account as verified.", where: "Sidebar → Web3 Trust Proof", tab: "verification", keywords: "verify trust proof badge identity" },
      { icon: Wallet, title: "Check your wallet balance", text: "Fees you earn are added to your balance. It is hidden by default — click the eye in the Wallet Balance box and enter your PIN.", where: "Left sidebar → Wallet Balance", tab: "overview", keywords: "wallet balance money earnings pin eye" },
      { icon: Settings, title: "Your details & dark mode", text: "Change your name, bio and interests, and switch between light and dark.", where: "Sidebar → Settings", tab: "settings", keywords: "profile dark theme bio" },
    ],
  },
};
