const Book = require("../models/Book");

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

    const [books, total] = await Promise.all([
      Book.find(query)
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

    res.json({ success: true, data: book });
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

    const book = await Book.create({
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

// Get all chapters of a book
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

    // Sort chapters by order
    const chapters = book.chapters.sort((a, b) => a.order - b.order);

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
      .select("title author chapters")
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

    await book.save();

    res.status(201).json({
      success: true,
      data: book.chapters[book.chapters.length - 1],
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

    await book.save();

    res.json({
      success: true,
      data: chapter,
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

    await book.save();

    res.json({
      success: true,
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
