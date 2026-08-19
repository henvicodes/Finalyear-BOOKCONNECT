const Book = require("../models/Book");
const { snapshotVersion } = require("../utils/versionHistory");

// Weighted ranking formula: Final Score = α·UserRating + β·AIQualityScore + γ·EngagementScore
// Each term is normalized to 0-100 before weighting, so the weights below
// (which sum to 1) can be read directly as "how much each factor matters".
const RANK_WEIGHTS = { rating: 0.5, quality: 0.3, engagement: 0.2 };

const getBooks = async (req, res) => {
  try {
    const {
      search,
      genre,
      status = "published",
      page = 1,
      limit = 12,
      sort = "-createdAt",
      author,
    } = req.query;

    const query = { status };

    if (genre) query.genre = genre;
    if (author) query.author = author;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    // "ranked" sort uses the weighted formula instead of a plain field sort.
    if (sort === "ranked") {
      const [{ books, total } = { books: [], total: 0 }] = await rankedBookQuery(query, skip, Number(limit));
      return res.json({
        success: true,
        data: books,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
      });
    }

    const [books, total] = await Promise.all([
      Book.find(query)
        // Chapter/manuscript text never belongs in a list response — actual
        // chapter content is only ever served through the dedicated,
        // purchase-gated getChapterContent endpoint below. Without this,
        // every paid book's full text was sitting in the browse/discover
        // list response, readable before any purchase check ran.
        .select("-content -chapters.content")
        .populate("author", "name profilePicture role blockchainWallet walletAddress")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Book.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: books,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getBooks error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Runs the weighted-ranking aggregation and returns paginated, populated
// results in one round trip (via $facet), plus the total match count.
async function rankedBookQuery(matchQuery, skip, limit) {
  const [maxReadsResult] = await Book.aggregate([
    { $match: matchQuery },
    { $group: { _id: null, maxReads: { $max: "$totalReads" } } },
  ]);
  const maxReads = maxReadsResult?.maxReads || 0;

  const pipeline = [
    { $match: matchQuery },
    {
      $addFields: {
        // Unrated/unevaluated books get a neutral default rather than 0, so
        // brand-new books aren't automatically buried beneath low performers.
        _ratingScore: {
          $cond: [{ $gt: ["$totalRatings", 0] }, { $multiply: [{ $divide: ["$averageRating", 5] }, 100] }, 50],
        },
        _qualityScore: { $ifNull: ["$qualityScore", 70] },
        // Log-scaled against the highest read count in this result set, since
        // raw view counts are typically power-law distributed (a few books
        // dominate) — log compresses that so engagement isn't all-or-nothing.
        _engagementScore: {
          $cond: [
            { $gt: [maxReads, 0] },
            {
              $multiply: [
                { $divide: [{ $ln: { $add: [{ $ifNull: ["$totalReads", 0] }, 1] } }, Math.log(maxReads + 1)] },
                100,
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        rankScore: {
          $add: [
            { $multiply: ["$_ratingScore", RANK_WEIGHTS.rating] },
            { $multiply: ["$_qualityScore", RANK_WEIGHTS.quality] },
            { $multiply: ["$_engagementScore", RANK_WEIGHTS.engagement] },
          ],
        },
      },
    },
    { $sort: { rankScore: -1 } },
    {
      $facet: {
        books: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [{ $project: { name: 1, profilePicture: 1, role: 1, blockchainWallet: 1, walletAddress: 1 } }],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
          // Same reasoning as the plain-sort getBooks query above: never
          // ship full chapter/manuscript text in a list response.
          { $project: { content: 0, "chapters.content": 0 } },
        ],
        totalCount: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await Book.aggregate(pipeline);
  return [{ books: result?.books || [], total: result?.totalCount?.[0]?.count || 0 }];
}

const getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id)
      .populate("author", "name profilePicture bio role blockchainWallet walletAddress")
      .populate("collaborators", "name profilePicture");

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    }

    // Increment reads count
    Book.findByIdAndUpdate(req.params.id, { $inc: { totalReads: 1 } }).exec();

    // Chapter/manuscript text is only meant to reach readers through the
    // purchase-gated getChapterContent endpoint — strip it here too,
    // *except* for the book's own author, who still needs full chapter
    // content in this response for the /edit-book/:id editing flow
    // (ChapterManager pre-fills its edit form from this data).
    const isOwner = req.user && book.author?._id?.toString() === req.user._id.toString();
    const responseBook = book.toObject();
    if (!isOwner) {
      delete responseBook.content;
      responseBook.chapters = (responseBook.chapters || []).map(({ content, ...rest }) => rest);
    }

    res.json({ success: true, data: responseBook });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/books  (author only)
const createBook = async (req, res) => {
  try {
    const {
      title,
      description,
      genre,
      language,
      isPaid,
      price,
      tags,
      coverImage,
    } = req.body;

    if (!title || !description || !genre) {
      return res.status(400).json({
        success: false,
        message: "Title, description and genre are required",
      });
    }

    const book = new Book({
      title,
      description,
      genre,
      language: language || "english",
      isPaid: isPaid || false,
      price: isPaid ? price : 0,
      tags: tags || [],
      coverImage,
      author: req.user._id,
      status: "draft",
    });
    snapshotVersion(book, "Manuscript created");
    await book.save();
    await book.populate("author", "name profilePicture blockchainWallet walletAddress");

    res.status(201).json({ success: true, data: book });
  } catch (error) {
    console.error("createBook error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/books/:id  (author only, own books)
const updateBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    }

    if (book.author.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const allowedFields = [
      "title",
      "description",
      "genre",
      "language",
      "isPaid",
      "price",
      "tags",
      "coverImage",
      "status",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        book[field] = req.body[field];
      }
    });

    if (req.body.title !== undefined || req.body.description !== undefined) {
      snapshotVersion(book, "Edited");
    }
    await book.save();
    await book.populate("author", "name profilePicture blockchainWallet walletAddress");

    res.json({ success: true, data: book });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/books/:id  (author only, own books)
const deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    }

    if (
      book.author.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    await book.deleteOne();
    res.json({ success: true, message: "Book deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/books/:id/publish  (author, own books)
const publishBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    }

    if (book.author.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    book.status = "published";
    snapshotVersion(book, "Published");
    await book.save();

    res.json({
      success: true,
      data: book,
      message: "Book published successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/books/:id/rate  (authenticated users)
const rateBook = async (req, res) => {
  try {
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5" });
    }

    const book = await Book.findById(req.params.id);

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    }

    // if user already rated
    const existingRating = book.ratings.find(
      (r) => r.user.toString() === req.user._id.toString(),
    );

    if (existingRating) {
      existingRating.rating = rating;
      existingRating.review = review || existingRating.review;
    } else {
      book.ratings.push({ user: req.user._id, rating, review });
    }

    await book.save();
    res.json({
      success: true,
      data: {
        averageRating: book.averageRating,
        totalRatings: book.totalRatings,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/books/my-books  (author's own books)
const getMyBooks = async (req, res) => {
  try {
    const books = await Book.find({ author: req.user._id })
      .sort("-createdAt")
      .select(
        "title genre status totalReads averageRating createdAt coverImage",
      );

    res.json({ success: true, data: books });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get all chapters of a book — titles/order only (a table-of-contents
// preview). This stays public even for paid books; the actual chapter
// TEXT is only ever served through the purchase-gated getChapterContent
// endpoint below.
const getBookChapters = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id)
      .select("title chapters author")
      .populate("author", "name");

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    }

    const chapters = book.chapters
      .sort((a, b) => a.order - b.order)
      .map((c) => ({ _id: c._id, title: c.title, order: c.order }));

    res.json({
      success: true,
      data: {
        bookId: book._id,
        bookTitle: book.title,
        author: book.author,
        chapters,
      },
    });
  } catch (error) {
    console.error("getBookChapters error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get specific chapter content
const getChapterContent = async (req, res) => {
  try {
    const { id, chapterId } = req.params;

    const book = await Book.findById(id)
      .select("title author chapters isPaid price")
      .populate("author", "name");

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    }

    const chapter = book.chapters.id(chapterId);

    if (!chapter) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    // Paid books require the reader to have purchased it (or be its
    // author) before the actual chapter text is returned — this is the
    // one and only place chapter content is served, so gating here is
    // what actually enforces "pay to read" rather than just the UI.
    if (book.isPaid) {
      const isAuthor = req.user && book.author?._id?.toString() === req.user._id.toString();
      const hasPurchased =
        !isAuthor &&
        req.user &&
        (req.user.purchasedBooks || []).some((pid) => pid.toString() === book._id.toString());

      if (!isAuthor && !hasPurchased) {
        return res.status(403).json({
          success: false,
          message: "Purchase this book to read its chapters.",
          requiresPurchase: true,
          price: book.price,
        });
      }
    }

    res.json({
      success: true,
      data: {
        bookId: book._id,
        bookTitle: book.title,
        author: book.author,
        chapter: {
          id: chapter._id,
          title: chapter.title,
          content: chapter.content,
          order: chapter.order,
        },
      },
    });
  } catch (error) {
    console.error("getChapterContent error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Add a new chapter (author only)
const addChapter = async (req, res) => {
  try {
    const { title, content, order } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required",
      });
    }

    const book = await Book.findById(req.params.id);

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    }

    // Check if user is the author
    if (book.author.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const newOrder = order || book.chapters.length + 1;

    book.chapters.push({
      title,
      content,
      order: newOrder,
    });

    snapshotVersion(book, "Chapter added");
    await book.save();

    res.status(201).json({
      success: true,
      data: book.chapters[book.chapters.length - 1],
      versionHistory: book.versionHistory,
      message: "Chapter added successfully",
    });
  } catch (error) {
    console.error("addChapter error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update a chapter (author only)
const updateChapter = async (req, res) => {
  try {
    const { title, content, order } = req.body;
    const { id, chapterId } = req.params;

    const book = await Book.findById(id);

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    }

    if (book.author.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const chapter = book.chapters.id(chapterId);

    if (!chapter) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    if (title) chapter.title = title;
    if (content) chapter.content = content;
    if (order) chapter.order = order;

    snapshotVersion(book, "Chapter edited");
    await book.save();

    res.json({
      success: true,
      data: chapter,
      versionHistory: book.versionHistory,
      message: "Chapter updated successfully",
    });
  } catch (error) {
    console.error("updateChapter error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete a chapter (author only)
const deleteChapter = async (req, res) => {
  try {
    const { id, chapterId } = req.params;

    const book = await Book.findById(id);

    if (!book) {
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    }

    if (book.author.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    book.chapters.pull({ _id: chapterId });

    book.chapters.forEach((chapter, index) => {
      chapter.order = index + 1;
    });

    snapshotVersion(book, "Chapter deleted");
    await book.save();

    res.json({
      success: true,
      versionHistory: book.versionHistory,
      message: "Chapter deleted successfully",
    });
  } catch (error) {
    console.error("deleteChapter error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  publishBook,
  rateBook,
  getMyBooks,
  getBookChapters,
  getChapterContent,
  addChapter,
  updateChapter,
  deleteChapter,
};
