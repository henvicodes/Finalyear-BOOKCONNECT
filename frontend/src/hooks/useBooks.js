import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";

export const useBooks = (filters = {}) => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.genre) params.set("genre", filters.genre);
      if (filters.search) params.set("search", filters.search);
      if (filters.author) params.set("author", filters.author);
      if (filters.status) params.set("status", filters.status);
      if (filters.page) params.set("page", filters.page);
      if (filters.limit) params.set("limit", filters.limit);
      if (filters.sort) params.set("sort", filters.sort);

      const { data } = await api.get(`/api/books?${params.toString()}`);
      if (data.success) {
        setBooks(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load books");
    } finally {
      setLoading(false);
    }
  }, [
    filters.genre,
    filters.search,
    filters.author,
    filters.status,
    filters.page,
    filters.limit,
    filters.sort,
  ]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  return { books, loading, error, pagination, refetch: fetchBooks };
};

export const useMyBooks = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMyBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/api/books/user/my-books");
      if (data.success) setBooks(data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load your books");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyBooks();
  }, [fetchMyBooks]);

  return { books, loading, error, refetch: fetchMyBooks };
};

export const useBook = (id) => {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    const fetchBook = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/api/books/${id}`);
        if (data.success) setBook(data.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load book");
      } finally {
        setLoading(false);
      }
    };
    fetchBook();
  }, [id]);

  return { book, loading, error, refetch: () => fetchBook() };
};

export const useChapters = (bookId) => {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchChapters = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/books/${bookId}/chapters`);
      if (data.success) {
        setChapters(data.data.chapters);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load chapters");
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    fetchChapters();
  }, [fetchChapters]);

  return { chapters, loading, error, refetch: fetchChapters };
};

export const useChapterContent = (bookId, chapterId) => {
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchChapterContent = useCallback(async () => {
    if (!bookId || !chapterId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(
        `/api/books/${bookId}/chapters/${chapterId}`,
      );
      if (data.success) {
        setChapter(data.data.chapter);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load chapter content");
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterId]);

  useEffect(() => {
    fetchChapterContent();
  }, [fetchChapterContent]);

  return { chapter, loading, error, refetch: fetchChapterContent };
};

export const useCreateBook = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createBook = useCallback(async (bookData) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/api/books", bookData);
      if (data.success) {
        return { success: true, book: data.data };
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to create book";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { createBook, loading, error };
};

export const useUpdateBook = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateBook = useCallback(async (bookId, updates) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.put(`/api/books/${bookId}`, updates);
      if (data.success) {
        return { success: true, book: data.data };
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to update book";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateBook, loading, error };
};

export const useDeleteBook = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deleteBook = useCallback(async (bookId) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.delete(`/api/books/${bookId}`);
      if (data.success) {
        return { success: true };
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to delete book";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteBook, loading, error };
};

export const useChapterManager = (bookId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const addChapter = useCallback(
    async (chapterData) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.post(
          `/api/books/${bookId}/chapters`,
          chapterData,
        );
        if (data.success) {
          return { success: true, chapter: data.data };
        }
      } catch (err) {
        const errorMsg = err.response?.data?.message || "Failed to add chapter";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [bookId],
  );

  const updateChapter = useCallback(
    async (chapterId, chapterData) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.put(
          `/api/books/${bookId}/chapters/${chapterId}`,
          chapterData,
        );
        if (data.success) {
          return { success: true, chapter: data.data };
        }
      } catch (err) {
        const errorMsg =
          err.response?.data?.message || "Failed to update chapter";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [bookId],
  );

  const deleteChapter = useCallback(
    async (chapterId) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.delete(
          `/api/books/${bookId}/chapters/${chapterId}`,
        );
        if (data.success) {
          return { success: true };
        }
      } catch (err) {
        const errorMsg =
          err.response?.data?.message || "Failed to delete chapter";
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setLoading(false);
      }
    },
    [bookId],
  );

  return { addChapter, updateChapter, deleteChapter, loading, error };
};

export const usePublishBook = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const publishBook = useCallback(async (bookId) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post(`/api/books/${bookId}/publish`);
      if (data.success) {
        return { success: true, book: data.data };
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to publish book";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { publishBook, loading, error };
};

export const useRateBook = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const rateBook = useCallback(async (bookId, rating, review) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post(`/api/books/${bookId}/rate`, {
        rating,
        review,
      });
      if (data.success) {
        return { success: true, data: data.data };
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Failed to rate book";
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { rateBook, loading, error };
};
