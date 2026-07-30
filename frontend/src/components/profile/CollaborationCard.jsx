import React from "react";
import { MessageCircle } from "lucide-react";
import "../../styles/ProfilePage.css";

const CollaborationCard = () => (
  <div className="collab-card">
    <MessageCircle size={20} />
    <span>This author accepts collaboration requests</span>
    <button className="btn-collab">Request Collab</button>
  </div>
);

export default CollaborationCard;
