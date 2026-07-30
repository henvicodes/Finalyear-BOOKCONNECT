import React from "react";
import AddBookForm from "../components/books/AddBookForm";
import "../styles/UploadBookPage.css";

const UploadBookPage = () => {
  return (
    <div className="upload-book-page">
      <div className="container">
        <AddBookForm />
      </div>
    </div>
  );
};

export default UploadBookPage;
