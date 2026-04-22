import { useState } from "react";
import { MessageSquare } from "lucide-react";
import FeedbackModal from "./FeedbackModal";

export default function UserFeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-4 bg-[#6678ff] hover:bg-[#7a89ff] text-white rounded-2xl shadow-lg shadow-[#6678ff]/25 transition-all hover:scale-105 flex items-center gap-2"
      >
        <MessageSquare size={20} />
        <span className="font-medium">Feedback</span>
      </button>
      
      <FeedbackModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
