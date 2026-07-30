import React from "react";
import { BookOpen } from "lucide-react";
import "../../styles/ProfilePage.css";

export const WishlistCard = ({ book }) => (
  <div className="wishlist-card">
    <div className="wishlist-cover">
      <BookOpen size={22} />
    </div>
    <span className="wishlist-title">{book.title}</span>
    <span className="wishlist-author">{book.author}</span>
  </div>
);

export const AddWishlistCard = () => (
  <div className="wishlist-card wishlist-card--add">
    <span className="wishlist-add-icon">+</span>
    <span className="wishlist-title">Add books</span>
  </div>
);
